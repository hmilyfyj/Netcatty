const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  assertMonacoDistAssets,
  copyMonacoVsAssets,
} = require('./copy-monaco.cjs');

test('copyMonacoVsAssets copies loader.js into public/monaco/vs', () => {
  const target = copyMonacoVsAssets();
  assert.equal(fs.existsSync(path.join(target, 'loader.js')), true);
});

test('assertMonacoDistAssets throws when the packaged loader is missing', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'monaco-dist-'));
  assert.throws(
    () => assertMonacoDistAssets(repoRoot),
    /missing/,
  );
});
