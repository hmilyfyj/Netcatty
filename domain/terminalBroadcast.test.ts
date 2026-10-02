import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveGlobalBroadcastSessionIds,
  resolveTerminalBroadcastTargetIds,
  shouldBroadcastDuringSensitivePrompt,
} from './terminalBroadcast.ts';
import type { TerminalSession } from './models.ts';

const session = (
  id: string,
  overrides: Pick<TerminalSession, 'workspaceId' | 'hiddenFromTabs'> = {},
): Pick<TerminalSession, 'id' | 'workspaceId' | 'hiddenFromTabs'> => ({
  id,
  ...overrides,
});

test('workspace broadcast targets only other sessions in the source workspace', () => {
  assert.deepEqual(
    resolveTerminalBroadcastTargetIds({
      sessions: [
        session('source', { workspaceId: 'workspace-1' }),
        session('peer', { workspaceId: 'workspace-1' }),
        session('other-workspace', { workspaceId: 'workspace-2' }),
        session('orphan'),
      ],
      sourceSessionId: 'source',
      globalBroadcastEnabled: true,
    }),
    ['peer'],
  );
});

test('global broadcast targets only other visible orphan sessions', () => {
  const sessions = [
    session('source'),
    session('peer'),
    session('workspace-peer', { workspaceId: 'workspace-1' }),
    session('hidden-orphan', { hiddenFromTabs: true }),
  ];

  assert.deepEqual(
    resolveTerminalBroadcastTargetIds({
      sessions,
      sourceSessionId: 'source',
      globalBroadcastEnabled: true,
    }),
    ['peer'],
  );
  assert.deepEqual(
    resolveTerminalBroadcastTargetIds({
      sessions,
      sourceSessionId: 'source',
      globalBroadcastEnabled: false,
    }),
    [],
  );
});

test('global broadcast excludes host-group consoles when group ownership is unknown', () => {
  const sessions = [session('source'), session('peer'), { id: 'group-console', groupId: 'group' }];
  assert.deepEqual(resolveTerminalBroadcastTargetIds({
    sessions, sourceSessionId: 'source', globalBroadcastEnabled: true,
  }), ['peer']);
  assert.deepEqual(resolveTerminalBroadcastTargetIds({
    sessions, sourceSessionId: 'group-console', globalBroadcastEnabled: true,
  }), []);
});

test('global broadcast spans standalone tabs and one active console per host group', () => {
  const sessions = [
    session('local'), { id: 'a', groupId: 'g1' }, { id: 'a-hidden', groupId: 'g1' },
    { id: 'b', groupId: 'g2' }, { id: 'hidden', groupId: 'g3', hiddenFromTabs: true },
    { id: 'workspace', groupId: 'g4', workspaceId: 'ws' },
  ];
  const groups = [
    { id: 'g1', activeSessionId: 'a' }, { id: 'g2', activeSessionId: 'b' },
    { id: 'g3', activeSessionId: 'hidden' }, { id: 'g4', activeSessionId: 'workspace' },
  ];
  assert.deepEqual(resolveGlobalBroadcastSessionIds(sessions, groups), ['local', 'a', 'b']);
  assert.deepEqual(resolveTerminalBroadcastTargetIds({
    sessions, groups, sourceSessionId: 'a', globalBroadcastEnabled: true,
  }), ['local', 'b']);
  assert.deepEqual(resolveTerminalBroadcastTargetIds({
    sessions, groups, sourceSessionId: 'a-hidden', globalBroadcastEnabled: true,
  }), []);
});

test('group console switching immediately changes global broadcast participants', () => {
  const sessions = [{ id: 'a', groupId: 'group' }, { id: 'b', groupId: 'group' }, session('local')];
  assert.deepEqual(resolveTerminalBroadcastTargetIds({
    sessions, groups: [{ id: 'group', activeSessionId: 'a' }], sourceSessionId: 'local', globalBroadcastEnabled: true,
  }), ['a']);
  assert.deepEqual(resolveTerminalBroadcastTargetIds({
    sessions, groups: [{ id: 'group', activeSessionId: 'b' }], sourceSessionId: 'local', globalBroadcastEnabled: true,
  }), ['b']);
  assert.deepEqual(resolveGlobalBroadcastSessionIds(sessions, [{ id: 'other', activeSessionId: 'a' }]), ['local']);
});

test('direct target IDs bypass workspace and global mode selection', () => {
  assert.deepEqual(
    resolveTerminalBroadcastTargetIds({
      sessions: [
        session('source', { workspaceId: 'workspace-1' }),
        session('peer', { workspaceId: 'workspace-1' }),
        session('direct-target'),
      ],
      sourceSessionId: 'source',
      globalBroadcastEnabled: false,
      directTargetSessionIds: ['direct-target'],
    }),
    ['direct-target'],
  );
});

test('missing or hidden global sources do not fan out', () => {
  const sessions = [session('hidden-source', { hiddenFromTabs: true }), session('peer')];
  assert.deepEqual(
    resolveTerminalBroadcastTargetIds({
      sessions,
      sourceSessionId: 'missing',
      globalBroadcastEnabled: true,
    }),
    [],
  );
  assert.deepEqual(
    resolveTerminalBroadcastTargetIds({
      sessions,
      sourceSessionId: 'hidden-source',
      globalBroadcastEnabled: true,
    }),
    [],
  );
});

test('sensitive prompts pause broadcasting unless the password bypass is on', () => {
  assert.equal(
    shouldBroadcastDuringSensitivePrompt({
      sensitivePromptActive: false,
      broadcastPasswordBypass: false,
    }),
    true,
  );
  assert.equal(
    shouldBroadcastDuringSensitivePrompt({
      sensitivePromptActive: true,
      broadcastPasswordBypass: false,
    }),
    false,
  );
  assert.equal(
    shouldBroadcastDuringSensitivePrompt({
      sensitivePromptActive: true,
      broadcastPasswordBypass: true,
    }),
    true,
  );
});
