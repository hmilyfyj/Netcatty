const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

if (!process.versions.electron) {
  const release = path.resolve(process.argv[2] || 'release');
  let resources;
  let executable;
  if (process.platform === 'darwin') {
    const app = path.join(release, process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Netcatty.app', 'Contents');
    resources = path.join(app, 'Resources');
    executable = path.join(app, 'MacOS', 'Netcatty');
  } else {
    const dir = path.join(release, process.platform === 'win32' ? 'win-unpacked'
      : process.arch === 'arm64' ? 'linux-arm64-unpacked' : 'linux-unpacked');
    resources = path.join(dir, 'resources');
    executable = ['Netcatty.exe', 'netcatty', 'Netcatty']
      .map(name => path.join(dir, name)).find(file => fs.existsSync(file));
  }
  assert.ok(executable && fs.existsSync(executable), 'packaged executable for the host architecture is required');
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
  delete env.NODE_OPTIONS;
  const child = spawnSync(executable, [__filename, path.join(resources, 'app.asar')], {
    env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 30000, windowsHide: true,
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.error) throw child.error;
  assert.equal(child.signal, null, 'packaged crypto probe was terminated');
  if (child.status === 0)
    assert.equal(JSON.parse(child.stdout).result, 'PASS', 'packaged crypto probe did not complete');
  process.exit(child.status ?? 1);
}

(async () => {
  const archive = fs.realpathSync(path.resolve(process.argv[2]));
  const r = createRequire(path.join(archive, 'package.json'));
  for (const name of ['ssh2/lib/protocol/crypto.js', '@noble/ciphers/chacha.js']) {
    assert.ok(r.resolve(name).startsWith(`${archive}${path.sep}`),
      `${name} resolved outside the packaged app`);
  }
  const backend = r('ssh2/lib/protocol/crypto.js');
  await backend.init;
  const algorithms = r('./electron/bridges/sshAlgorithms.cjs');
  const ciphers = ['aes128-gcm@openssh.com', 'aes256-gcm@openssh.com',
    'aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'chacha20-poly1305@openssh.com'];
  assert.equal(backend.CHACHA20_SUPPORTED, true);
  for (const build of [algorithms.buildAlgorithms, algorithms.buildSftpAlgorithms]) {
    assert.deepEqual(build(false).cipher, ciphers);
    assert.ok(build(true).cipher.includes(ciphers.at(-1)));
    assert.deepEqual(build(false, { algorithmOverrides: { cipher: [ciphers.at(-1)] } }).cipher, [ciphers.at(-1)]);
  }
  for (const name of ciphers) {
    const info = backend.CIPHER_INFO[name];
    const key = crypto.randomBytes(info.keyLen);
    const iv = crypto.randomBytes(info.ivLen);
    const macInfo = backend.MAC_INFO['hmac-sha2-256'];
    const macKey = crypto.randomBytes(macInfo.len);
    const chunks = [];
    const payloads = [];
    const cipher = backend.createCipher({ outbound: {
      cipherInfo: info, cipherKey: key, cipherIV: Buffer.from(iv), macInfo, macKey,
      seqno: 42, onWrite: bytes => chunks.push(Buffer.from(bytes)),
    } });
    const decipher = backend.createDecipher({ inbound: {
      decipherInfo: info, decipherKey: key, decipherIV: Buffer.from(iv), macInfo, macKey,
      seqno: 42, onPayload: bytes => { payloads.push(Buffer.from(bytes)); },
    } });
    const payload = Buffer.from('synthetic packaged SSH crypto check');
    const packet = cipher.allocPacket(payload.length);
    payload.copy(packet, 5);
    cipher.encrypt(packet);
    const wire = Buffer.concat(chunks);
    decipher.decrypt(wire, 0, wire.length);
    assert.deepEqual(payloads, [payload], name);
    cipher.free();
    decipher.free();
  }
  const first = crypto.generateKeyPairSync('x25519');
  const second = crypto.generateKeyPairSync('x25519');
  assert.deepEqual(crypto.diffieHellman({ privateKey: first.privateKey, publicKey: second.publicKey }),
    crypto.diffieHellman({ privateKey: second.privateKey, publicKey: first.publicKey }));
  const curves = ['prime256v1', 'secp384r1', 'secp521r1'];
  for (const curve of curves) {
    const a = crypto.createECDH(curve); a.generateKeys();
    const b = crypto.createECDH(curve); b.generateKeys();
    assert.deepEqual(a.computeSecret(b.getPublicKey()), b.computeSecret(a.getPublicKey()));
  }
  const signatures = [];
  for (const [type, options, hashes] of [
    ['ed25519', {}, [null]],
    ['rsa', { modulusLength: 2048 }, ['sha256', 'sha512']],
    ['ec', { namedCurve: 'prime256v1' }, ['sha256']],
    ['ec', { namedCurve: 'secp384r1' }, ['sha384']],
    ['ec', { namedCurve: 'secp521r1' }, ['sha512']],
  ]) {
    const keys = crypto.generateKeyPairSync(type, options);
    for (const hash of hashes) {
      const data = Buffer.from('synthetic signature check');
      const signature = crypto.sign(hash, data, keys.privateKey);
      assert.equal(crypto.verify(hash, data, keys.publicKey, signature), true);
      assert.equal(crypto.verify(hash, Buffer.from('changed'), keys.publicKey, signature), false);
      signatures.push(`${type}:${options.namedCurve || hash || 'default'}`);
    }
  }
  console.log(JSON.stringify({ electron: process.versions.electron, arch: process.arch,
    nativeChaCha: crypto.getCiphers().includes('chacha20'), ciphers,
    keyExchange: ['x25519', ...curves], signatures, result: 'PASS' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
