const fs = require('fs');
const path = require('path');

function copyMonacoVsAssets(repoRoot = path.resolve(__dirname, '..')) {
  const source = path.join(repoRoot, 'node_modules', 'monaco-editor', 'min', 'vs');
  const target = path.join(repoRoot, 'public', 'monaco', 'vs');

  if (!fs.existsSync(source)) {
    throw new Error(`[copy-monaco] Source not found: ${source}`);
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function copyMonacoVsAssetsToDist(repoRoot = path.resolve(__dirname, '..')) {
  const source = path.join(repoRoot, 'node_modules', 'monaco-editor', 'min', 'vs');
  const target = path.join(repoRoot, 'dist', 'monaco', 'vs');

  if (!fs.existsSync(source)) {
    throw new Error(`[copy-monaco] Source not found: ${source}`);
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function assertMonacoDistAssets(repoRoot = path.resolve(__dirname, '..')) {
  const loader = path.join(repoRoot, 'dist', 'monaco', 'vs', 'loader.js');
  if (!fs.existsSync(loader)) {
    throw new Error(`[copy-monaco] missing ${loader}`);
  }
  return loader;
}

if (require.main === module) {
  const target = copyMonacoVsAssets();
  console.log('[copy-monaco] Copied Monaco VS assets to', target);
}

module.exports = {
  copyMonacoVsAssets,
  copyMonacoVsAssetsToDist,
  assertMonacoDistAssets,
};
