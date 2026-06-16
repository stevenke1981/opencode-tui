#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--global] [--project-path <path>] [--force]

Install the opencode-status-footer plugin into OpenCode.

Options:
  --global              Install into global OpenCode config (~/.config/opencode)
  --project-path <path> Install into project-specific config (default: cwd)
  --force               Reinstall even if already registered
  --help                Show this help
EOF
  exit 0
}

GLOBAL=false
FORCE=false
PROJECT_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --global) GLOBAL=true; shift ;;
    --project-path) PROJECT_PATH="$2"; shift 2 ;;
    --force) FORCE=true; shift ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${PROJECT_PATH:-$(pwd)}"
SPEC="file:$SOURCE_DIR"

if $GLOBAL; then
  TARGET_DIR="$SOURCE_DIR"
fi

echo "==> Installing dependencies & validating..."
cd "$SOURCE_DIR"
npm install
npm run validate

ARGS=("plugin" "$SPEC")
$GLOBAL && ARGS+=("--global")
$FORCE && ARGS+=("--force")

echo "==> Registering plugin with opencode..."
cd "$TARGET_DIR"
opencode "${ARGS[@]}"

echo "==> Installed $SPEC"
if $GLOBAL; then
  echo "    Scope: global"
else
  echo "    Scope: project ($TARGET_DIR)"
fi
