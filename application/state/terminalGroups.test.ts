import assert from "node:assert/strict";
import test from "node:test";

import type { TerminalSession } from "../../domain/models";
import {
  addConsoleToGroup,
  createTerminalGroup,
  isRemoteGroupableHost,
  rebuildTerminalGroups,
  removeConsoleFromGroup,
  resolveGroupedActiveSession,
  selectConsoleInGroupState,
} from "./terminalGroups.ts";

const session = (overrides: Partial<TerminalSession> = {}): TerminalSession => ({
  id: "s1",
  hostId: "h1",
  hostLabel: "web",
  hostname: "web.example",
  username: "root",
  status: "connected",
  protocol: "ssh",
  ...overrides,
});

test("remote ssh hosts are groupable; local and serial are not", () => {
  assert.equal(isRemoteGroupableHost({ protocol: "ssh" }), true);
  assert.equal(isRemoteGroupableHost({ protocol: "local" }), false);
  assert.equal(isRemoteGroupableHost({ protocol: "serial" }), false);
});

test("rebuildTerminalGroups collects consoles by groupId", () => {
  const groups = rebuildTerminalGroups([
    session({ id: "a", groupId: "g1", groupConsoleIndex: 2, groupTitle: "web" }),
    session({ id: "b", groupId: "g1", groupConsoleIndex: 1, groupTitle: "web" }),
    session({ id: "c" }),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].sessionIds, ["b", "a"]);
  assert.equal(groups[0].nextConsoleIndex, 3);
  assert.equal(groups[0].title, "web");
});

test("add and remove consoles keep the group tab until the last one", () => {
  const group = createTerminalGroup({
    id: "g1",
    host: { id: "h1", label: "web", hostname: "web.example", username: "root", protocol: "ssh" },
    sessionId: "s1",
  });
  const withSecond = addConsoleToGroup([group], "g1", "s2");
  assert.deepEqual(withSecond[0].sessionIds, ["s1", "s2"]);
  assert.equal(withSecond[0].activeSessionId, "s2");
  const selected = selectConsoleInGroupState(withSecond, "g1", "s1");
  assert.equal(selected[0].activeSessionId, "s1");
  const afterOne = removeConsoleFromGroup(selected, "g1", "s1");
  assert.equal(afterOne.removedGroup, false);
  assert.deepEqual(afterOne.groups[0].sessionIds, ["s2"]);
  const afterLast = removeConsoleFromGroup(afterOne.groups, "g1", "s2");
  assert.equal(afterLast.removedGroup, true);
  assert.equal(afterLast.groups.length, 0);
});

test("resolveGroupedActiveSession prefers the group's active console", () => {
  const groups = [createTerminalGroup({
    id: "g1",
    host: { id: "h1", label: "web", hostname: "web.example", username: "root", protocol: "ssh" },
    sessionId: "s1",
  })];
  const sessions = [session({ id: "s1", groupId: "g1" }), session({ id: "s2", groupId: "g1" })];
  const active = resolveGroupedActiveSession(groups, sessions, "g1");
  assert.equal(active?.id, "s1");
});
