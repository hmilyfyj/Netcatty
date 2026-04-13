import type { SftpConnection } from "../../../domain/models";

export const getSftpBackendType = (
  connection: SftpConnection | null | undefined,
): SftpConnection["backendType"] | null => {
  if (!connection) return null;
  return connection.backendType ?? (connection.isLocal ? "local" : "sftp");
};

export const isLocalSftpConnection = (
  connection: SftpConnection | null | undefined,
): boolean => getSftpBackendType(connection) === "local";

export const isRemoteSftpConnection = (
  connection: SftpConnection | null | undefined,
): boolean => getSftpBackendType(connection) === "sftp";

export const isDockerSftpConnection = (
  connection: SftpConnection | null | undefined,
): boolean => getSftpBackendType(connection) === "docker-container";
