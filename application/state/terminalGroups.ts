import type { Host, TerminalGroup, TerminalSession } from "../../domain/models";

export const isRemoteGroupableHost = (host: Pick<Host, "protocol">): boolean => (
  host.protocol !== "local" && host.protocol !== "serial"
);

export const createTerminalGroupId = (): string => `group-${crypto.randomUUID()}`;

export function createTerminalGroup(input: {
  id: string;
  host: Pick<Host, "id" | "label" | "hostname" | "username" | "protocol" | "moshEnabled">;
  sessionId: string;
}): TerminalGroup {
  return {
    id: input.id,
    title: input.host.label || input.host.hostname,
    hostId: input.host.id,
    hostLabel: input.host.label,
    hostname: input.host.hostname,
    username: input.host.username,
    protocol: input.host.moshEnabled ? "mosh" : input.host.protocol,
    activeSessionId: input.sessionId,
    sessionIds: [input.sessionId],
    nextConsoleIndex: 2,
  };
}

export function rebuildTerminalGroups(sessions: readonly TerminalSession[]): TerminalGroup[] {
  const byGroup = new Map<string, TerminalSession[]>();
  for (const session of sessions) {
    if (!session.groupId || session.hiddenFromTabs) continue;
    const list = byGroup.get(session.groupId) ?? [];
    list.push(session);
    byGroup.set(session.groupId, list);
  }

  return Array.from(byGroup.entries()).map(([groupId, groupSessions]) => {
    const ordered = [...groupSessions].sort(
      (left, right) => (left.groupConsoleIndex ?? 0) - (right.groupConsoleIndex ?? 0),
    );
    const first = ordered[0];
    const maxIndex = ordered.reduce((max, session) => Math.max(max, session.groupConsoleIndex ?? 0), 0);
    return {
      id: groupId,
      title: first.groupTitle || first.hostLabel,
      hostId: first.hostId,
      hostLabel: first.hostLabel,
      hostname: first.hostname,
      username: first.username,
      protocol: first.protocol,
      activeSessionId: ordered[ordered.length - 1]?.id ?? first.id,
      sessionIds: ordered.map((session) => session.id),
      nextConsoleIndex: maxIndex + 1,
    };
  });
}

export function addConsoleToGroup(
  groups: readonly TerminalGroup[],
  groupId: string,
  sessionId: string,
): TerminalGroup[] {
  return groups.map((group) => (
    group.id === groupId
      ? {
          ...group,
          activeSessionId: sessionId,
          sessionIds: [...group.sessionIds, sessionId],
          nextConsoleIndex: group.nextConsoleIndex + 1,
        }
      : group
  ));
}

export function selectConsoleInGroupState(
  groups: readonly TerminalGroup[],
  groupId: string,
  sessionId: string,
): TerminalGroup[] {
  return groups.map((group) => (
    group.id === groupId && group.sessionIds.includes(sessionId)
      ? { ...group, activeSessionId: sessionId }
      : group
  ));
}

export function removeConsoleFromGroup(
  groups: readonly TerminalGroup[],
  groupId: string,
  sessionId: string,
): { groups: TerminalGroup[]; removedGroup: boolean } {
  const group = groups.find((item) => item.id === groupId);
  if (!group) return { groups: [...groups], removedGroup: false };

  const remaining = group.sessionIds.filter((id) => id !== sessionId);
  if (remaining.length === 0) {
    return {
      groups: groups.filter((item) => item.id !== groupId),
      removedGroup: true,
    };
  }

  const nextActive = group.activeSessionId === sessionId
    ? remaining[Math.max(0, group.sessionIds.indexOf(sessionId) - 1)] || remaining[0]
    : group.activeSessionId;

  return {
    groups: groups.map((item) => (
      item.id === groupId
        ? { ...item, sessionIds: remaining, activeSessionId: nextActive }
        : item
    )),
    removedGroup: false,
  };
}

export function resolveGroupedActiveSession(
  groups: readonly TerminalGroup[],
  sessions: readonly TerminalSession[],
  activeTabId: string | null,
): TerminalSession | undefined {
  if (!activeTabId) return undefined;
  const group = groups.find((item) => item.id === activeTabId);
  if (!group) return sessions.find((session) => session.id === activeTabId);
  return sessions.find((session) => session.id === group.activeSessionId)
    ?? sessions.find((session) => session.groupId === group.id);
}

/** Top-tab id that owns side-panel / SFTP state for a live session. */
export function getSessionSurfaceTabId(
  session: Pick<TerminalSession, "id" | "workspaceId" | "groupId">,
): string {
  return session.workspaceId || session.groupId || session.id;
}

/** Session, workspace, and host-group tab ids that may keep side-panel state. */
export function collectValidTerminalTabIds(params: {
  sessions: ReadonlyArray<Pick<TerminalSession, "id" | "groupId">>;
  workspaces?: ReadonlyArray<{ id: string }>;
  groups?: ReadonlyArray<Pick<TerminalGroup, "id">>;
}): Set<string> {
  const ids = new Set<string>();
  for (const session of params.sessions) {
    ids.add(session.id);
    if (session.groupId) ids.add(session.groupId);
  }
  for (const workspace of params.workspaces ?? []) ids.add(workspace.id);
  for (const group of params.groups ?? []) ids.add(group.id);
  return ids;
}
