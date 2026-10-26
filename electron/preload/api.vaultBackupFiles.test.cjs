const assert = require('node:assert/strict');
const test = require('node:test');
const { createPreloadApi } = require('./api.cjs');

test('backup file preload forwards payload only and ignores renderer-selected directory or read paths', async () => {
  const calls = [];
  const result = { canceled: true };
  const api = createPreloadApi({ ipcRenderer: { invoke: async (...args) => { calls.push(args); return result; } }, webUtils: {} });
  const input = { payload: { hosts: [], keys: [], snippets: [], customGroups: [] } };
  assert.equal(await api.exportVaultBackupFile(input), result);
  assert.equal(await api.readVaultBackupFile('/renderer/chosen/path.json'), result);
  assert.equal(await api.getVaultBackupDirectory('/injected'), result);
  assert.equal(await api.chooseVaultBackupDirectory('/injected'), result);
  assert.deepEqual(calls, [
    ['netcatty:vaultBackups:exportFile', input],
    ['netcatty:vaultBackups:readFile'],
    ['netcatty:vaultBackups:directory'],
    ['netcatty:vaultBackups:chooseDirectory'],
  ]);
});
