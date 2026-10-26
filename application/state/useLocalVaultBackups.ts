import { useCallback, useEffect, useState, useRef } from 'react';
import {
  type LocalVaultBackupPreview,
  getLocalVaultBackupCapabilities,
  getLocalVaultBackupDirectory,
  chooseLocalVaultBackupDirectory,
  getLocalVaultBackupMaxCount,
  listLocalVaultBackups,
  openLocalVaultBackupDir,
  readLocalVaultBackup,
  setLocalVaultBackupMaxCount,
  trimLocalVaultBackups,
} from '../localVaultBackups';
import { netcattyBridge } from '../../infrastructure/services/netcattyBridge';

export function useLocalVaultBackups() {
  const [backups, setBackups] = useState<LocalVaultBackupPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [maxBackups, setMaxBackupsState] = useState(() => getLocalVaultBackupMaxCount());
  // `null` while we're still asking the main process. The UI should treat
  // `null` as "unknown, don't render restore controls yet" so we never expose
  // a destructive action that might later be disabled.
  const [encryptionAvailable, setEncryptionAvailable] = useState<boolean | null>(null);

  const [backupDirectory, setBackupDirectory] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const directoryRequest = useRef(0);
  const refreshBackupDirectory = useCallback(async () => {
    const request = ++directoryRequest.current;
    try {
      const { path } = await getLocalVaultBackupDirectory();
      if (request !== directoryRequest.current) return;
      setBackupDirectory(path);
      setDirectoryError(null);
    } catch (error) {
      if (request !== directoryRequest.current) return;
      setBackupDirectory(null);
      setDirectoryError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const chooseBackupDirectory = useCallback(async () => {
    const result = await chooseLocalVaultBackupDirectory();
    if (!result.canceled && result.path) {
      ++directoryRequest.current;
      setBackupDirectory(result.path);
      setDirectoryError(null);
    }
    return result;
  }, []);

  const refreshBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await listLocalVaultBackups();
      setBackups(next);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const invalidateDirectoryRequest = () => { ++directoryRequest.current; };
    void (async () => {
      try {
        const caps = await getLocalVaultBackupCapabilities();
        if (!cancelled) {
          setEncryptionAvailable(caps.encryptionAvailable);
        }
      } catch {
        if (!cancelled) {
          setEncryptionAvailable(false);
        }
      }
    })();
    void refreshBackups();
    void refreshBackupDirectory();
    return () => {
      invalidateDirectoryRequest();
      cancelled = true;
    };
  }, [refreshBackups, refreshBackupDirectory]);

  // Cross-window live refresh: the main process broadcasts when any
  // renderer's createBackup or trimBackups actually mutated the on-disk
  // set. Without this subscription, a protective backup written by the
  // main window wouldn't show up in the Settings window's list until
  // the user manually navigated away and back, silently under-reporting
  // the most recent recovery points.
  useEffect(() => {
    const bridge = netcattyBridge.get();
    const subscribe = bridge?.onVaultBackupsChanged;
    if (typeof subscribe !== 'function') return undefined;
    const unsubscribe = subscribe(() => {
      void refreshBackups();
      void refreshBackupDirectory();
    });
    return () => {
      try { unsubscribe?.(); } catch { /* ignore */ }
    };
  }, [refreshBackups, refreshBackupDirectory]);

  const updateMaxBackups = useCallback(async (value: number) => {
    const sanitized = setLocalVaultBackupMaxCount(value);
    setMaxBackupsState(sanitized);
    await trimLocalVaultBackups(sanitized);
    await refreshBackups();
    return sanitized;
  }, [refreshBackups]);

  const openBackupDirectory = useCallback(async () => {
    await openLocalVaultBackupDir();
  }, []);

  return {
    backups,
    isLoading,
    maxBackups,
    encryptionAvailable,
    backupDirectory,
    directoryError,
    chooseBackupDirectory,
    refreshBackups,
    readBackup: readLocalVaultBackup,
    setMaxBackups: updateMaxBackups,
    openBackupDirectory,
  };
}

export default useLocalVaultBackups;
