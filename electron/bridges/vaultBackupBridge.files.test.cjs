const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createVaultBackupService, registerHandlers, BACKUP_DIR_NAME, MAX_PAYLOAD_BYTES } = require('./vaultBackupBridge.cjs');

const payload = () => ({ hosts: [{ id: 'host', password: 'private-password' }], keys: [{ id: 'key', privateKey: 'private-key-material' }], snippets: [], customGroups: [], syncedAt: 42 });
function setup(t, { encrypted = true, canceled = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'netcatty-backup-file-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const chosenPath = path.join(root, 'chosen backup.json');
  const key = crypto.randomBytes(32);
  const safeStorage = {
    isEncryptionAvailable: () => encrypted,
    encryptString(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]);
    },
    decryptString(value) {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
  const dialogs = [];
  const dialog = {
    async showSaveDialog() { throw new Error('save must never open a dialog'); },
    async showOpenDialog(...args) { dialogs.push(['open', ...args]); return { canceled, filePaths: [chosenPath] }; },
  };
  const electron = { app: { getPath: () => root, getVersion: () => '1.2.3' }, safeStorage, dialog };
  const service = createVaultBackupService(electron);
  return { root, chosenPath, dialogs, electron, service };
}

async function exportAndSelect(fixture, value = payload()) {
  const exported = await fixture.service.exportBackupFile({ payload: value, path: path.join(fixture.root, 'injected.json') });
  fixture.electron.dialog.showOpenDialog = async (...args) => {
    fixture.dialogs.push(['open', ...args]);
    return { canceled: false, filePaths: [exported.path] };
  };
  return exported;
}

test('direct export encrypts credentials and round-trips independently of history', async (t) => {
  const fixture = setup(t);
  const { service, root, dialogs } = fixture;
  const original = payload();
  const exported = await exportAndSelect(fixture, original);
  assert.equal(exported.canceled, false);
  assert.equal(path.dirname(exported.path), path.join(root, 'manual-backups'));
  assert.equal(exported.backup.reason, 'manual');
  const raw = fs.readFileSync(exported.path, 'utf8');
  assert.equal(raw.includes('private-password'), false);
  assert.equal(raw.includes('private-key-material'), false);
  assert.equal(JSON.parse(raw).payloadEncoding, 'safeStorage-v1');
  assert.equal(JSON.parse(raw).formatVersion, 1);
  if (process.platform !== 'win32') assert.equal(fs.statSync(exported.path).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(path.join(root, 'injected.json')), false);
  assert.equal(fs.existsSync(path.join(root, BACKUP_DIR_NAME)), false);
  assert.deepEqual(dialogs, []);
  const restored = await service.readBackupFile();
  assert.deepEqual(restored.payload, original);
  assert.deepEqual(restored.backup, exported.backup);
  await service.createBackup({ payload: original, maxCount: 1 });
  await service.trimBackups({ maxCount: 1 });
  assert.equal(fs.existsSync(exported.path), true);
});

test('canceling open-file dialog does not create directories or files', async (t) => {
  const { service, root } = setup(t, { canceled: true });
  assert.deepEqual(await service.readBackupFile(), { canceled: true });
  assert.deepEqual(fs.readdirSync(root), []);
});

test('read IPC attaches native dialog to sender; direct save and read ignore renderer paths', async (t) => {
  const { electron, dialogs, root } = setup(t);
  const handlers = new Map();
  const sender = {};
  const parent = {};
  electron.BrowserWindow = { fromWebContents: (contents) => { assert.equal(contents, sender); return parent; } };
  registerHandlers({ handle: (name, handler) => handlers.set(name, handler) }, electron);
  const exported = await handlers.get('netcatty:vaultBackups:exportFile')({ sender }, { payload: payload(), path: path.join(root, 'injected.json') });
  assert.equal(path.dirname(exported.path), path.join(root, 'manual-backups'));
  assert.deepEqual(dialogs, []);
  electron.dialog.showOpenDialog = async (...args) => { dialogs.push(['open', ...args]); return { canceled: false, filePaths: [exported.path] }; };
  const imported = await handlers.get('netcatty:vaultBackups:readFile')({ sender }, { path: path.join(root, 'injected.json') });
  assert.deepEqual(imported.payload, payload());
  assert.equal(dialogs[0][1], parent);
  assert.deepEqual(dialogs[0][2].properties, ['openFile']);
});

test('file operations refuse unavailable secure storage and malformed payload', async (t) => {
  const { service, root } = setup(t, { encrypted: false });
  await assert.rejects(() => service.exportBackupFile({ payload: payload() }), /Secure storage is unavailable/);
  assert.deepEqual(fs.readdirSync(root), []);
  const available = setup(t);
  await assert.rejects(() => available.service.exportBackupFile({ payload: { hosts: [] } }), /Invalid vault backup payload/);
  await exportAndSelect(available);
  const reader = createVaultBackupService({ ...available.electron, safeStorage: { isEncryptionAvailable: () => false } });
  await assert.rejects(() => reader.readBackupFile(), /Secure storage is unavailable/);
});

test('file import rejects unsupported format, invalid arrays, corruption and fingerprint mismatch without modifying input', async (t) => {
  const fixture = setup(t);
  const { service, electron } = fixture;
  const { path: chosenPath } = await exportAndSelect(fixture);
  const record = JSON.parse(fs.readFileSync(chosenPath, 'utf8'));
  const cases = [
    { ...record, formatVersion: 2 },
    { ...record, payloadEncoding: 'plain-json-v1', payloadData: JSON.stringify(payload()) },
    { ...record, payloadData: 'not base64' },
    { ...record, payloadData: Buffer.from('corrupt cipher').toString('base64') },
    { ...record, fingerprint: 'a'.repeat(64) },
    { ...record, payloadData: electron.safeStorage.encryptString(JSON.stringify({ hosts: [] })).toString('base64') },
  ];
  for (const value of cases) {
    const raw = JSON.stringify(value);
    fs.writeFileSync(chosenPath, raw);
    await assert.rejects(() => service.readBackupFile());
    assert.equal(fs.readFileSync(chosenPath, 'utf8'), raw);
  }
  fs.writeFileSync(chosenPath, '{broken');
  await assert.rejects(() => service.readBackupFile());
});

test('import refuses oversized file before buffering; export refuses oversized payload', async (t) => {
  const { service, chosenPath } = setup(t);
  const fd = fs.openSync(chosenPath, 'w');
  fs.ftruncateSync(fd, MAX_PAYLOAD_BYTES * 2 + 1);
  fs.closeSync(fd);
  await assert.rejects(() => service.readBackupFile(), /maximum allowed size/);
  const value = { ...payload(), bloat: 'x'.repeat(MAX_PAYLOAD_BYTES + 1) };
  await assert.rejects(() => service.exportBackupFile({ payload: value }), /maximum allowed size/);
});

test('failed atomic rename preserves prior backup and removes temporary siblings', async (t) => {
  const fixture = setup(t);
  const { service } = fixture;
  const { path: priorPath } = await exportAndSelect(fixture);
  const priorBytes = fs.readFileSync(priorPath, 'utf8');
  const rename = fs.promises.rename;
  fs.promises.rename = async () => { throw new Error('simulated rename failure'); };
  try { await assert.rejects(() => service.exportBackupFile({ payload: payload() }), /simulated rename failure/); }
  finally { fs.promises.rename = rename; }
  assert.equal(fs.readFileSync(priorPath, 'utf8'), priorBytes);
  assert.deepEqual(fs.readdirSync(path.dirname(priorPath)), [path.basename(priorPath)]);
});

test('manual export remains independent when configured to automatic backup directory', async (t) => {
  const { service, electron, root } = setup(t);
  const backupDir = path.join(root, BACKUP_DIR_NAME);
  fs.mkdirSync(backupDir);
  electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [backupDir] });
  await service.chooseBackupDirectory();
  const exported = await service.exportBackupFile({ payload: payload() });
  // Even a user-renamed manual file that matches historical naming is safe.
  const renamed = path.join(backupDir, 'vault-backup-manual.json');
  fs.renameSync(exported.path, renamed);
  await service.createBackup({ payload: payload(), maxCount: 1 });
  await service.createBackup({ payload: { ...payload(), customGroups: ['changed'] }, maxCount: 1 });
  assert.equal((await service.listBackups()).length, 1);
  assert.equal(fs.existsSync(renamed), true);
});

test('import rejects wrong encryption environment and derives preview from payload', async (t) => {
  const fixture = setup(t);
  const { service } = fixture;
  const { path: chosenPath } = await exportAndSelect(fixture);
  const wrongEnvironment = setup(t);
  wrongEnvironment.electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosenPath] });
  await assert.rejects(() => wrongEnvironment.service.readBackupFile());
  const record = JSON.parse(fs.readFileSync(chosenPath, 'utf8'));
  record.preview = { hostCount: 10000 };
  fs.writeFileSync(chosenPath, JSON.stringify(record));
  const imported = await service.readBackupFile();
  assert.equal(imported.backup.preview.hostCount, 1);
  assert.equal(imported.backup.preview.keyCount, 1);
});

test('failed temporary write preserves prior backup and cleans its partial sibling', async (t) => {
  const fixture = setup(t);
  const { service } = fixture;
  const { path: priorPath } = await exportAndSelect(fixture);
  const priorBytes = fs.readFileSync(priorPath, 'utf8');
  const open = fs.promises.open;
  fs.promises.open = async (...args) => {
    const handle = await open(...args);
    if (args[0].includes('.tmp-')) handle.writeFile = async () => { throw new Error('simulated disk write failure'); };
    return handle;
  };
  try { await assert.rejects(() => service.exportBackupFile({ payload: payload() }), /simulated disk write failure/); }
  finally { fs.promises.open = open; }
  assert.equal(fs.readFileSync(priorPath, 'utf8'), priorBytes);
  assert.deepEqual(fs.readdirSync(path.dirname(priorPath)), [path.basename(priorPath)]);
});
