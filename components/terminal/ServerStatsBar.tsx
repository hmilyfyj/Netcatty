import { ArrowDownToLine, ArrowUpFromLine, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import React from 'react';
import { useI18n } from '../../application/i18n/I18nProvider';
import { cn } from '../../lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import type { ServerStats } from './hooks/useServerStats';

interface ServerStatsBarProps {
  stats: ServerStats;
  className?: string;
}

function formatNetSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) {
    return `${bytesPerSec}B/s`;
  }
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)}K/s`;
  }
  if (bytesPerSec < 1024 * 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)}M/s`;
  }
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)}G/s`;
}

export const ServerStatsBar: React.FC<ServerStatsBarProps> = ({ stats, className }) => {
  const { t } = useI18n();

  if (!stats.lastUpdated) return null;

  return (
    <div className={cn('flex items-center gap-2.5 text-[10px] opacity-80 flex-nowrap overflow-hidden min-w-0', className)}>
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            className="flex items-center gap-0.5 hover:opacity-100 opacity-80 transition-opacity cursor-pointer flex-shrink-0"
            title={t('terminal.serverStats.cpu')}
          >
            <Cpu size={10} className="flex-shrink-0" />
            <span>
              {stats.cpu !== null ? `${stats.cpu}%` : '--'}
              {stats.cpuCores !== null && ` (${stats.cpuCores}C)`}
            </span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-auto p-3" side="bottom" align="start" sideOffset={8}>
          <div className="text-xs space-y-2">
            <div className="font-medium text-sm mb-2">{t('terminal.serverStats.cpuCores')}</div>
            {stats.cpuPerCore.length > 0 ? (
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(4, stats.cpuPerCore.length)}, 1fr)` }}>
                {stats.cpuPerCore.map((usage, index) => (
                  <div key={index} className="flex flex-col items-center gap-1 min-w-[48px]">
                    <div className="text-[10px] text-muted-foreground">Core {index}</div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          usage >= 90 ? 'bg-red-500' : usage >= 70 ? 'bg-amber-500' : 'bg-emerald-500',
                        )}
                        style={{ width: `${usage}%` }}
                      />
                    </div>
                    <div
                      className={cn(
                        'text-[11px] font-medium',
                        usage >= 90 ? 'text-red-400' : usage >= 70 ? 'text-amber-400' : 'text-emerald-400',
                      )}
                    >
                      {usage}%
                    </div>
                  </div>
                ))}
              </div>
            ) : stats.cpu !== null ? (
              <div className="flex flex-col gap-1.5 min-w-[160px]">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      stats.cpu >= 90 ? 'bg-red-500' : stats.cpu >= 70 ? 'bg-amber-500' : 'bg-emerald-500',
                    )}
                    style={{ width: `${stats.cpu}%` }}
                  />
                </div>
                <div
                  className={cn(
                    'text-center text-[11px] font-medium',
                    stats.cpu >= 90 ? 'text-red-400' : stats.cpu >= 70 ? 'text-amber-400' : 'text-emerald-400',
                  )}
                >
                  {stats.cpu}% · {stats.cpuCores ?? '?'} cores
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">{t('terminal.serverStats.noData')}</div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            className="flex items-center gap-0.5 hover:opacity-100 opacity-80 transition-opacity cursor-pointer flex-shrink-0"
            title={t('terminal.serverStats.memory')}
          >
            <MemoryStick size={10} className="flex-shrink-0" />
            <span>
              {stats.memUsed !== null && stats.memTotal !== null
                ? `${(stats.memUsed / 1024).toFixed(1)}/${(stats.memTotal / 1024).toFixed(1)}G`
                : '--'}
            </span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-auto p-3" side="bottom" align="start" sideOffset={8}>
          <div className="text-xs space-y-3 min-w-[280px]">
            <div className="font-medium text-sm">{t('terminal.serverStats.memoryDetails')}</div>
            {stats.memTotal !== null && (
              <div className="space-y-1.5">
                <div className="w-full h-3 bg-muted rounded overflow-hidden flex">
                  {stats.memUsed !== null && stats.memUsed > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(stats.memUsed / stats.memTotal) * 100}%` }}
                      title={`${t('terminal.serverStats.memUsed')}: ${(stats.memUsed / 1024).toFixed(1)}G`}
                    />
                  )}
                  {stats.memBuffers !== null && stats.memBuffers > 0 && (
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(stats.memBuffers / stats.memTotal) * 100}%` }}
                      title={`${t('terminal.serverStats.memBuffers')}: ${(stats.memBuffers / 1024).toFixed(1)}G`}
                    />
                  )}
                  {stats.memCached !== null && stats.memCached > 0 && (
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${(stats.memCached / stats.memTotal) * 100}%` }}
                      title={`${t('terminal.serverStats.memCached')}: ${(stats.memCached / 1024).toFixed(1)}G`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                    <span>{t('terminal.serverStats.memUsed')}: {stats.memUsed !== null ? `${(stats.memUsed / 1024).toFixed(1)}G` : '--'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-blue-500" />
                    <span>{t('terminal.serverStats.memBuffers')}: {stats.memBuffers !== null ? `${(stats.memBuffers / 1024).toFixed(1)}G` : '--'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-amber-500" />
                    <span>{t('terminal.serverStats.memCached')}: {stats.memCached !== null ? `${(stats.memCached / 1024).toFixed(1)}G` : '--'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-muted border border-border" />
                    <span>{t('terminal.serverStats.memFree')}: {stats.memFree !== null ? `${(stats.memFree / 1024).toFixed(1)}G` : '--'}</span>
                  </div>
                </div>
              </div>
            )}
            {stats.swapTotal !== null && stats.swapTotal > 0 && (
              <div className="space-y-1.5">
                <div className="font-medium text-[11px] text-muted-foreground">{t('terminal.serverStats.swap')}</div>
                <div className="w-full h-3 bg-muted rounded overflow-hidden flex">
                  {stats.swapUsed !== null && stats.swapUsed > 0 && (
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${(stats.swapUsed / stats.swapTotal) * 100}%` }}
                      title={`${t('terminal.serverStats.swapUsed')}: ${(stats.swapUsed / 1024).toFixed(1)}G`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-rose-500" />
                    <span>{t('terminal.serverStats.swapUsed')}: {stats.swapUsed !== null ? `${(stats.swapUsed / 1024).toFixed(1)}G` : '--'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-muted border border-border" />
                    <span>{t('terminal.serverStats.swapFree')}: {stats.swapTotal !== null && stats.swapUsed !== null ? `${((stats.swapTotal - stats.swapUsed) / 1024).toFixed(1)}G` : '--'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">{t('terminal.serverStats.swapTotal')}: {`${(stats.swapTotal / 1024).toFixed(1)}G`}</span>
                  </div>
                </div>
              </div>
            )}
            {stats.topProcesses.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-medium text-[11px] text-muted-foreground">{t('terminal.serverStats.topProcesses')}</div>
                <div className="space-y-0.5 max-h-[150px] overflow-y-auto">
                  {stats.topProcesses.map((proc, index) => (
                    <div key={index} className="flex items-center gap-2 text-[10px]">
                      <span className="w-[32px] text-right text-muted-foreground">{proc.memPercent.toFixed(1)}%</span>
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, proc.memPercent * 2)}%` }} />
                      </div>
                      <span className="flex-shrink-0 font-mono truncate max-w-[140px]" title={proc.command}>
                        {proc.command.split('/').pop()?.split(' ')[0] || proc.command}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            className="flex items-center gap-0.5 hover:opacity-100 opacity-80 transition-opacity cursor-pointer flex-shrink-0"
            title={t('terminal.serverStats.disk')}
          >
            <HardDrive size={10} className="flex-shrink-0" />
            <span
              className={cn(
                stats.diskPercent !== null && stats.diskPercent >= 90 && 'text-red-400',
                stats.diskPercent !== null && stats.diskPercent >= 80 && stats.diskPercent < 90 && 'text-amber-400',
              )}
            >
              {stats.diskUsed !== null && stats.diskTotal !== null && stats.diskPercent !== null
                ? `${stats.diskUsed}/${stats.diskTotal}G (${stats.diskPercent}%)`
                : stats.diskPercent !== null
                  ? `${stats.diskPercent}%`
                  : '--'}
            </span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-auto p-3" side="bottom" align="start" sideOffset={8}>
          <div className="text-xs space-y-2">
            <div className="font-medium text-sm mb-2">{t('terminal.serverStats.diskDetails')}</div>
            {stats.disks.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {stats.disks.map((disk, index) => (
                  <div key={index} className="flex flex-col gap-1 min-w-[180px]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]" title={disk.mountPoint}>
                        {disk.mountPoint}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] font-medium whitespace-nowrap',
                          disk.percent >= 90 ? 'text-red-400' : disk.percent >= 80 ? 'text-amber-400' : 'text-emerald-400',
                        )}
                      >
                        {disk.used}/{disk.total}G ({disk.percent}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          disk.percent >= 90 ? 'bg-red-500' : disk.percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500',
                        )}
                        style={{ width: `${disk.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground">{t('terminal.serverStats.noData')}</div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      {stats.netInterfaces.length > 0 && (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button
              className="flex items-center gap-1 hover:opacity-100 opacity-80 transition-opacity cursor-pointer flex-shrink-0"
              title={t('terminal.serverStats.network')}
            >
              <ArrowDownToLine size={9} className="flex-shrink-0 text-emerald-400" />
              <span>{formatNetSpeed(stats.netRxSpeed)}</span>
              <ArrowUpFromLine size={9} className="flex-shrink-0 text-sky-400" />
              <span>{formatNetSpeed(stats.netTxSpeed)}</span>
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-auto p-3" side="bottom" align="start" sideOffset={8}>
            <div className="text-xs space-y-2">
              <div className="font-medium text-sm mb-2">{t('terminal.serverStats.networkDetails')}</div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {stats.netInterfaces.map((iface, index) => (
                  <div key={index} className="flex items-center justify-between gap-4 min-w-[200px]">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {iface.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-emerald-400">
                        <ArrowDownToLine size={9} />
                        {formatNetSpeed(iface.rxSpeed)}
                      </span>
                      <span className="flex items-center gap-0.5 text-sky-400">
                        <ArrowUpFromLine size={9} />
                        {formatNetSpeed(iface.txSpeed)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
};

export default ServerStatsBar;
