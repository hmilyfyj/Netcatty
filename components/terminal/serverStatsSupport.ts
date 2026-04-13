import { classifyDistroId } from '../../domain/host';
import type { Host } from '../../types';

type ServerStatsHost = Pick<Host, 'deviceType' | 'distro' | 'os'>;

export function isServerStatsSupportedHost(host: ServerStatsHost | null | undefined): boolean {
  if (!host) return false;

  const detectedDeviceClass = classifyDistroId(host.distro);
  const isNetworkDevice =
    host.deviceType === 'network' || detectedDeviceClass === 'network-device';

  return (
    !isNetworkDevice &&
    (host.os === 'linux' || host.os === 'macos' || detectedDeviceClass === 'linux-like')
  );
}
