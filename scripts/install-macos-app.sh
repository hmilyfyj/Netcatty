#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Netcatty.app"
TARGET_APP="/Applications/${APP_NAME}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "此脚本仅支持在 macOS 上运行。"
  exit 1
fi

cd "${PROJECT_ROOT}"

echo "==> 构建目录版 macOS 应用"
CSC_IDENTITY_AUTO_DISCOVERY=false npm run pack:dir

SOURCE_APP="$(find "${PROJECT_ROOT}/release" -maxdepth 2 -type d -name "${APP_NAME}" | head -n 1)"

if [[ -z "${SOURCE_APP}" ]]; then
  echo "未找到构建产物 ${APP_NAME}"
  exit 1
fi

echo "==> 安装到 ${TARGET_APP}"
rm -rf "${TARGET_APP}"
ditto "${SOURCE_APP}" "${TARGET_APP}"

EXECUTABLE_PATH="${TARGET_APP}/Contents/MacOS/Netcatty"
if [[ ! -x "${EXECUTABLE_PATH}" ]]; then
  echo "安装后的应用缺少可执行文件: ${EXECUTABLE_PATH}"
  exit 1
fi

echo "==> 安装完成"
echo "应用路径: ${TARGET_APP}"
echo "可执行文件: ${EXECUTABLE_PATH}"
