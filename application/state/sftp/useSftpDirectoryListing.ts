import { useCallback } from "react";
import { netcattyBridge } from "../../../infrastructure/services/netcattyBridge";
import type { RemoteFile, SftpFileEntry, SftpFilenameEncoding } from "../../../domain/models";
import { buildMockLocalFiles } from "./mockLocalFiles";
import { formatFileSize, formatDate } from "./utils";

export const useSftpDirectoryListing = () => {
  const mapRemoteFiles = useCallback((rawFiles: RemoteFile[]): SftpFileEntry[] => {
    return rawFiles.map((f) => {
      const size = parseInt(f.size) || 0;
      const lastModified = new Date(f.lastModified).getTime();
      return {
        name: f.name,
        type: f.type as "file" | "directory" | "symlink",
        size,
        sizeFormatted: formatFileSize(size),
        lastModified,
        lastModifiedFormatted: formatDate(lastModified),
        permissions: f.permissions,
        linkTarget: f.linkTarget as "file" | "directory" | null | undefined,
        hidden: f.hidden,
      };
    });
  }, []);

  const getMockLocalFiles = useCallback((path: string): SftpFileEntry[] => {
    return buildMockLocalFiles(path);
  }, []);

  const listLocalFiles = useCallback(
    async (path: string): Promise<SftpFileEntry[]> => {
      const rawFiles = await netcattyBridge.get()?.listLocalDir?.(path);
      if (!rawFiles) {
        return getMockLocalFiles(path);
      }

      return mapRemoteFiles(rawFiles);
    },
    [getMockLocalFiles, mapRemoteFiles],
  );

  const listRemoteFiles = useCallback(
    async (sftpId: string, path: string, encoding?: SftpFilenameEncoding): Promise<SftpFileEntry[]> => {
      const rawFiles = await netcattyBridge.get()?.listSftp(sftpId, path, encoding);
      if (!rawFiles) return [];
      return mapRemoteFiles(rawFiles);
    },
    [mapRemoteFiles],
  );

  const listDockerFiles = useCallback(
    async (sessionId: string, containerId: string, path: string): Promise<SftpFileEntry[]> => {
      const rawFiles = await netcattyBridge.get()?.dockerListFilesForSession?.(sessionId, containerId, path);
      if (!rawFiles) return [];
      return mapRemoteFiles(rawFiles);
    },
    [mapRemoteFiles],
  );

  return {
    listLocalFiles,
    listRemoteFiles,
    listDockerFiles,
  };
};
