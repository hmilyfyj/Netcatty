/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { memo } from 'react';

import { TerminalGroupConsoleBar } from './TerminalGroupConsoleBar';
import { TerminalLayerFocusSidebarSection } from './TerminalLayerFocusSidebarSection';
import { TerminalLayerSidePanelSection } from './TerminalLayerSidePanelSection';
import { TerminalLayerWorkspaceSection } from './TerminalLayerWorkspaceSection';
import { terminalLayerViewCtxEqual } from './terminalLayerViewMemo';
import { useTerminalHostTreeLayoutWidth } from '../../application/state/terminalHostTreeStore';
import { resolveTerminalLayerSurfaceStyle } from '../terminalPaneVisibility';

type TerminalLayerViewContext = Record<string, any>;

function TerminalLayerViewInner({ ctx }: { ctx: TerminalLayerViewContext }) {
  const hostTreeLayoutWidth = useTerminalHostTreeLayoutWidth();
  const surfaceStyle = resolveTerminalLayerSurfaceStyle(
    ctx.isTerminalLayerVisible,
    ctx.hibernateHiddenTabs,
  );

  return (
    <div
      ref={ctx.workspaceOuterRef}
      className="absolute inset-0 bg-background flex min-h-0"
      data-section="terminal-workspace"
      inert={ctx.isTerminalLayerVisible ? undefined : true}
      style={{
        ...surfaceStyle,
        left: hostTreeLayoutWidth,
      }}
    >
      <TerminalLayerSidePanelSection ctx={ctx} />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {ctx.activeGroup && ctx.activeGroupSessions?.length > 0 && (
          <TerminalGroupConsoleBar
            group={ctx.activeGroup}
            sessions={ctx.activeGroupSessions}
            activeSessionId={ctx.activeGroupedSessionId}
            onSelect={ctx.onSelectConsoleInGroup}
            onCreate={ctx.onCreateConsoleInGroup}
            onClose={ctx.onCloseConsoleInGroup}
            newConsoleLabel={ctx.t?.('tabs.newConsole') ?? 'New Console'}
            consoleLabel={(index) => ctx.t?.('tabs.consoleIndex', { index }) ?? `Console ${index}`}
          />
        )}
        <div className="flex-1 min-h-0 relative flex">
          <TerminalLayerFocusSidebarSection ctx={ctx} />
          <TerminalLayerWorkspaceSection ctx={ctx} />
        </div>
      </div>
    </div>
  );
}

export const TerminalLayerView = memo(
  TerminalLayerViewInner,
  (prev, next) => terminalLayerViewCtxEqual(prev.ctx, next.ctx),
);
TerminalLayerView.displayName = 'TerminalLayerView';
