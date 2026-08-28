#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { getCliDiscoveryFilePath } = require("../electron/cli/discoveryPath.cjs");

function fail(message) {
  process.stderr.write(`[netcatty-mcp-launcher] ${message}\n`);
  process.exit(1);
}

const discoveryFilePath = process.env.NETCATTY_TOOL_CLI_DISCOVERY_FILE || getCliDiscoveryFilePath();

let discovery;
try {
  discovery = JSON.parse(fs.readFileSync(discoveryFilePath, "utf8"));
} catch (err) {
  fail(`Netcatty discovery file is unavailable at ${discoveryFilePath}. Start Netcatty first, then launch the MCP client again.`);
}

if (!discovery?.port || !discovery?.token) {
  fail(`Netcatty discovery file is missing port/token fields: ${discoveryFilePath}`);
}

const serverPath = path.resolve(__dirname, "../electron/mcp/netcatty-mcp-server.cjs");
const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    NETCATTY_MCP_PORT: String(discovery.port),
    NETCATTY_MCP_TOKEN: String(discovery.token),
    ...(process.env.NETCATTY_MCP_SESSION_IDS
      ? { NETCATTY_MCP_SESSION_IDS: process.env.NETCATTY_MCP_SESSION_IDS }
      : {}),
    ...(process.env.NETCATTY_MCP_CHAT_SESSION_ID
      ? { NETCATTY_MCP_CHAT_SESSION_ID: process.env.NETCATTY_MCP_CHAT_SESSION_ID }
      : {}),
    NETCATTY_MCP_PERMISSION_MODE: String(discovery.permissionMode || process.env.NETCATTY_MCP_PERMISSION_MODE || "confirm"),
  },
});

child.on("error", (err) => {
  fail(`Failed to start Netcatty MCP server: ${err?.message || err}`);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
