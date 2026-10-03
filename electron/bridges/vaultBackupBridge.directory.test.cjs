const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createVaultBackupService, registerHandlers } = require('./vaultBackupBridge.cjs');
const payload = () => ({ hosts: [], keys: [], snippets: [], customGroups: [] });
function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'netcatty-backup-directory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const selected = path.join(root, 'custom');
  fs.mkdirSync(selected);
  const calls = [];
  const electron = {
    app: { getPath: () => root },
    safeStorage: { isEncryptionAvailable: () => true, encryptString: (raw) => Buffer.from(`encrypted:${raw}`) },
    dialog: {
      showSaveDialog: async () => { throw new Error('save dialog must never be called'); },
      showOpenDialog: async (...args) => { calls.push(args); return { canceled: false, filePaths: [selected] }; },
    },
  };
  return { root, selected, calls, electron, service: createVaultBackupService(electron) };
}

test('default save creates manual directory without requiring or calling a dialog', async (t) => {
  const { root, electron, service, calls } = setup(t);
  const defaultDir = path.join(root, 'manual-backups');
  assert.deepEqual(await service.getBackupDirectory(), { path: defaultDir });
  assert.equal(fs.existsSync(defaultDir), false);
  const direct = createVaultBackupService({ ...electron, dialog: undefined });
  const result = await direct.exportBackupFile({ payload: payload(), path: path.join(root, 'injected.json') });
  assert.equal(path.dirname(result.path), defaultDir);
  assert.equal(result.canceled, false);
  assert.equal(fs.existsSync(result.path), true);
  assert.equal(fs.existsSync(path.join(root, 'injected.json')), false);
  assert.deepEqual(calls, []);
});

test('native directory choice persists privately and survives service restart', async (t) => {
  const { root, selected, service, electron, calls } = setup(t);
  assert.deepEqual(await service.chooseBackupDirectory(), { canceled: false, path: selected });
  assert.deepEqual(calls[0][0].properties, ['openDirectory', 'createDirectory']);
  const configPath = path.join(root, 'vault-backup-settings.json');
  assert.equal(JSON.parse(fs.readFileSync(configPath)).formatVersion, 1);
  if (process.platform !== 'win32') assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
  const restarted = createVaultBackupService(electron);
  assert.deepEqual(await restarted.getBackupDirectory(), { path: selected });
  const result = await restarted.exportBackupFile({ payload: payload() });
  assert.equal(path.dirname(result.path), selected);
  assert.equal(calls.length, 1);
});

test('cancel directory choice preserves config bytes and selected folder', async (t) => {
  const { root, selected, electron, service } = setup(t);
  await service.chooseBackupDirectory();
  const configPath = path.join(root, 'vault-backup-settings.json');
  const bytes = fs.readFileSync(configPath, 'utf8');
  electron.dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  assert.deepEqual(await service.chooseBackupDirectory(), { canceled: true });
  assert.equal(fs.readFileSync(configPath, 'utf8'), bytes);
  assert.deepEqual(await service.getBackupDirectory(), { path: selected });
});

test('rapid concurrent saves always produce distinct immutable files', async (t) => {
  const { selected, service, calls } = setup(t);
  await service.chooseBackupDirectory();
  const results = await Promise.all(Array.from({ length: 5 }, () => service.exportBackupFile({ payload: payload() })));
  assert.equal(new Set(results.map((result) => result.path)).size, 5);
  assert.equal(fs.readdirSync(selected).length, 5);
  assert.equal(calls.length, 1);
});

test('missing configured directory errors without recreation or default fallback', async (t) => {
  const { root, selected, service } = setup(t);
  await service.chooseBackupDirectory();
  fs.rmdirSync(selected);
  await assert.rejects(() => service.exportBackupFile({ payload: payload() }));
  assert.equal(fs.existsSync(selected), false);
  assert.equal(fs.existsSync(path.join(root, 'manual-backups')), false);
});

test('corrupt or unsupported config rejects save but new directory choice repairs it', async (t) => {
  const { root, selected, service } = setup(t);
  const configPath = path.join(root, 'vault-backup-settings.json');
  for (const raw of ['{broken', JSON.stringify({ formatVersion: 2, path: selected }), JSON.stringify({ formatVersion: 1, path: 'relative' })]) {
    fs.writeFileSync(configPath, raw);
    await assert.rejects(() => service.exportBackupFile({ payload: payload() }), /backup directory configuration/);
    assert.equal(fs.readFileSync(configPath, 'utf8'), raw);
    assert.deepEqual(await service.chooseBackupDirectory(), { canceled: false, path: selected });
    assert.deepEqual(await service.getBackupDirectory(), { path: selected });
  }
});

test('selection rejects files and unwritable directories without persisting config', async (t) => {
  const { root, selected, electron, service } = setup(t);
  const filePath = path.join(root, 'ordinary-file');
  fs.writeFileSync(filePath, 'data');
  electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  await assert.rejects(() => service.chooseBackupDirectory(), /directory/);
  electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  const access = fs.promises.access;
  fs.promises.access = async (target, mode) => {
    if (target === selected && mode === fs.constants.W_OK) throw new Error('permission denied');
    return access(target, mode);
  };
  try { await assert.rejects(() => service.chooseBackupDirectory(), /permission denied/); }
  finally { fs.promises.access = access; }
  assert.equal(fs.existsSync(path.join(root, 'vault-backup-settings.json')), false);
});

test('configuration write failure preserves prior bytes and removes temp file', async (t) => {
  const { root, service } = setup(t);
  await service.chooseBackupDirectory();
  const configPath = path.join(root, 'vault-backup-settings.json');
  const before = fs.readFileSync(configPath, 'utf8');
  const rename = fs.promises.rename;
  fs.promises.rename = async () => { throw new Error('configuration write failed'); };
  try { await assert.rejects(() => service.chooseBackupDirectory(), /configuration write failed/); }
  finally { fs.promises.rename = rename; }
  assert.equal(fs.readFileSync(configPath, 'utf8'), before);
  assert.equal(fs.readdirSync(root).some((file) => file.includes('.tmp-')), false);
});

test('directory IPC attaches native chooser to sender and broadcasts only successful changes', async (t) => {
  const { root, selected, electron, calls } = setup(t);
  const sender = {};
  const parent = {};
  const broadcasts = [];
  electron.BrowserWindow = { fromWebContents: (contents) => { assert.equal(contents, sender); return parent; }, getAllWindows: () => [{ webContents: { send: (...args) => broadcasts.push(args) } }] };
  const handlers = new Map();
  registerHandlers({ handle: (name, handler) => handlers.set(name, handler) }, electron);
  const result = await handlers.get('netcatty:vaultBackups:chooseDirectory')({ sender }, { path: path.join(root, 'injected') });
  assert.equal(result.path, selected);
  assert.equal(calls[0][0], parent);
  assert.deepEqual(await handlers.get('netcatty:vaultBackups:directory')(), { path: selected });
  assert.deepEqual(broadcasts, [['netcatty:vaultBackups:changed']]);
  electron.dialog.showOpenDialog = async () => ({ canceled: true });
  await handlers.get('netcatty:vaultBackups:chooseDirectory')({ sender });
  assert.equal(broadcasts.length, 1);
});

test('configured directory becoming unwritable errors without switching destination', async (t) => {
  const { root, selected, service } = setup(t);
  await service.chooseBackupDirectory();
  const configPath = path.join(root, 'vault-backup-settings.json');
  const configBytes = fs.readFileSync(configPath, 'utf8');
  const access = fs.promises.access;
  fs.promises.access = async (target, mode) => {
    if (target === selected && mode === fs.constants.W_OK) throw new Error('permission denied');
    return access(target, mode);
  };
  try { await assert.rejects(() => service.exportBackupFile({ payload: payload() }), /permission denied/); }
  finally { fs.promises.access = access; }
  assert.equal(fs.readFileSync(configPath, 'utf8'), configBytes);
  assert.deepEqual(fs.readdirSync(selected), []);
  assert.equal(fs.existsSync(path.join(root, 'manual-backups')), false);
});

test('cancel initial directory choice creates no settings or backup folder', async (t) => {
  const { root, electron, service } = setup(t);
  electron.dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  assert.deepEqual(await service.chooseBackupDirectory(), { canceled: true });
  assert.equal(fs.existsSync(path.join(root, 'vault-backup-settings.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'manual-backups')), false);
});
