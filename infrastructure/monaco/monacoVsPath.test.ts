import assert from "node:assert/strict";
import test from "node:test";

import { resolveMonacoVsPath } from "./monacoVsPath";

test("dev mode uses the local monaco-editor package", () => {
  assert.equal(
    resolveMonacoVsPath({ isDev: true, baseUrl: "./", baseURI: "file:///app/dist/index.html" }),
    "./node_modules/monaco-editor/min/vs",
  );
});

test("packaged renderer resolves monaco against the page, not the JS chunk", () => {
  assert.equal(
    resolveMonacoVsPath({
      isDev: false,
      baseUrl: "./",
      baseURI: "file:///Applications/Netcatty.app/Contents/Resources/app.asar/dist/index.html",
    }),
    "file:///Applications/Netcatty.app/Contents/Resources/app.asar/dist/monaco/vs",
  );
});

test("packaged renderer keeps a directory baseURI on dist/monaco/vs", () => {
  assert.equal(
    resolveMonacoVsPath({
      isDev: false,
      baseUrl: "./",
      baseURI: "file:///app/dist/",
    }),
    "file:///app/dist/monaco/vs",
  );
});

test("falls back to BASE_URL when no page URI is available", () => {
  assert.equal(
    resolveMonacoVsPath({ isDev: false, baseUrl: "./" }),
    "./monaco/vs",
  );
});
