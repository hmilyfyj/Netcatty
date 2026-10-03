import assert from 'node:assert/strict';
import test from 'node:test';
import { MESSAGES_BY_LOCALE } from '../messages.ts';

test('all bundled locales describe saving, restoring and the machine-only restriction', () => {
  for (const [locale, messages] of Object.entries(MESSAGES_BY_LOCALE)) {
    for (const suffix of ['fileTitle', 'fileDesc', 'saveFile', 'restoreFile', 'fileSaved', 'fileSaveFailed', 'reason.manual', 'directoryLabel', 'changeDirectory', 'directoryUnavailable', 'directoryLoadFailed', 'directoryChangeFailed']) {
      assert.ok(messages[`cloudSync.localBackups.${suffix}`]?.trim(), `${locale}: ${suffix}`);
    }
    assert.match(messages['cloudSync.localBackups.fileSaved'], /\{path\}/);
    assert.match(messages['cloudSync.localBackups.directoryLoadFailed'], /\{message\}/);
    assert.doesNotMatch(messages['cloudSync.localBackups.saveFile'], /[.…]/);
  }
});
