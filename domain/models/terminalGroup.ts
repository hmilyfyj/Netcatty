import type { HostProtocol, TerminalSession } from "./terminal";

export interface TerminalGroup {
  id: string;
  title: string;
  hostId: string;
  hostLabel: string;
  hostname: string;
  username: string;
  protocol?: HostProtocol;
  activeSessionId: string;
  sessionIds: string[];
  nextConsoleIndex: number;
}
