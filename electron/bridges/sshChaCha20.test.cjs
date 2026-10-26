const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

const PROTOCOL_DIR = path.dirname(require.resolve("ssh2/lib/protocol/crypto.js"));
const CIPHER = "chacha20-poly1305@openssh.com";

// Each copy has its own WASM state and cannot accidentally load sshcrypto.node.
function loadCrypto(t, { native = false, dependency = "installed", binding } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "netcatty-ssh-crypto-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "crypto"));
  for (const file of ["crypto.js", "utils.js", "constants.js", "crypto/poly1305.js"]) {
    fs.copyFileSync(path.join(PROTOCOL_DIR, file), path.join(dir, file));
  }
  for (const name of ["asn1", "safer-buffer"]) {
    fs.cpSync(path.dirname(require.resolve(`${name}/package.json`)), path.join(dir, "node_modules", name), { recursive: true });
  }
  if (dependency === "installed") {
    let nobleDir;
    try { nobleDir = path.dirname(require.resolve("@noble/ciphers/chacha.js")); } catch {}
    if (nobleDir) fs.cpSync(nobleDir, path.join(dir, "node_modules/@noble/ciphers"), { recursive: true });
  } else if (dependency === "broken" || dependency === "missing-export") {
    const nobleDir = path.join(dir, "node_modules/@noble/ciphers");
    fs.mkdirSync(nobleDir, { recursive: true });
    fs.writeFileSync(path.join(nobleDir, "package.json"), JSON.stringify({ type: "module", exports: { "./chacha.js": "./chacha.js" } }));
    fs.writeFileSync(path.join(nobleDir, "chacha.js"), dependency === "broken"
      ? 'throw new Error("broken chacha dependency");\n'
      : "export const unrelated = true;\n");
  }

  const original = { getCiphers: crypto.getCiphers, createCipheriv: crypto.createCipheriv, createDecipheriv: crypto.createDecipheriv };
  const originalLoad = Module._load;
  const filename = fs.realpathSync(path.join(dir, "crypto.js"));
  if (binding) {
    Module._load = function (name, parent, ...args) {
      if (parent?.filename === filename && name.endsWith("sshcrypto.node")) return binding;
      return originalLoad.call(this, name, parent, ...args);
    };
  }
  if (!native) {
    crypto.getCiphers = () => original.getCiphers().filter((name) => name !== "chacha20");
    for (const method of ["createCipheriv", "createDecipheriv"]) {
      crypto[method] = (name, ...args) => {
        assert.notEqual(name, "chacha20", "fallback must not call an unavailable OpenSSL primitive");
        return original[method](name, ...args);
      };
    }
  }
  try {
    const backend = require(path.join(dir, "crypto.js"));
    const constants = require(path.join(dir, "constants.js"));
    return { backend, constants };
  } finally {
    Module._load = originalLoad;
    Object.assign(crypto, original);
  }
}

function makeCipher(backend, key, seqno, onWrite) {
  return backend.createCipher({ outbound: { cipherInfo: backend.CIPHER_INFO[CIPHER], cipherKey: key, seqno, onWrite } });
}

function makeDecipher(backend, key, seqno, onPayload) {
  return backend.createDecipher({ inbound: { decipherInfo: backend.CIPHER_INFO[CIPHER], decipherKey: key, seqno, onPayload } });
}

function encrypt(backend, key, seqno, packets) {
  const chunks = [];
  const cipher = makeCipher(backend, key, seqno, (data) => chunks.push(Buffer.from(data)));
  for (const packet of packets) cipher.encrypt(Buffer.from(packet));
  cipher.free();
  return Buffer.concat(chunks);
}

function decryptFragments(backend, key, seqno, wire) {
  const received = [];
  const decipher = makeDecipher(backend, key, seqno, (data) => { received.push(Buffer.from(data)); });
  const sizes = [1, 2, 1, 3, 16, 17, 4096];
  for (let offset = 0, step = 0; offset < wire.length; step++) {
    const chunk = wire.subarray(offset, offset + sizes[step % sizes.length]);
    decipher.decrypt(chunk, 0, chunk.length);
    offset += chunk.length;
  }
  decipher.free();
  return received;
}

test("SSH ChaCha20 works without an OpenSSL primitive or native addon", async (t) => {
  const { backend, constants } = loadCrypto(t);
  await backend.init;
  assert.equal(backend.bindingAvailable, false);
  const payload = Buffer.from("only-chacha20 SSH server");
  const chunks = [];
  const cipher = makeCipher(backend, Buffer.alloc(64, 7), 42, (data) => chunks.push(data));
  const packet = cipher.allocPacket(payload.length);
  payload.copy(packet, 5);
  cipher.encrypt(packet);
  assert.equal(backend.CHACHA20_SUPPORTED, true);
  assert.ok(constants.SUPPORTED_CIPHER.includes(CIPHER));
  const received = [];
  const decipher = makeDecipher(backend, Buffer.alloc(64, 7), 42, (data) => { received.push(Buffer.from(data)); });
  const wire = Buffer.concat(chunks);
  decipher.decrypt(wire, 0, wire.length);
  assert.deepEqual(received, [payload]);
});

test("SSH ChaCha20 is absent when both native and fallback primitives are missing", async (t) => {
  const { backend, constants } = loadCrypto(t, { dependency: "missing" });
  await backend.init;
  assert.equal(backend.CHACHA20_SUPPORTED, false);
  assert.equal(constants.SUPPORTED_CIPHER.includes(CIPHER), false);
  assert.ok(constants.SUPPORTED_CIPHER.includes("aes128-ctr"));
});

test("a broken ChaCha20 dependency rejects initialization", async (t) => {
  const { backend } = loadCrypto(t, { dependency: "broken" });
  await assert.rejects(backend.init, /broken chacha dependency/);
});

test("a ChaCha20 dependency missing its raw primitive rejects initialization", async (t) => {
  const { backend } = loadCrypto(t, { dependency: "missing-export" });
  await assert.rejects(backend.init, /does not export chacha20orig/);
});

test("ChaCha20 fallback matches OpenSSL packets in both directions", async (t) => {
  const fallback = loadCrypto(t).backend;
  const reference = loadCrypto(t, { native: true }).backend;
  await Promise.all([fallback.init, reference.init]);
  for (const seqno of [0, 1, 0x01020304, 0xffffffff]) {
    const key = crypto.randomBytes(64);
    const payloads = [0, 1, 7, 64, 65, 1024, 32768].map((size) => crypto.randomBytes(size));
    const allocator = makeCipher(reference, key, seqno, () => {});
    const packets = payloads.map((payload) => {
      const packet = allocator.allocPacket(payload.length);
      payload.copy(packet, 5);
      return packet;
    });
    allocator.free();
    const fallbackWire = encrypt(fallback, key, seqno, packets);
    const referenceWire = encrypt(reference, key, seqno, packets);
    assert.deepEqual(fallbackWire, referenceWire, `wire format at seqno ${seqno}`);
    assert.deepEqual(decryptFragments(fallback, key, seqno, referenceWire), payloads);
    assert.deepEqual(decryptFragments(reference, key, seqno, fallbackWire), payloads);
  }
});

test("ChaCha20 fallback rejects tampering and never delivers unauthenticated payload", async (t) => {
  const { backend } = loadCrypto(t);
  await backend.init;
  const key = crypto.randomBytes(64);
  const seqno = 17;
  const allocator = makeCipher(backend, key, seqno, () => {});
  const packet = allocator.allocPacket(64);
  Buffer.alloc(64, 0x5a).copy(packet, 5);
  const wire = encrypt(backend, key, seqno, [packet]);
  for (const index of [4, wire.length - 1]) {
    const changed = Buffer.from(wire);
    changed[index] ^= 1;
    const received = [];
    const decipher = makeDecipher(backend, key, seqno, (data) => { received.push(data); });
    assert.throws(() => decipher.decrypt(changed, 0, changed.length), /Invalid MAC/);
    assert.deepEqual(received, []);
  }
  const received = [];
  const decipher = makeDecipher(backend, key, seqno, (data) => { received.push(data); });
  decipher.decrypt(wire.subarray(0, -1), 0, wire.length - 1);
  assert.deepEqual(received, [], "a truncated MAC must not release plaintext");
  const nonce = Buffer.alloc(16);
  nonce.writeUInt32BE(seqno, 12);
  for (const length of [0, 7, 9, 35008]) {
    const invalidLength = Buffer.alloc(4);
    invalidLength.writeUInt32BE(length);
    const header = crypto.createCipheriv("chacha20", key.subarray(32), nonce).update(invalidLength);
    const badDecipher = makeDecipher(backend, key, seqno, () => assert.fail("invalid length delivered plaintext"));
    assert.throws(() => badDecipher.decrypt(header, 0, header.length), /Bad packet length/);
  }
});

test("native ChaCha20 does not load the fallback dependency", async (t) => {
  const { backend } = loadCrypto(t, { native: true, dependency: "broken" });
  await backend.init;
  assert.equal(backend.CHACHA20_SUPPORTED, true);
  const allocator = makeCipher(backend, Buffer.alloc(64), 0, () => {});
  const packet = allocator.allocPacket(1);
  packet[5] = 0x42;
  assert.doesNotThrow(() => allocator.encrypt(packet));
});

test("an available addon keeps AES bindings and skips unavailable native ChaCha20", async (t) => {
  class UnsupportedChaCha { constructor() { assert.fail("an OpenSSL-dependent ChaCha20 addon must not be used"); } }
  class AESBinding {}
  const binding = { ChaChaPolyCipher: UnsupportedChaCha, ChaChaPolyDecipher: UnsupportedChaCha, AESGCMCipher: AESBinding, AESGCMDecipher: AESBinding };
  const { backend } = loadCrypto(t, { binding });
  await backend.init;
  assert.equal(backend.bindingAvailable, true);
  const key = crypto.randomBytes(64);
  const cipher = makeCipher(backend, key, 0, () => {});
  const packet = cipher.allocPacket(1);
  packet[5] = 0x42;
  const wire = encrypt(backend, key, 0, [packet]);
  assert.deepEqual(decryptFragments(backend, key, 0, wire), [Buffer.from([0x42])]);
  const cipherInfo = backend.CIPHER_INFO["aes128-gcm@openssh.com"];
  const aesCipher = backend.createCipher({ outbound: { cipherInfo, cipherKey: Buffer.alloc(16), cipherIV: Buffer.alloc(12), seqno: 0, onWrite() {} } });
  const aesDecipher = backend.createDecipher({ inbound: { decipherInfo: cipherInfo, decipherKey: Buffer.alloc(16), decipherIV: Buffer.alloc(12), seqno: 0, onPayload() {} } });
  assert.ok(aesCipher._instance instanceof AESBinding);
  assert.ok(aesDecipher._instance instanceof AESBinding);
});
