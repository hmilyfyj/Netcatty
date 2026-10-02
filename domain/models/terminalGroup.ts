import type { HostProtocol } from "./connection";

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
