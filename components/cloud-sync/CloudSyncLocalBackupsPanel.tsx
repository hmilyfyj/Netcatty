/**
 * CloudSyncSettings - End-to-End Encrypted Cloud Sync UI
 * 
 * Handles:
 * - Master key setup (gatekeeper screen)
 * - Provider connections (GitHub, Google, OneDrive)
 * - Sync status and conflict resolution
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    AlertTriangle,
    Download,
    FolderOpen,
    Loader2,
    RefreshCw,
    Save,
} from 'lucide-react';
import { useLocalVaultBackups } from '../../application/state/useLocalVaultBackups';
import {
    MAX_LOCAL_VAULT_BACKUP_MAX_COUNT,
    MIN_LOCAL_VAULT_BACKUP_MAX_COUNT,
    withRestoreBarrier,
    saveLocalVaultBackupFile,
    readLocalVaultBackupFile,
    type LocalVaultBackupPreview,
} from '../../application/localVaultBackups';
import { useI18n } from '../../application/i18n/I18nProvider';


import { type SyncPayload } from '../../domain/sync';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { toast } from '../ui/toast';

// ============================================================================
interface LocalBackupsPanelProps {
    onBuildLocalPayload: () => SyncPayload | Promise<SyncPayload>;
    onApplyPayload: (payload: SyncPayload) => void | Promise<void>;
    /**
     * When true, the panel hides the Restore button entirely — e.g. while the
     * master key has not been configured yet, a restore would land credentials
     * on disk in plaintext (I3). Listing is still allowed so users can see that
     * their history exists.
     */
    restoreDisabledReason?: 'no-master-key' | null;
}

export const LocalBackupsPanel: React.FC<LocalBackupsPanelProps> = ({
    onApplyPayload,
    onBuildLocalPayload,
    restoreDisabledReason = null,
}) => {
    const { t, resolvedLocale } = useI18n();
    const {
        backups,
        isLoading,
        maxBackups,
        encryptionAvailable,
        backupDirectory,
        directoryError,
        chooseBackupDirectory,
        refreshBackups,
        readBackup,
        setMaxBackups,
        openBackupDirectory,
    } = useLocalVaultBackups();
    const [maxBackupsInput, setMaxBackupsInput] = useState(String(maxBackups));
    const [isSavingMaxBackups, setIsSavingMaxBackups] = useState(false);
    const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);
    const [fileAction, setFileAction] = useState<'save' | 'read' | 'choose' | null>(null);
    const actionInProgress = useRef(false);
    const busy = fileAction !== null || restoringBackupId !== null || isSavingMaxBackups;
    // Backup chosen in the list but not yet confirmed. A two-step flow keeps
    // users from wiping their vault with a single accidental click (I2).
    const [pendingRestoreBackup, setPendingRestoreBackup] = useState<
        (LocalVaultBackupPreview & { payload?: SyncPayload }) | null
    >(null);

    useEffect(() => {
        setMaxBackupsInput(String(maxBackups));
    }, [maxBackups]);

    const formatTimestamp = (timestamp: number) =>
        new Date(timestamp).toLocaleString(resolvedLocale || undefined);

    const getReasonLabel = (reason: LocalVaultBackupPreview['reason']) =>
        reason === 'manual'
            ? t('cloudSync.localBackups.reason.manual')
            : reason === 'app_version_change'
            ? t('cloudSync.localBackups.reason.appVersionChange')
            : t('cloudSync.localBackups.reason.beforeRestore');

    const handleSaveMaxBackups = async () => {
        if (actionInProgress.current) return;
        // Validate BEFORE calling setMaxBackups, which hands off to the
        // renderer's `sanitizeLocalVaultBackupMaxCount` clamp. Two failure
        // modes must be surfaced rather than silently clamped, because
        // both produce a misleading "saved" toast:
        //
        //   1. Empty / non-numeric input — `Number("")` coerces to 0 and
        //      sanitize clamps to the default (20). A user who meant to
        //      clear the field then re-type would see their retention
        //      silently reset to 20 with a success message.
        //
        //   2. Out-of-range input (e.g. 500) — sanitize clamps to 100 and
        //      still reports success, but the visible error string says
        //      "between 1 and 100", so the user has no idea their value
        //      was changed. Reject explicitly instead.
        //
        // The 1..MAX range check mirrors the main-process `sanitizeMaxCount`
        // in vaultBackupBridge.cjs so renderer and bridge agree.
        const parsed = Number(maxBackupsInput);
        const inRange =
            Number.isFinite(parsed) &&
            parsed >= MIN_LOCAL_VAULT_BACKUP_MAX_COUNT &&
            parsed <= MAX_LOCAL_VAULT_BACKUP_MAX_COUNT;
        if (!inRange || maxBackupsInput.trim() === '') {
            toast.error(
                t('cloudSync.localBackups.maxInvalid'),
                t('sync.toast.errorTitle'),
            );
            return;
        }
        actionInProgress.current = true;
        setIsSavingMaxBackups(true);
        try {
            const next = await setMaxBackups(parsed);
            setMaxBackupsInput(String(next));
            toast.success(t('cloudSync.localBackups.maxSaved', { count: String(next) }));
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : t('common.unknownError'),
                t('sync.toast.errorTitle'),
            );
        } finally {
            actionInProgress.current = false;
            setIsSavingMaxBackups(false);
        }
    };

    const handleOpenBackupDirectory = async () => {
        try {
            await openBackupDirectory();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : t('common.unknownError'),
                t('sync.toast.errorTitle'),
            );
        }
    };

    const handleBackupFile = async (action: 'save' | 'read' | 'choose') => {
        if (actionInProgress.current || pendingRestoreBackup || !encryptionAvailable) return;
        if (action === 'read' && restoreDisabledReason !== null) return;
        actionInProgress.current = true;
        setFileAction(action);
        try {
            if (action === 'choose') {
                await chooseBackupDirectory();
            } else if (action === 'save') {
                const result = await saveLocalVaultBackupFile(onBuildLocalPayload);
                if (!result.canceled) {
                    toast.success(t('cloudSync.localBackups.fileSaved', { path: result.path ?? '' }));
                }
            } else {
                const result = await readLocalVaultBackupFile();
                if (!result.canceled && result.backup && result.payload) {
                    setPendingRestoreBackup({ ...result.backup, payload: result.payload });
                }
            }
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : t('common.unknownError'),
                t(action === 'choose'
                    ? 'cloudSync.localBackups.directoryChangeFailed'
                    : action === 'save' ? 'cloudSync.localBackups.fileSaveFailed' : 'cloudSync.localBackups.restoreFailedTitle'),
            );
        } finally {
            actionInProgress.current = false;
            setFileAction(null);
        }
    };

    const performRestore = async (target: LocalVaultBackupPreview & { payload?: SyncPayload }) => {
        if (actionInProgress.current || restoreDisabledReason !== null || !encryptionAvailable) return;
        actionInProgress.current = true;
        setRestoringBackupId(target.id);
        try {
            // Hold the cross-window restore barrier around both the load
            // and the apply so another window's auto-sync cannot push a
            // pre-restore snapshot concurrently. See `withRestoreBarrier`
            // in application/localVaultBackups.ts for the read-side in
            // useAutoSync.
            //
            // In-memory React state refresh is implicit: `onApplyPayload`
            // (supplied by the hosting screen) routes through
            // `applySyncPayload` → `importDataFromString` → store writes
            // → the hook-store listeners in `useVaultState` /
            // `useCustomThemes` / etc. We do NOT explicitly re-pull host
            // lists here because a future refactor that decouples those
            // stores from the apply path would silently break the UI
            // refresh in a way that's only visible after a manual
            // restart. Any change to that chain must either preserve
            // store-listener notification OR add an explicit
            // `rehydrateAllFromStorage` call here — do not assume
            // restore is "just" a payload swap.
            await withRestoreBarrier(async () => {
                const detail = target.payload
                    ? { backup: target, payload: target.payload }
                    : await readBackup(target.id);
                if (!detail) {
                    throw new Error(t('cloudSync.localBackups.restoreMissing'));
                }
                await Promise.resolve(onApplyPayload(detail.payload));
            });
            await refreshBackups();
            toast.success(t('cloudSync.localBackups.restoreSuccess'));
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : t('common.unknownError'),
                t('cloudSync.localBackups.restoreFailedTitle'),
            );
        } finally {
            actionInProgress.current = false;
            setRestoringBackupId(null);
        }
    };

    const restoreAllowed = restoreDisabledReason === null;
    // While encryptionAvailable is still `null` we're mid-probe — render the
    // restore button as disabled so the user never sees a path they can't
    // actually take (I1 surface). Once resolved, `false` hides the panel body
    // via the unavailable banner below.
    const encryptionResolved = encryptionAvailable !== null;
    const encryptionUsable = encryptionAvailable === true;

    // safeStorage probe finished and returned "not available" → disable the
    // panel entirely; the main process refuses to write in this state (I1).
    if (encryptionResolved && !encryptionUsable) {
        return (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-medium">
                        {t('cloudSync.localBackups.unavailableTitle')}
                    </span>
                </div>
                <div className="text-xs text-muted-foreground">
                    {t('cloudSync.localBackups.unavailableDesc')}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-3">
                <div>
                    <div className="text-sm font-medium">{t('cloudSync.localBackups.fileTitle')}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {t('cloudSync.localBackups.fileDesc')}
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="text-xs font-medium" id="local-backup-directory-label">
                        {t('cloudSync.localBackups.directoryLabel')}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                            <div
                                id="local-backup-directory"
                                aria-labelledby="local-backup-directory-label"
                                className="rounded-md border bg-muted/30 px-3 py-2 text-xs break-all select-text"
                                aria-live="polite"
                            >
                                {backupDirectory ?? (directoryError
                                    ? t('cloudSync.localBackups.directoryUnavailable')
                                    : t('common.loading'))}
                            </div>
                            {directoryError && (
                                <div className="mt-1 text-xs text-destructive" role="alert">
                                    {t('cloudSync.localBackups.directoryLoadFailed', { message: directoryError })}
                                </div>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => void handleBackupFile('choose')}
                            disabled={busy || pendingRestoreBackup !== null || !encryptionUsable}
                            className="gap-2 shrink-0"
                        >
                            {fileAction === 'choose' ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                            {t('cloudSync.localBackups.changeDirectory')}
                        </Button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => void handleBackupFile('save')}
                        disabled={busy || pendingRestoreBackup !== null || !encryptionUsable || !backupDirectory}
                        className="gap-2"
                    >
                        {fileAction === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {t('cloudSync.localBackups.saveFile')}
                    </Button>
                    {restoreAllowed && (
                        <Button
                            variant="outline"
                            onClick={() => void handleBackupFile('read')}
                            disabled={busy || pendingRestoreBackup !== null || !encryptionUsable}
                            className="gap-2"
                        >
                            {fileAction === 'read' ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                            {t('cloudSync.localBackups.restoreFile')}
                        </Button>
                    )}
                </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-lg">
                        <div className="text-sm font-medium">{t('cloudSync.localBackups.retentionTitle')}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {t('cloudSync.localBackups.retentionDesc')}
                        </div>
                    </div>
                    <div className="space-y-2 md:min-w-[260px] md:shrink-0">
                        <div className="flex items-end gap-2 md:justify-end">
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={maxBackupsInput}
                                onChange={(e) => setMaxBackupsInput(e.target.value)}
                                className="w-28"
                            />
                            <Button
                                variant="outline"
                                onClick={() => void handleSaveMaxBackups()}
                                disabled={busy || pendingRestoreBackup !== null || !encryptionUsable}
                                className="gap-2"
                            >
                                {isSavingMaxBackups && <Loader2 size={14} className="animate-spin" />}
                                {t('common.save')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {!restoreAllowed && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                        <AlertTriangle size={14} />
                        <span className="font-medium">
                            {t('cloudSync.localBackups.lockedTitle')}
                        </span>
                    </div>
                    {t('cloudSync.localBackups.lockedDesc')}
                </div>
            )}

            <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-sm font-medium">{t('cloudSync.localBackups.title')}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {t('cloudSync.localBackups.desc')}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void refreshBackups()}
                            disabled={isLoading || busy || pendingRestoreBackup !== null}
                            className="gap-1"
                        >
                            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
                            {t('settings.system.refresh')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleOpenBackupDirectory()}
                            disabled={busy || pendingRestoreBackup !== null}
                            className="gap-1"
                        >
                            <FolderOpen size={14} />
                            {t('settings.system.openFolder')}
                        </Button>
                    </div>
                </div>

                {backups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                        {t('cloudSync.localBackups.empty')}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {backups.map((backup) => (
                            <div
                                key={backup.id}
                                className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium">
                                        {backup.syncDataVersion
                                            ? `v${backup.syncDataVersion}`
                                            : formatTimestamp(backup.createdAt)}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                                        <span>{getReasonLabel(backup.reason)}</span>
                                        {backup.syncDataVersion && (
                                            <>
                                                <span aria-hidden="true">·</span>
                                                <span>{formatTimestamp(backup.createdAt)}</span>
                                            </>
                                        )}
                                        {backup.sourceAppVersion && backup.targetAppVersion && (
                                            <>
                                                <span aria-hidden="true">·</span>
                                                <span>
                                                    {t('cloudSync.localBackups.versionChange', {
                                                        from: backup.sourceAppVersion,
                                                        to: backup.targetAppVersion,
                                                    })}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {t('cloudSync.localBackups.counts', {
                                            hosts: String(backup.preview.hostCount),
                                            keys: String(backup.preview.keyCount),
                                            snippets: String(backup.preview.snippetCount),
                                            notes: String(backup.preview.noteCount ?? 0),
                                        })}
                                    </div>
                                </div>
                                {restoreAllowed && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setPendingRestoreBackup(backup)}
                                        // Disable every row while ANY restore is in
                                        // flight. Each restore runs a full
                                        // `applyProtectedSyncPayload` — multiple
                                        // localStorage writes + the apply-in-progress
                                        // sentinel. `withRestoreBarrier` serializes
                                        // across windows but does NOT serialize
                                        // same-window re-entry, so two overlapping
                                        // clicks here would interleave destructive
                                        // writes and the second run's sentinel-clear
                                        // could mask a still-partial first apply.
                                        disabled={busy || pendingRestoreBackup !== null || !encryptionUsable}
                                        className="gap-2"
                                    >
                                        {restoringBackupId === backup.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Download size={14} />
                                        )}
                                        {t('cloudSync.localBackups.restore')}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Restore confirmation dialog (I2). Keeps the destructive action
                gated behind an explicit second click, mirroring the clear-local
                dialog elsewhere in this screen. */}
            <Dialog
                open={pendingRestoreBackup !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingRestoreBackup(null);
                }}
            >
                <DialogContent className="sm:max-w-[440px] z-[70]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle size={20} />
                            {t('cloudSync.localBackups.restoreConfirmTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('cloudSync.localBackups.restoreConfirmDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    {pendingRestoreBackup && (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
                            <div className="font-medium">
                                {pendingRestoreBackup.syncDataVersion
                                    ? `v${pendingRestoreBackup.syncDataVersion}`
                                    : formatTimestamp(pendingRestoreBackup.createdAt)}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1 flex-wrap">
                                <span>{getReasonLabel(pendingRestoreBackup.reason)}</span>
                                {pendingRestoreBackup.syncDataVersion && (
                                    <>
                                        <span aria-hidden="true">·</span>
                                        <span>{formatTimestamp(pendingRestoreBackup.createdAt)}</span>
                                    </>
                                )}
                                {pendingRestoreBackup.sourceAppVersion && pendingRestoreBackup.targetAppVersion && (
                                    <>
                                        <span aria-hidden="true">·</span>
                                        <span>
                                            {t('cloudSync.localBackups.versionChange', {
                                                from: pendingRestoreBackup.sourceAppVersion,
                                                to: pendingRestoreBackup.targetAppVersion,
                                            })}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="text-muted-foreground">
                                {t('cloudSync.localBackups.counts', {
                                    hosts: String(pendingRestoreBackup.preview.hostCount),
                                    keys: String(pendingRestoreBackup.preview.keyCount),
                                    snippets: String(pendingRestoreBackup.preview.snippetCount),
                                    notes: String(pendingRestoreBackup.preview.noteCount ?? 0),
                                })}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setPendingRestoreBackup(null)}
                            disabled={busy || !encryptionUsable}
                        >
                            {t('cloudSync.localBackups.restoreConfirmCancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                const target = pendingRestoreBackup;
                                if (!target) return;
                                setPendingRestoreBackup(null);
                                await performRestore(target);
                            }}
                            disabled={busy || !encryptionUsable}
                            className="gap-2"
                        >
                            {restoringBackupId !== null ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Download size={14} />
                            )}
                            {t('cloudSync.localBackups.restoreConfirmButton')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
