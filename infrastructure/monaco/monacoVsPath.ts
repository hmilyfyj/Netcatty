export function resolveMonacoVsPath(options: {
  isDev: boolean;
  baseUrl?: string;
  baseURI?: string;
}): string {
  if (options.isDev) {
    return "./node_modules/monaco-editor/min/vs";
  }

  if (options.baseURI) {
    return new URL("monaco/vs", options.baseURI).href.replace(/\/$/, "");
  }

  const base = options.baseUrl ?? "./";
  return `${base}monaco/vs`;
}
