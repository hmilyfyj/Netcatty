import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { SyncPayload } from '../domain/sync.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'localStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key as keyof Window] });
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { LocalBackupsPanel } = await import('./cloud-sync/CloudSyncLocalBackupsPanel.tsx');
const { I18nProvider } = await import('../application/i18n/I18nProvider.tsx');
const { applyProtectedSyncPayload } = await import('../application/localVaultBackups.ts');
const { STORAGE_KEY_VAULT_RESTORE_IN_PROGRESS_UNTIL } = await import('../infrastructure/config/storageKeys.ts');
const { toast } = await import('./ui/toast.tsx');
const payload: SyncPayload = { hosts: [], keys: [], snippets: [], customGroups: [], syncedAt: 1 };
const backup = { id: 'manual-1', createdAt: 1, reason: 'manual' as const, fingerprint: 'hash', preview: { hostCount: 3, keyCount: 2, snippetCount: 1, noteCount: 0, identityCount: 0, portForwardingRuleCount: 0 } };
let root: Root;
let container: HTMLDivElement;
let successes: string[];
let errors: string[];
let bridge: Record<string, unknown>;
let directory: string;
let directoryListeners: Set<() => void>;

test.beforeEach(() => {
  dom.window.localStorage.clear();
  successes = [];
  errors = [];
  toast.success = (message) => { successes.push(message); };
  toast.error = (message) => { errors.push(message); };
  directory = '/default/manual-backups';
  directoryListeners = new Set();
  bridge = {
    getVaultBackupCapabilities: async () => ({ encryptionAvailable: true }),
    listVaultBackups: async () => [],
    getVaultBackupDirectory: async () => ({ path: directory }),
    chooseVaultBackupDirectory: async () => ({ canceled: true }),
    onVaultBackupsChanged: (listener: () => void) => { directoryListeners.add(listener); return () => { directoryListeners.delete(listener); }; },
    exportVaultBackupFile: async () => ({ canceled: false, path: `${directory}/backup.json`, backup }),
    readVaultBackupFile: async () => ({ canceled: true }),
  };
  Object.assign(dom.window, { netcatty: bridge });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
test.afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const render = async (props: Partial<React.ComponentProps<typeof LocalBackupsPanel>> = {}) => {
  await act(async () => root.render(
    <I18nProvider locale="en">
      <LocalBackupsPanel onBuildLocalPayload={() => payload} onApplyPayload={() => {}} {...props} />
    </I18nProvider>,
  ));
};
const button = (text: string) => {
  const found = [...document.querySelectorAll('button')].find((entry) => entry.textContent === text);
  assert.ok(found, `button ${text} missing`);
  return found;
};
const click = async (text: string) => {
  await act(async () => button(text).click());
};

test('save accepts a full asynchronous snapshot without a cloud master key', async () => {
  const snapshot: SyncPayload = { ...payload, settings: { theme: 'dark' } };
  let saved: unknown;
  bridge.exportVaultBackupFile = async (options: unknown) => { saved = options; return { canceled: false, path: '/chosen/backup.json', backup }; };
  await render({ restoreDisabledReason: 'no-master-key', onBuildLocalPayload: async () => snapshot });
  assert.equal([...document.querySelectorAll('button')].some((entry) => entry.textContent === 'Restore from file…'), false);
  await click('Save backup');
  assert.deepEqual(saved, { payload: snapshot });
  assert.deepEqual(successes, ['Backup saved to /chosen/backup.json']);
});

test('canceling directory selection or file import does not apply or show success', async () => {
  let applied = false;
  await render({ onApplyPayload: () => { applied = true; } });
  await click('Change directory…');
  await click('Restore from file…');
  assert.equal(applied, false);
  assert.deepEqual(successes, []);
  assert.deepEqual(errors, []);
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test('file restore shows preview and cancel discards the loaded payload', async () => {
  let applied = false;
  bridge.readVaultBackupFile = async () => ({ canceled: false, path: '/chosen/backup.json', backup, payload });
  await render({ onApplyPayload: () => { applied = true; } });
  await click('Restore from file…');
  assert.ok(document.querySelector('[role="dialog"]'));
  assert.match(document.body.textContent ?? '', /3 hosts, 2 keys, 1 snippets, 0 notes/);
  assert.equal(applied, false);
  await click('Cancel');
  assert.equal(applied, false);
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.deepEqual(successes, []);
});

for (const backupFails of [false, true]) {
  test(`file restore confirms before protected apply (${backupFails ? 'blocked on backup failure' : 'success'})`, async () => {
    const calls: string[] = [];
    bridge.readVaultBackupFile = async () => ({ canceled: false, backup, payload });
    bridge.createVaultBackup = async () => {
      calls.push('protect');
      if (backupFails) throw new Error('disk full');
      return { backup };
    };
    const current = { ...payload, keys: [{ id: 'existing-key', label: 'Existing', privateKey: 'current-secret' }] } as SyncPayload;
    await render({ onApplyPayload: async (loaded) => {
      assert.equal(loaded, payload);
      assert.ok(Number(dom.window.localStorage.getItem(STORAGE_KEY_VAULT_RESTORE_IN_PROGRESS_UNTIL)) > Date.now());
      await applyProtectedSyncPayload({
        buildPreApplyPayload: async () => current,
        prepareApply: async () => async () => { calls.push('apply'); },
        translateProtectiveBackupFailure: (message) => message,
      });
    } });
    await click('Restore from file…');
    assert.deepEqual(calls, []);
    await click('Restore');
    assert.deepEqual(calls, backupFails ? ['protect'] : ['protect', 'apply']);
    assert.equal(successes.length, backupFails ? 0 : 1);
    assert.equal(errors.length, backupFails ? 1 : 0);
    assert.equal(Number(dom.window.localStorage.getItem(STORAGE_KEY_VAULT_RESTORE_IN_PROGRESS_UNTIL)), 0);
  });
}

test('busy save prevents same-window duplicate actions', async () => {
  let finish!: (value: { canceled: boolean }) => void;
  let saves = 0;
  bridge.exportVaultBackupFile = () => { saves += 1; return new Promise((resolve) => { finish = resolve; }); };
  await render();
  await click('Save backup');
  assert.equal(button('Save backup').disabled, true);
  assert.equal(button('Restore from file…').disabled, true);
  await click('Save backup');
  assert.equal(saves, 1);
  await act(async () => finish({ canceled: false }));
  assert.equal(button('Save backup').disabled, false);
});

for (const action of ['save', 'read', 'choose'] as const) {
  test(`failed file ${action} clears busy and does not apply`, async () => {
    let applied = false;
    bridge[action === 'save' ? 'exportVaultBackupFile' : action === 'choose' ? 'chooseVaultBackupDirectory' : 'readVaultBackupFile'] = async () => {
      throw new Error('File operation failed');
    };
    await render({ onApplyPayload: () => { applied = true; } });
    await click(action === 'save' ? 'Save backup' : action === 'choose' ? 'Change directory…' : 'Restore from file…');
    assert.deepEqual(errors, ['File operation failed']);
    assert.deepEqual(successes, []);
    assert.equal(applied, false);
    assert.equal(button('Save backup').disabled, false);
    assert.equal(button('Restore from file…').disabled, false);
    assert.equal(button('Change directory…').disabled, false);
    assert.equal(document.querySelector('[role="dialog"]'), null);
  });
}

test('both settings hosts wire complete snapshots and the protected local apply callback', () => {
  const dashboard = readFileSync(new URL('./cloud-sync/CloudSyncDashboardTabs.tsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('./CloudSyncSettings.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /<LocalBackupsPanel\s+onApplyPayload=\{onApplyLocalPayload \?\? onApplyPayload\}\s+onBuildLocalPayload=\{onBuildLocalPayload\}/);
  assert.match(settings, /<LocalBackupsPanel\s+onApplyPayload=\{props.onApplyLocalPayload \?\? props.onApplyPayload\}\s+onBuildLocalPayload=\{props.onBuildLocalPayload\}\s+restoreDisabledReason="no-master-key"/);
  assert.match(settings, /<CloudSyncDashboardTabs[\s\S]*?onBuildLocalPayload=\{onBuildLocalPayload\}/);
});

test('shows the full read-only directory and saves without choosing again', async () => {
  let choices = 0;
  bridge.chooseVaultBackupDirectory = async () => { choices += 1; directory = '/remembered/path with spaces/Backups'; return { canceled: false, path: directory }; };
  await render({ restoreDisabledReason: 'no-master-key' });
  assert.equal(container.querySelector('#local-backup-directory')?.textContent, '/default/manual-backups');
  assert.equal(container.querySelector('input[type="text"]'), null);
  await click('Change directory…');
  assert.equal(container.querySelector('#local-backup-directory')?.textContent, directory);
  await click('Save backup');
  await click('Save backup');
  assert.equal(choices, 1);
  assert.equal(successes.length, 2);
  await act(async () => root.unmount());
  root = createRoot(container);
  await render();
  assert.equal(container.querySelector('#local-backup-directory')?.textContent, directory);
});

test('canceled directory selection preserves the displayed directory', async () => {
  await render();
  await click('Change directory…');
  assert.equal(container.querySelector('#local-backup-directory')?.textContent, directory);
  assert.deepEqual(successes, []);
  assert.deepEqual(errors, []);
});

test('failed initial directory load allows repair and file import', async () => {
  bridge.getVaultBackupDirectory = async () => { throw new Error('Invalid directory configuration'); };
  bridge.chooseVaultBackupDirectory = async () => ({ canceled: false, path: '/repaired/backups' });
  await render();
  assert.match(container.textContent ?? '', /Invalid directory configuration/);
  assert.equal(button('Save backup').disabled, true);
  assert.equal(button('Change directory…').disabled, false);
  assert.equal(button('Restore from file…').disabled, false);
  await click('Change directory…');
  assert.equal(container.querySelector('#local-backup-directory')?.textContent, '/repaired/backups');
  assert.equal(container.querySelector('[role="alert"]'), null);
  assert.equal(button('Save backup').disabled, false);
});

test('choosing a directory blocks duplicate choices and save until canceled', async () => {
  let finish!: (value: { canceled: boolean }) => void;
  let choices = 0;
  let saves = 0;
  bridge.chooseVaultBackupDirectory = () => { choices += 1; return new Promise((resolve) => { finish = resolve; }); };
  bridge.exportVaultBackupFile = () => { saves += 1; return Promise.resolve({ canceled: false }); };
  await render();
  await click('Change directory…');
  assert.equal(button('Change directory…').disabled, true);
  assert.equal(button('Save backup').disabled, true);
  await click('Change directory…');
  await click('Save backup');
  assert.equal(choices, 1);
  assert.equal(saves, 0);
  await act(async () => finish({ canceled: true }));
  assert.equal(button('Change directory…').disabled, false);
  assert.equal(button('Save backup').disabled, false);
  assert.deepEqual(successes, []);
});

test('directory broadcasts update mounted windows and unsubscribe on unmount', async () => {
  const secondContainer = document.createElement('div');
  document.body.appendChild(secondContainer);
  const secondRoot = createRoot(secondContainer);
  try {
    await render();
    await act(async () => secondRoot.render(<I18nProvider locale="en"><LocalBackupsPanel onBuildLocalPayload={() => payload} onApplyPayload={() => {}} /></I18nProvider>));
    assert.equal(directoryListeners.size, 2);
    directory = '/selected/in-other-window';
    await act(async () => { for (const listener of directoryListeners) listener(); });
    assert.equal(container.querySelector('#local-backup-directory')?.textContent, directory);
    assert.equal(secondContainer.querySelector('[id="local-backup-directory"]')?.textContent, directory);
  } finally {
    await act(async () => secondRoot.unmount());
    secondContainer.remove();
  }
  assert.equal(directoryListeners.size, 1);
});
