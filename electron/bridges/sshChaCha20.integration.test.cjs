const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const net = require("node:net");

// Load the actual client/server stack with Electron's missing raw primitive.
const originals = { getCiphers: crypto.getCiphers, createCipheriv: crypto.createCipheriv, createDecipheriv: crypto.createDecipheriv };
crypto.getCiphers = () => originals.getCiphers().filter((name) => name !== "chacha20");
for (const method of ["createCipheriv", "createDecipheriv"]) {
  crypto[method] = (name, ...args) => {
    assert.notEqual(name, "chacha20", "the SSH connection must use the fallback");
    return originals[method](name, ...args);
  };
}
let Client, Server, utils, buildAlgorithms, buildSftpAlgorithms;
try {
  ({ Client, Server, utils } = require("ssh2"));
  ({ buildAlgorithms, buildSftpAlgorithms } = require("./sshAlgorithms.cjs"));
} finally {
  Object.assign(crypto, originals);
}
const { STATUS_CODE } = require("ssh2/lib/protocol/SFTP.js");
const CHACHA = "chacha20-poly1305@openssh.com";
const hostKey = utils.generateKeyPairSync("ed25519").private;
const publicHostKey = utils.parseKey(hostKey).getPublicSSH();
const content = Buffer.alloc(65536, 0x5a);

async function startServer(t, cipher) {
  const peers = new Set();
  const sockets = new Set();
  const errors = [];
  const server = new Server({ hostKeys: [hostKey], algorithms: { cipher: [cipher], kex: ["curve25519-sha256"] } }, (peer) => {
    peers.add(peer);
    peer.on("error", (error) => errors.push(error));
    peer.on("authentication", (ctx) => {
      if (ctx.method === "password" && ctx.username === "fixture" && ctx.password === "fixture") ctx.accept();
      else ctx.reject();
    });
    peer.on("ready", () => {
      peer.on("session", (accept) => {
        const session = accept();
        session.on("pty", (acceptPty) => acceptPty());
        session.on("shell", (acceptShell) => {
          const channel = acceptShell();
          channel.on("data", (data) => channel.write(data));
        });
        session.on("exec", (acceptExec, _reject, info) => {
          assert.equal(info.command, "fixture-read");
          const channel = acceptExec();
          channel.end(content);
          channel.exit(0);
        });
        session.on("sftp", (acceptSftp) => {
          const sftp = acceptSftp();
          sftp.on("OPEN", (id, filename) => {
            assert.equal(filename, "/fixture");
            sftp.handle(id, Buffer.from("fixture"));
          });
          sftp.on("FSTAT", (id) => sftp.attrs(id, { mode: 0o100644, size: content.length, uid: 0, gid: 0, atime: 0, mtime: 0 }));
          sftp.on("READ", (id, _handle, offset, length) => {
            if (offset >= content.length) sftp.status(id, STATUS_CODE.EOF);
            else sftp.data(id, content.subarray(offset, offset + length));
          });
          sftp.on("CLOSE", (id) => sftp.status(id, STATUS_CODE.OK));
        });
      });
      peer.on("tcpip", (accept, reject, info) => {
        assert.equal(info.destIP, "127.0.0.1");
        const socket = net.connect(info.destPort, info.destIP);
        sockets.add(socket);
        socket.on("error", () => reject());
        socket.on("connect", () => {
          const channel = accept();
          socket.pipe(channel).pipe(socket);
        });
      });
    });
  });
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    for (const peer of peers) peer._sock.destroy();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  return { port: server.address().port, peers, errors };
}

function connect(t, server, cipher, { sock, expectedKey = publicHostKey, sftp = false } = {}) {
  const client = new Client();
  const handshakes = [];
  const errors = [];
  client.on("handshake", (negotiated) => handshakes.push(negotiated));
  client.on("error", (error) => errors.push(error));
  t.after(() => client.destroy());
  return new Promise((resolve, reject) => {
    client.once("ready", () => resolve({ client, handshakes, errors }));
    client.once("error", reject);
    client.connect({
      host: "127.0.0.1", port: server.port, sock,
      username: "fixture", password: "fixture", readyTimeout: 5000,
      hostVerifier: (key) => key.equals(expectedKey),
      algorithms: (sftp ? buildSftpAlgorithms : buildAlgorithms)(false, { algorithmOverrides: { cipher: [cipher] } }),
    });
  });
}

function exec(client) {
  return new Promise((resolve, reject) => client.exec("fixture-read", (error, channel) => {
    if (error) return reject(error);
    const chunks = [];
    channel.on("error", reject);
    channel.on("data", (data) => chunks.push(data));
    channel.on("close", () => resolve(Buffer.concat(chunks)));
  }));
}

test("a ChaCha20-only SSH server supports shell, exec, SFTP and rekey", { timeout: 15000 }, async (t) => {
  const server = await startServer(t, CHACHA);
  const { client, handshakes, errors } = await connect(t, server, CHACHA, { sftp: true });
  assert.equal(handshakes[0].cs.cipher, CHACHA);
  assert.equal(handshakes[0].sc.cipher, CHACHA);
  assert.deepEqual(await exec(client), content);
  await new Promise((resolve, reject) => client.shell((error, channel) => {
    if (error) return reject(error);
    channel.once("data", (data) => {
      assert.equal(data.toString(), "echo fixture\n");
      channel.close();
      resolve();
    });
    channel.on("error", reject);
    channel.write("echo fixture\n");
  }));
  await new Promise((resolve, reject) => client.sftp((error, sftp) => {
    if (error) return reject(error);
    sftp.readFile("/fixture", (readError, data) => {
      sftp.end();
      if (readError) return reject(readError);
      assert.deepEqual(data, content);
      resolve();
    });
  }));
  const peer = [...server.peers][0];
  await new Promise((resolve, reject) => peer.rekey((error) => error ? reject(error) : resolve()));
  assert.equal(handshakes.length, 2);
  assert.deepEqual(await exec(client), content);
  assert.deepEqual(errors, []);
  assert.deepEqual(server.errors, []);
});

test("a changed SSH host key is rejected with the ChaCha20 fallback", { timeout: 10000 }, async (t) => {
  const server = await startServer(t, CHACHA);
  await assert.rejects(connect(t, server, CHACHA, { expectedKey: Buffer.alloc(publicHostKey.length) }), /Host denied/);
});

for (const [hopCipher, targetCipher] of [["aes128-ctr", CHACHA], [CHACHA, "aes256-gcm@openssh.com"]]) {
  test(`forwarding and jump-host transport: ${hopCipher} to ${targetCipher}`, { timeout: 15000 }, async (t) => {
    const hop = await startServer(t, hopCipher);
    const target = await startServer(t, targetCipher);
    const outer = await connect(t, hop, hopCipher);
    const sock = await new Promise((resolve, reject) => outer.client.forwardOut("127.0.0.1", 0, "127.0.0.1", target.port, (error, channel) => error ? reject(error) : resolve(channel)));
    const inner = await connect(t, target, targetCipher, { sock });
    assert.equal(outer.handshakes[0].cs.cipher, hopCipher);
    assert.equal(inner.handshakes[0].cs.cipher, targetCipher);
    assert.deepEqual(await exec(inner.client), content);
    assert.deepEqual(outer.errors, []);
    assert.deepEqual(inner.errors, []);
  });
}
