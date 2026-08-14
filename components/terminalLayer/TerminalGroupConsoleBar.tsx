import { Plus, X } from "lucide-react";
import React from "react";

import type { TerminalGroup, TerminalSession } from "../../types";
import { cn } from "../../lib/utils";

export function TerminalGroupConsoleBar({
  group,
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onClose,
  newConsoleLabel,
  consoleLabel,
}: {
  group: TerminalGroup;
  sessions: TerminalSession[];
  activeSessionId?: string;
  onSelect?: (groupId: string, sessionId: string) => void;
  onCreate?: (groupId: string) => void;
  onClose?: (groupId: string, sessionId: string) => void;
  newConsoleLabel: string;
  consoleLabel: (index: number) => string;
}) {
  return (
    <div className="shrink-0 border-b border-border/50 bg-background/95" data-section="terminal-group-tabs">
      <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              type="button"
              className={cn(
                "h-7 px-2 rounded text-xs flex items-center gap-1 shrink-0",
                isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60",
              )}
              onClick={() => onSelect?.(group.id, session.id)}
            >
              <span>{consoleLabel(session.groupConsoleIndex ?? 1)}</span>
              {sessions.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  className="p-0.5 rounded hover:bg-background/80"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose?.(group.id, session.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    onClose?.(group.id, session.id);
                  }}
                >
                  <X size={10} />
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          className="h-7 w-7 rounded text-muted-foreground hover:bg-muted/60 flex items-center justify-center"
          onClick={() => onCreate?.(group.id)}
          title={newConsoleLabel}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
