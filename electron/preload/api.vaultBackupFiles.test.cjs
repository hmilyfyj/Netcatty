const assert = require('node:assert/strict');
const test = require('node:test');
const { createPreloadApi } = require('./api.cjs');

test('backup file preload invokes native dialog IPC and does not forward read arguments', async () => {
  const calls = [];
  const result = { canceled: true };
  const api = createPreloadApi({ ipcRenderer: { invoke: async (...args) => { calls.push(args); return result; } }, webUtils: {} });
  const input = { payload: { hosts: [], keys: [], snippets: [], customGroups: [] } };
  assert.equal(await api.exportVaultBackupFile(input), result);
  assert.equal(await api.readVaultBackupFile('/renderer/chosen/path.json'), result);
  assert.deepEqual(calls, [
    ['netcatty:vaultBackups:exportFile', input],
    ['netcatty:vaultBackups:readFile'],
  ]);
});
