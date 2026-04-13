import type { DockerContainerSummary } from "./models";

export interface TerminalHostFileContext {
  kind: "host";
  cwd?: string;
  updatedAt: number;
}

export interface TerminalDockerFileContext {
  kind: "docker";
  containerRef: string;
  containerId?: string;
  containerName?: string;
  cwd?: string;
  updatedAt: number;
}

export type TerminalFileContext = TerminalHostFileContext | TerminalDockerFileContext;

interface ParsedDockerExecCommand {
  containerRef: string;
  cwd?: string;
}

const SUDO_VALUE_OPTIONS = new Set(["-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-C", "--chdir"]);
const DOCKER_EXEC_VALUE_OPTIONS = new Set(["-w", "--workdir", "-u", "--user", "-e", "--env", "--detach-keys"]);

function tokenizeShellLike(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      current += char;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function stripMatchingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function skipSudoInvocation(tokens: string[], startIndex: number): number {
  let index = startIndex;
  if (tokens[index] !== "sudo") return index;
  index += 1;

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token.startsWith("-") || token === "-") {
      break;
    }
    if (token === "--") {
      index += 1;
      break;
    }
    if (SUDO_VALUE_OPTIONS.has(token)) {
      index += 2;
      continue;
    }
    index += 1;
  }

  return index;
}

export function parseDockerExecCommand(command: string): ParsedDockerExecCommand | null {
  const tokens = tokenizeShellLike(command.trim());
  if (tokens.length === 0) return null;

  let index = skipSudoInvocation(tokens, 0);
  if (tokens[index] !== "docker") return null;

  index += 1;
  if (tokens[index] !== "exec") return null;
  index += 1;

  let cwd: string | undefined;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token === "--") {
      index += 1;
      break;
    }

    if (token === "-w" || token === "--workdir") {
      cwd = stripMatchingQuotes(tokens[index + 1] || "");
      index += 2;
      continue;
    }

    if (token.startsWith("--workdir=")) {
      cwd = stripMatchingQuotes(token.slice("--workdir=".length));
      index += 1;
      continue;
    }

    if (token.startsWith("-w") && token.length > 2) {
      cwd = stripMatchingQuotes(token.slice(2));
      index += 1;
      continue;
    }

    if (DOCKER_EXEC_VALUE_OPTIONS.has(token)) {
      index += 2;
      continue;
    }

    if (token.startsWith("-")) {
      index += 1;
      continue;
    }

    return {
      containerRef: stripMatchingQuotes(token),
      cwd: cwd && cwd.startsWith("/") ? cwd : undefined,
    };
  }

  return null;
}

export function isShellExitCommand(command: string): boolean {
  const trimmed = command.trim();
  return trimmed === "exit" || trimmed === "logout";
}

export function inferHomeDirFromAbsolutePath(path: string | undefined): string | null {
  if (!path || !path.startsWith("/")) return null;
  if (path === "/root" || path.startsWith("/root/")) return "/root";

  const linuxHome = path.match(/^\/home\/[^/]+/);
  if (linuxHome) return linuxHome[0];

  const macHome = path.match(/^\/Users\/[^/]+/);
  if (macHome) return macHome[0];

  return null;
}

export function resolveTerminalPathCandidate(candidate: string | undefined, fallbackAbsolutePath?: string): string | null {
  if (!candidate) return null;
  const trimmed = stripMatchingQuotes(candidate.trim());
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    const inferredHome = inferHomeDirFromAbsolutePath(fallbackAbsolutePath);
    if (!inferredHome) return null;
    if (trimmed === "~") return inferredHome;
    return `${inferredHome}/${trimmed.slice(2)}`;
  }
  return null;
}

export function matchDockerContainerForContext(
  container: DockerContainerSummary,
  context: TerminalDockerFileContext,
): boolean {
  if (context.containerId && container.id === context.containerId) return true;
  if (context.containerName && container.name === context.containerName) return true;

  const ref = context.containerRef.trim();
  if (!ref) return false;
  return container.id === ref || container.id.startsWith(ref) || container.name === ref;
}
