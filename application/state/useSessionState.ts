import { MouseEvent,useCallback,useMemo,useState } from 'react';
import { ConnectionLog,Host,SerialConfig,Snippet,TerminalGroup,TerminalSession,Workspace,WorkspaceViewMode } from '../../domain/models';
import {
collectSessionIds,
createWorkspaceFromSessions as createWorkspaceEntity,
createWorkspaceFromSessionIds,
FocusDirection,
getNextFocusSessionId,
insertPaneIntoWorkspace,
pruneWorkspaceNode,
SplitDirection,
SplitHint,
updateWorkspaceSplitSizes,
} from '../../domain/workspace';
import { activeTabStore } from './activeTabStore';

// LogView represents an open log replay tab
export interface LogView {
  id: string; // Tab ID (log-${connectionLogId})
  connectionLogId: string;
  log: ConnectionLog;
}

const isRemoteGroupableHost = (host: Host) => host.protocol !== 'local' && host.protocol !== 'serial';
const createSessionFromHost = (host: Host, extras: Partial<TerminalSession> = {}): TerminalSession => ({
  id: crypto.randomUUID(),
  hostId: host.id,
  hostLabel: host.label,
  hostname: host.hostname,
  username: host.username,
  status: 'connecting',
  protocol: host.protocol,
  port: host.port,
  moshEnabled: host.moshEnabled,
  charset: host.charset,
  ...extras,
});

const cloneSessionConnection = (
  session: TerminalSession,
  extras: Partial<TerminalSession> = {},
): TerminalSession => ({
  id: crypto.randomUUID(),
  hostId: session.hostId,
  hostLabel: session.hostLabel,
  hostname: session.hostname,
  username: session.username,
  status: 'connecting',
  protocol: session.protocol,
  port: session.port,
  moshEnabled: session.moshEnabled,
  shellType: session.shellType,
  charset: session.charset,
  serialConfig: session.serialConfig,
  localShell: session.localShell,
  localShellArgs: session.localShellArgs,
  localShellName: session.localShellName,
  localShellIcon: session.localShellIcon,
  ...extras,
});

export const useSessionState = () => {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [groups, setGroups] = useState<TerminalGroup[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  // activeTabId is now managed by external store - components subscribe directly
  const setActiveTabId = activeTabStore.setActiveTabId;
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null);
  const [sessionRenameTarget, setSessionRenameTarget] = useState<TerminalSession | null>(null);
  const [sessionRenameValue, setSessionRenameValue] = useState('');
  const [workspaceRenameTarget, setWorkspaceRenameTarget] = useState<Workspace | null>(null);
  const [workspaceRenameValue, setWorkspaceRenameValue] = useState('');
  // Tab order: stores ordered list of tab IDs (orphan session IDs and workspace IDs)
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  // Broadcast mode: stores workspace IDs that have broadcast enabled
  const [broadcastWorkspaceIds, setBroadcastWorkspaceIds] = useState<Set<string>>(new Set());
  // Log views: stores open log replay tabs
  const [logViews, setLogViews] = useState<LogView[]>([]);

  const createLocalTerminal = useCallback((options?: {
    shellType?: TerminalSession['shellType'];
    shell?: string;
    shellArgs?: string[];
    shellName?: string;
    shellIcon?: string;
  }) => {
    const sessionId = crypto.randomUUID();
    const localHostId = `local-${sessionId}`;
    const newSession: TerminalSession = {
      id: sessionId,
      hostId: localHostId,
      hostLabel: options?.shellName || 'Local Terminal',
      hostname: 'localhost',
      username: 'local',
      status: 'connecting',
      protocol: 'local',
      shellType: options?.shellType,
      localShell: options?.shell,
      localShellArgs: options?.shellArgs,
      localShellName: options?.shellName,
      localShellIcon: options?.shellIcon,
    };
    setSessions(prev => [...prev, newSession]);
    setActiveTabId(sessionId);
    return sessionId;
  }, [setActiveTabId]);

  const createSerialSession = useCallback((config: SerialConfig, options?: { charset?: string }) => {
    const sessionId = crypto.randomUUID();
    const serialHostId = `serial-${sessionId}`;
    const portName = config.path.split('/').pop() || config.path;
    const newSession: TerminalSession = {
      id: sessionId,
      hostId: serialHostId,
      hostLabel: `Serial: ${portName}`,
      hostname: config.path,
      username: '',
      status: 'connecting',
      protocol: 'serial',
      serialConfig: config,
      charset: options?.charset,
    };
    setSessions(prev => [...prev, newSession]);
    setActiveTabId(sessionId);
    return sessionId;
  }, [setActiveTabId]);

  const connectToHost = useCallback((host: Host) => {
    // Handle serial hosts specially - use createSerialSession for them
    if (host.protocol === 'serial') {
      // Use stored serialConfig or construct from host data
      const serialConfig: SerialConfig = host.serialConfig || {
        path: host.hostname,
        baudRate: host.port || 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        localEcho: false,
        lineMode: false,
      };
      
      const sessionId = crypto.randomUUID();
      const portName = serialConfig.path.split('/').pop() || serialConfig.path;
      const newSession: TerminalSession = {
        id: sessionId,
        hostId: host.id,
        hostLabel: host.label || `Serial: ${portName}`,
        hostname: serialConfig.path,
        username: '',
        status: 'connecting',
        protocol: 'serial',
        serialConfig: serialConfig,
        charset: host.charset,
      };
      setSessions(prev => [...prev, newSession]);
      setActiveTabId(sessionId);
      return sessionId;
    }

    if (isRemoteGroupableHost(host)) {
      const groupId = `group-${crypto.randomUUID()}`;
      const initialSession = createSessionFromHost(host, {
        groupId,
        groupConsoleIndex: 1,
      });
      const newGroup: TerminalGroup = {
        id: groupId,
        title: host.label,
        hostId: host.id,
        hostLabel: host.label,
        hostname: host.hostname,
        username: host.username,
        protocol: host.moshEnabled ? 'mosh' : host.protocol,
        activeSessionId: initialSession.id,
        sessionIds: [initialSession.id],
        nextConsoleIndex: 2,
      };
      setGroups(prev => [...prev, newGroup]);
      setSessions(prev => [...prev, initialSession]);
      setActiveTabId(groupId);
      return initialSession.id;
    }

    const newSession = createSessionFromHost(host);
    setSessions(prev => [...prev, newSession]);
    setActiveTabId(newSession.id);
    return newSession.id;
  }, [setActiveTabId]);

  const updateSessionStatus = useCallback((sessionId: string, status: TerminalSession['status']) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status } : s));
  }, []);

  const updateSessionConnectionMeta = useCallback((
    sessionId: string,
    meta: Pick<TerminalSession, 'transportId' | 'channelId'>,
  ) => {
    setSessions(prev => {
      const targetSession = prev.find(session => session.id === sessionId);
      if (!targetSession) return prev;

      return prev.map(session => {
        if (session.id === sessionId) {
          return { ...session, ...meta };
        }
        if (meta.transportId && targetSession.groupId && session.groupId === targetSession.groupId && !session.transportId) {
          return { ...session, transportId: meta.transportId };
        }
        return session;
      });
    });
  }, []);

  const selectConsoleInGroup = useCallback((groupId: string, sessionId: string) => {
    setGroups(prev => prev.map(group => (
      group.id === groupId
        ? { ...group, activeSessionId: sessionId }
        : group
    )));
    setActiveTabId(groupId);
  }, [setActiveTabId]);

  const createConsoleInGroup = useCallback((groupId: string, baseSessionId?: string, options?: {
    localShellType?: TerminalSession['shellType'];
  }) => {
    const group = groups.find(item => item.id === groupId);
    if (!group) return null;

    const baseSession = sessions.find(session =>
      session.id === (baseSessionId || group.activeSessionId || group.sessionIds[0]),
    );
    if (!baseSession) return null;

    const sharedTransportId = baseSession.transportId
      || sessions.find(session => session.groupId === groupId && session.transportId)?.transportId;

    const nextShellType = baseSession.protocol === 'local'
      ? options?.localShellType
      : baseSession.shellType;
    const newSession = cloneSessionConnection(baseSession, {
      groupId,
      groupConsoleIndex: group.nextConsoleIndex,
      transportId: sharedTransportId,
      channelId: undefined,
      shellType: nextShellType,
    });

    setSessions(prev => [...prev, newSession]);
    setGroups(prev => prev.map(item => (
      item.id === groupId
        ? {
            ...item,
            activeSessionId: newSession.id,
            sessionIds: [...item.sessionIds, newSession.id],
            nextConsoleIndex: item.nextConsoleIndex + 1,
          }
        : item
    )));
    setActiveTabId(groupId);
    return newSession.id;
  }, [groups, sessions, setActiveTabId]);

  const closeGroup = useCallback((groupId: string) => {
    const group = groups.find(item => item.id === groupId);
    if (!group) return;

    setSessions(prev => prev.filter(session => session.groupId !== groupId));
    setGroups(prev => prev.filter(item => item.id !== groupId));

    const currentActiveTabId = activeTabStore.getActiveTabId();
    if (currentActiveTabId === groupId) {
      const fallbackGroup = groups.filter(item => item.id !== groupId).slice(-1)[0];
      const fallbackWorkspace = workspaces[workspaces.length - 1];
      const fallbackSolo = sessions
        .filter(session => !session.workspaceId && !session.groupId && !group.sessionIds.includes(session.id))
        .slice(-1)[0];
      setActiveTabId(fallbackGroup?.id || fallbackWorkspace?.id || fallbackSolo?.id || 'vault');
    }
  }, [groups, sessions, workspaces, setActiveTabId]);

  const closeConsoleInGroup = useCallback((groupId: string, sessionId: string) => {
    const group = groups.find(item => item.id === groupId);
    if (!group) return;

    const remainingSessionIds = group.sessionIds.filter(id => id !== sessionId);
    if (remainingSessionIds.length === 0) {
      closeGroup(groupId);
      return;
    }

    const nextActiveSessionId = group.activeSessionId === sessionId
      ? remainingSessionIds[Math.max(0, group.sessionIds.indexOf(sessionId) - 1)] || remainingSessionIds[0]
      : group.activeSessionId;

    setSessions(prev => prev.filter(session => session.id !== sessionId));
    setGroups(prev => prev.map(item => (
      item.id === groupId
        ? {
            ...item,
            sessionIds: remainingSessionIds,
            activeSessionId: nextActiveSessionId,
          }
        : item
    )));

    if (activeTabStore.getActiveTabId() === groupId) {
      setActiveTabId(groupId);
    }
  }, [closeGroup, groups, setActiveTabId]);

  const closeWorkspace = useCallback((workspaceId: string) => {
    setWorkspaces(prevWorkspaces => {
      const remainingWorkspaces = prevWorkspaces.filter(w => w.id !== workspaceId);

      setSessions(prevSessions => prevSessions.filter(s => s.workspaceId !== workspaceId));

      const currentActiveTabId = activeTabStore.getActiveTabId();
      if (currentActiveTabId === workspaceId) {
        if (remainingWorkspaces.length > 0) {
          setActiveTabId(remainingWorkspaces[remainingWorkspaces.length - 1].id);
        } else {
          setActiveTabId('vault');
        }
      }

      return remainingWorkspaces;
    });
  }, [groups, logViews, sessions, setActiveTabId]);

  const closeSession = useCallback((sessionId: string, e?: MouseEvent) => {
    e?.stopPropagation();

    const targetGroupSession = sessions.find(session => session.id === sessionId && session.groupId);
    if (targetGroupSession?.groupId) {
      closeConsoleInGroup(targetGroupSession.groupId, sessionId);
      return;
    }

    // Pre-compute outside the setSessions updater so we don't depend on React
    // having run the updater by the time we queue the microtask. React 18+ does
    // not guarantee updater execution timing under concurrent scheduling.
    const sessionBeingClosed = sessions.find(s => s.id === sessionId);
    const workspaceIdToMaybeClose =
      sessionBeingClosed?.workspaceId &&
      sessions.every(s => s.id === sessionId || s.workspaceId !== sessionBeingClosed.workspaceId)
        ? sessionBeingClosed.workspaceId
        : undefined;

    setSessions(prevSessions => {
      const targetSession = prevSessions.find(s => s.id === sessionId);
      const wsId = targetSession?.workspaceId;

      setWorkspaces(prevWorkspaces => {
        let removedWorkspaceId: string | null = null;
        let nextWorkspaces = prevWorkspaces;
        let dissolvedWorkspaceId: string | null = null;
        let lastRemainingSessionId: string | null = null;

        if (wsId) {
          nextWorkspaces = prevWorkspaces
            .map(ws => {
              if (ws.id !== wsId) return ws;
              const pruned = pruneWorkspaceNode(ws.root, sessionId);
              if (!pruned) {
                removedWorkspaceId = ws.id;
                return null;
              }

              // Check if only 1 session remains - dissolve workspace
              const remainingSessionIds = collectSessionIds(pruned);
              if (remainingSessionIds.length === 1) {
                dissolvedWorkspaceId = ws.id;
                lastRemainingSessionId = remainingSessionIds[0];
                return null;
              }

              return { ...ws, root: pruned };
            })
            .filter((ws): ws is Workspace => Boolean(ws));
        }

        const remainingSessions = prevSessions.filter(s => s.id !== sessionId);
        const fallbackGroup = groups[groups.length - 1];
        const fallbackWorkspace = nextWorkspaces[nextWorkspaces.length - 1];
        const fallbackSolo = remainingSessions.filter(s => !s.workspaceId && !s.groupId).slice(-1)[0];

        const currentActiveTabId = activeTabStore.getActiveTabId();
        const getFallback = () => {
          if (lastRemainingSessionId) return lastRemainingSessionId;
          if (fallbackGroup) return fallbackGroup.id;
          if (fallbackWorkspace) return fallbackWorkspace.id;
          if (fallbackSolo) return fallbackSolo.id;
          return 'vault';
        };

        if (dissolvedWorkspaceId && currentActiveTabId === dissolvedWorkspaceId) {
          setActiveTabId(getFallback());
        } else if (currentActiveTabId === sessionId) {
          setActiveTabId(getFallback());
        } else if (removedWorkspaceId && currentActiveTabId === removedWorkspaceId) {
          setActiveTabId(getFallback());
        } else if (wsId && currentActiveTabId === wsId && !nextWorkspaces.find(w => w.id === wsId)) {
          setActiveTabId(getFallback());
        }

        return nextWorkspaces;
      });

      // Check if we need to dissolve a workspace (convert remaining session to orphan)
      if (targetSession?.workspaceId) {
        const ws = workspaces.find(w => w.id === targetSession.workspaceId);
        if (ws) {
          const pruned = pruneWorkspaceNode(ws.root, sessionId);
          if (pruned) {
            const remainingSessionIds = collectSessionIds(pruned);
            if (remainingSessionIds.length === 1) {
              // Dissolve: remove workspaceId from the remaining session
              return prevSessions
                .filter(s => s.id !== sessionId)
                .map(s => remainingSessionIds.includes(s.id) ? { ...s, workspaceId: undefined } : s);
            }
          }
        }
      }

      return prevSessions.filter(s => s.id !== sessionId);
    });

    if (workspaceIdToMaybeClose) {
      queueMicrotask(() => closeWorkspace(workspaceIdToMaybeClose));
    }
  }, [closeConsoleInGroup, groups, sessions, workspaces, setActiveTabId, closeWorkspace]);

  const startSessionRename = useCallback((sessionId: string) => {
    setSessions(prevSessions => {
      const target = prevSessions.find(s => s.id === sessionId);
      if (target) {
        setSessionRenameTarget(target);
        setSessionRenameValue(target.hostLabel);
      }
      return prevSessions;
    });
  }, []);

  const submitSessionRename = useCallback(() => {
    setSessionRenameValue(prevValue => {
      const name = prevValue.trim();
      if (!name) return prevValue;

      setSessionRenameTarget(prevTarget => {
        if (!prevTarget) return prevTarget;
        setSessions(prev => prev.map(s => s.id === prevTarget.id ? { ...s, hostLabel: name } : s));
        return null;
      });

      return '';
    });
  }, []);

  const resetSessionRename = useCallback(() => {
    setSessionRenameTarget(null);
    setSessionRenameValue('');
  }, []);

  const startWorkspaceRename = useCallback((workspaceId: string) => {
    setWorkspaces(prevWorkspaces => {
      const target = prevWorkspaces.find(w => w.id === workspaceId);
      if (target) {
        setWorkspaceRenameTarget(target);
        setWorkspaceRenameValue(target.title);
      }
      return prevWorkspaces;
    });
  }, []);

  const submitWorkspaceRename = useCallback(() => {
    setWorkspaceRenameValue(prevValue => {
      const name = prevValue.trim();
      if (!name) return prevValue;
      
      setWorkspaceRenameTarget(prevTarget => {
        if (!prevTarget) return prevTarget;
        setWorkspaces(prev => prev.map(w => w.id === prevTarget.id ? { ...w, title: name } : w));
        return null;
      });
      
      return '';
    });
  }, []);

  const resetWorkspaceRename = useCallback(() => {
    setWorkspaceRenameTarget(null);
    setWorkspaceRenameValue('');
  }, []);

  const createWorkspaceWithHosts = useCallback((name: string, hosts: Host[]) => {
    if (hosts.length === 0) return;

    // Create sessions for each host
    const newSessions: TerminalSession[] = hosts.map(host => {
      // Handle serial hosts specially
      if (host.protocol === 'serial') {
        const serialConfig: SerialConfig = host.serialConfig || {
          path: host.hostname,
          baudRate: host.port || 115200,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none',
          localEcho: false,
          lineMode: false,
        };

        const portName = serialConfig.path.split('/').pop() || serialConfig.path;
        return {
          id: crypto.randomUUID(),
          hostId: host.id,
          hostLabel: host.label || `Serial: ${portName}`,
          hostname: serialConfig.path,
          username: '',
          status: 'connecting',
          protocol: 'serial',
          serialConfig: serialConfig,
          charset: host.charset,
        };
      }

      return {
        id: crypto.randomUUID(),
        hostId: host.id,
        hostLabel: host.label,
        hostname: host.hostname,
        username: host.username,
        status: 'connecting',
        protocol: host.protocol,
        port: host.port,
        moshEnabled: host.moshEnabled,
        charset: host.charset,
      };
    });

    const sessionIds = newSessions.map(s => s.id);

    // Create workspace
    const workspace = createWorkspaceFromSessionIds(sessionIds, {
      title: name,
      viewMode: 'split',
    });

    // Assign workspaceId to sessions
    const sessionsWithWorkspace = newSessions.map(s => ({
      ...s,
      workspaceId: workspace.id
    }));

    setSessions(prev => [...prev, ...sessionsWithWorkspace]);
    setWorkspaces(prev => [...prev, workspace]);
    setActiveTabId(workspace.id);
  }, [setActiveTabId]);

  const createWorkspaceFromSessions = useCallback((
    baseSessionId: string,
    joiningSessionId: string,
    hint: SplitHint
  ) => {
    if (!hint || baseSessionId === joiningSessionId) return;
    
	    setSessions(prevSessions => {
      const base = prevSessions.find(s => s.id === baseSessionId);
      const joining = prevSessions.find(s => s.id === joiningSessionId);
      if (!base || !joining || base.workspaceId || joining.workspaceId || base.groupId || joining.groupId) return prevSessions;

      const newWorkspace = createWorkspaceEntity(baseSessionId, joiningSessionId, hint);
      setWorkspaces(prev => [...prev, newWorkspace]);
      setActiveTabId(newWorkspace.id);
      
      return prevSessions.map(s => {
        if (s.id === baseSessionId || s.id === joiningSessionId) {
          return { ...s, workspaceId: newWorkspace.id };
        }
        return s;
      });
	    });
	  }, [setActiveTabId]);

  const addSessionToWorkspace = useCallback((
    workspaceId: string,
    sessionId: string,
    hint: SplitHint
  ) => {
    if (!hint) return;
    
	    setSessions(prevSessions => {
      const session = prevSessions.find(s => s.id === sessionId);
      if (!session || session.workspaceId || session.groupId) return prevSessions;
      
      setWorkspaces(prevWorkspaces => {
        const targetWorkspace = prevWorkspaces.find(w => w.id === workspaceId);
        if (!targetWorkspace) return prevWorkspaces;
        
        return prevWorkspaces.map(ws => {
          if (ws.id !== workspaceId) return ws;
          return { ...ws, root: insertPaneIntoWorkspace(ws.root, sessionId, hint) };
        });
      });
      
      setActiveTabId(workspaceId);
      return prevSessions.map(s => s.id === sessionId ? { ...s, workspaceId } : s);
	    });
	  }, [setActiveTabId]);

  const updateSplitSizes = useCallback((workspaceId: string, splitId: string, sizes: number[]) => {
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== workspaceId) return ws;
      return { ...ws, root: updateWorkspaceSplitSizes(ws.root, splitId, sizes) };
    }));
  }, []);

  // Split a session to create a workspace with the same host connection
  // direction: 'horizontal' = split top/bottom, 'vertical' = split left/right
  const splitSession = useCallback((
    sessionId: string,
    direction: SplitDirection,
    options?: {
      localShellType?: TerminalSession['shellType'];
    },
  ) => {
	    setSessions(prevSessions => {
      const session = prevSessions.find(s => s.id === sessionId);
      if (!session) return prevSessions;
      if (session.groupId) return prevSessions;
      const nextShellType = session.protocol === 'local'
        ? options?.localShellType
        : session.shellType;
      
      // If session is already in a workspace, split within that workspace
      if (session.workspaceId) {
        // Create a new session with the same host
        const newSession: TerminalSession = {
          id: crypto.randomUUID(),
          hostId: session.hostId,
          hostLabel: session.hostLabel,
          hostname: session.hostname,
          username: session.username,
          status: 'connecting',
          workspaceId: session.workspaceId,
          protocol: session.protocol,
          port: session.port,
          moshEnabled: session.moshEnabled,
          shellType: nextShellType,
          charset: session.charset,
          localShell: session.localShell,
          localShellArgs: session.localShellArgs,
          localShellName: session.localShellName,
          localShellIcon: session.localShellIcon,
        };

        // Add pane to existing workspace
        const hint: SplitHint = {
          direction,
          position: direction === 'horizontal' ? 'bottom' : 'right',
          targetSessionId: sessionId,
        };
        
        setWorkspaces(prevWorkspaces => {
          return prevWorkspaces.map(ws => {
            if (ws.id !== session.workspaceId) return ws;
            return { ...ws, root: insertPaneIntoWorkspace(ws.root, newSession.id, hint) };
          });
        });
        
        return [...prevSessions, newSession];
      }
      
      // Session is standalone - create a new workspace
      const newSession: TerminalSession = {
        id: crypto.randomUUID(),
        hostId: session.hostId,
        hostLabel: session.hostLabel,
        hostname: session.hostname,
        username: session.username,
        status: 'connecting',
        protocol: session.protocol,
        port: session.port,
        moshEnabled: session.moshEnabled,
        shellType: nextShellType,
        charset: session.charset,
        localShell: session.localShell,
        localShellArgs: session.localShellArgs,
        localShellName: session.localShellName,
        localShellIcon: session.localShellIcon,
      };

      const hint: SplitHint = {
        direction,
        position: direction === 'horizontal' ? 'bottom' : 'right',
      };

      const newWorkspace = createWorkspaceEntity(sessionId, newSession.id, hint);
      setWorkspaces(prev => [...prev, newWorkspace]);
      setActiveTabId(newWorkspace.id);
      
      return prevSessions.map(s => {
        if (s.id === sessionId) {
          return { ...s, workspaceId: newWorkspace.id };
        }
        return s;
      }).concat({ ...newSession, workspaceId: newWorkspace.id });
	    });
	  }, [setActiveTabId]);

  // Toggle workspace view mode between split and focus
  const toggleWorkspaceViewMode = useCallback((workspaceId: string) => {
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== workspaceId) return ws;
      const currentMode = ws.viewMode || 'split';
      const newMode: WorkspaceViewMode = currentMode === 'split' ? 'focus' : 'split';
      // If switching to focus mode and no focused session, pick the first one
      let focusedSessionId = ws.focusedSessionId;
      if (newMode === 'focus' && !focusedSessionId) {
        const sessionIds = collectSessionIds(ws.root);
        focusedSessionId = sessionIds[0];
      }
      return { ...ws, viewMode: newMode, focusedSessionId };
    }));
  }, []);

  // Set the focused session in a workspace (for focus mode)
  const setWorkspaceFocusedSession = useCallback((workspaceId: string, sessionId: string) => {
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== workspaceId) return ws;
      return { ...ws, focusedSessionId: sessionId };
    }));
  }, []);

  // Move focus between panes in a workspace
  const moveFocusInWorkspace = useCallback((workspaceId: string, direction: FocusDirection): boolean => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) {
      return false;
    }
    
    // Get current focused session, or first session if none focused
    const sessionIds = collectSessionIds(workspace.root);
    
    const currentFocused = workspace.focusedSessionId || sessionIds[0];
    if (!currentFocused) {
      return false;
    }
    
    // Find the next session in the given direction
    const nextSessionId = getNextFocusSessionId(workspace.root, currentFocused, direction);
    
    if (!nextSessionId) {
      return false;
    }
    
    // Update focused session
    setWorkspaces(prev => prev.map(ws => {
      if (ws.id !== workspaceId) return ws;
      return { ...ws, focusedSessionId: nextSessionId };
    }));
    
    return true;
  }, [workspaces]);

  // Run a snippet on multiple target hosts - creates a focus mode workspace
  const runSnippet = useCallback((snippet: Snippet, targetHosts: Host[]) => {
    if (targetHosts.length === 0) return;

    // Create sessions for each target host
    const newSessions: TerminalSession[] = targetHosts.map(host => ({
      id: crypto.randomUUID(),
      hostId: host.id,
      hostLabel: host.label,
      hostname: host.hostname,
      username: host.username,
      status: 'connecting' as const,
      charset: host.charset,
      // workspaceId will be set after workspace is created
    }));

    const sessionIds = newSessions.map(s => s.id);
    
    // Create a focus mode workspace
    const workspace = createWorkspaceFromSessionIds(sessionIds, {
      title: snippet.label,
      viewMode: 'focus',
      snippetId: snippet.id,
    });

    // Update sessions with workspaceId
    const sessionsWithWorkspace = newSessions.map(s => ({
      ...s,
      workspaceId: workspace.id,
      // Store the command to run after connection
      startupCommand: snippet.command,
      noAutoRun: snippet.noAutoRun,
    }));

	    setSessions(prev => [...prev, ...sessionsWithWorkspace]);
	    setWorkspaces(prev => [...prev, workspace]);
	    setActiveTabId(workspace.id);
	  }, [setActiveTabId]);

  const orphanSessions = useMemo(() => sessions.filter(s => !s.workspaceId && !s.groupId), [sessions]);

  // Open a log view tab
  const openLogView = useCallback((log: ConnectionLog) => {
    const tabId = `log-${log.id}`;
    // Check if already open
    setLogViews(prev => {
      if (prev.some(lv => lv.connectionLogId === log.id)) {
        // Already open, just switch to it
        setActiveTabId(tabId);
        return prev;
      }
      // Open new log view
      const newLogView: LogView = {
        id: tabId,
        connectionLogId: log.id,
        log,
      };
      setActiveTabId(tabId);
      return [...prev, newLogView];
    });
  }, [setActiveTabId]);

  // Close a log view tab
  const closeLogView = useCallback((logViewId: string) => {
    setLogViews(prev => {
      const updated = prev.filter(lv => lv.id !== logViewId);
      // If this was the active tab, switch to vault
      const currentActiveTabId = activeTabStore.getActiveTabId();
      if (currentActiveTabId === logViewId) {
        const fallback = updated.length > 0
          ? updated[updated.length - 1].id
          : groups[groups.length - 1]?.id
            || workspaces[workspaces.length - 1]?.id
            || orphanSessions[orphanSessions.length - 1]?.id
            || 'vault';
        setActiveTabId(fallback);
      }
      return updated;
    });
  }, [groups, orphanSessions, setActiveTabId, workspaces]);

  // Copy a session - creates a new session with the same host connection
  const copySession = useCallback((sessionId: string, options?: {
    localShellType?: TerminalSession['shellType'];
  }) => {
    const groupedSession = sessions.find(session => session.id === sessionId && session.groupId);
    if (groupedSession?.groupId) {
      return createConsoleInGroup(groupedSession.groupId, sessionId, options);
    }

    setSessions(prevSessions => {
      const session = prevSessions.find(s => s.id === sessionId);
      if (!session) return prevSessions;
      const nextShellType = session.protocol === 'local'
        ? options?.localShellType
        : session.shellType;

      // Create a new session with the same connection info
      const newSession = cloneSessionConnection(session, {
        shellType: nextShellType,
      });

      setActiveTabId(newSession.id);
      return [...prevSessions, newSession];
    });
    return null;
  }, [createConsoleInGroup, sessions, setActiveTabId]);

  // Toggle broadcast mode for a workspace
  const toggleBroadcast = useCallback((workspaceId: string) => {
    setBroadcastWorkspaceIds(prev => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  }, []);

  // Check if a workspace has broadcast enabled
  const isBroadcastEnabled = useCallback((workspaceId: string) => {
    return broadcastWorkspaceIds.has(workspaceId);
  }, [broadcastWorkspaceIds]);

  // Get ordered tabs: combines orphan sessions, workspaces, and log views in the custom order
  const orderedTabs = useMemo(() => {
    const allTabIds = [
      ...groups.map(group => group.id),
      ...orphanSessions.map(s => s.id),
      ...workspaces.map(w => w.id),
      ...logViews.map(lv => lv.id),
    ];
    const allTabIdSet = new Set(allTabIds);
    // Filter tabOrder to only include existing tabs, then add any new tabs at the end
    const orderedIds = tabOrder.filter(id => allTabIdSet.has(id));
    const orderedIdSet = new Set(orderedIds);
    const newIds = allTabIds.filter(id => !orderedIdSet.has(id));
    return [...orderedIds, ...newIds];
  }, [groups, orphanSessions, workspaces, logViews, tabOrder]);

  const reorderTabs = useCallback((draggedId: string, targetId: string, position: 'before' | 'after' = 'before') => {
    if (draggedId === targetId) return;
    
    setTabOrder(prevTabOrder => {
      // Get all current tab IDs (orphan sessions + workspaces + log views)
      const allTabIds = [
        ...groups.map(group => group.id),
        ...orphanSessions.map(s => s.id),
        ...workspaces.map(w => w.id),
        ...logViews.map(lv => lv.id),
      ];
      const allTabIdSet = new Set(allTabIds);
      
      // Build current effective order: existing order + new tabs at end
      const orderedIds = prevTabOrder.filter(id => allTabIdSet.has(id));
      const orderedIdSet = new Set(orderedIds);
      const newIds = allTabIds.filter(id => !orderedIdSet.has(id));
      const currentOrder = [...orderedIds, ...newIds];
      
      const draggedIndex = currentOrder.indexOf(draggedId);
      const targetIndex = currentOrder.indexOf(targetId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prevTabOrder;
      
      // Remove dragged item first
      currentOrder.splice(draggedIndex, 1);
      
      // Calculate new target index (adjusted after removal)
      let newTargetIndex = targetIndex;
      if (draggedIndex < targetIndex) {
        newTargetIndex -= 1;
      }
      
      // Insert at the correct position
      if (position === 'after') {
        newTargetIndex += 1;
      }
      
      currentOrder.splice(newTargetIndex, 0, draggedId);
      
      return currentOrder;
    });
  }, [groups, orphanSessions, workspaces, logViews]);

  return {
    sessions,
    groups,
    workspaces,
    // activeTabId removed - components should subscribe via useActiveTabId() from activeTabStore
    setActiveTabId,
    draggingSessionId,
    setDraggingSessionId,
    sessionRenameTarget,
    sessionRenameValue,
    setSessionRenameValue,
    startSessionRename,
    submitSessionRename,
    resetSessionRename,
    workspaceRenameTarget,
    workspaceRenameValue,
    setWorkspaceRenameValue,
    startWorkspaceRename,
    submitWorkspaceRename,
    resetWorkspaceRename,
    createLocalTerminal,
    createSerialSession,
    connectToHost,
    createConsoleInGroup,
    selectConsoleInGroup,
    closeConsoleInGroup,
    closeSession,
    closeGroup,
    closeWorkspace,
    updateSessionStatus,
    updateSessionConnectionMeta,
    createWorkspaceWithHosts,
    createWorkspaceFromSessions,
    addSessionToWorkspace,
    updateSplitSizes,
    splitSession,
    toggleWorkspaceViewMode,
    setWorkspaceFocusedSession,
    moveFocusInWorkspace,
    runSnippet,
    orphanSessions,
    // Broadcast mode
    toggleBroadcast,
    isBroadcastEnabled,
    orderedTabs,
    reorderTabs,
    // Log views
    logViews,
    openLogView,
    closeLogView,
    // Copy session
    copySession,
  };
};
