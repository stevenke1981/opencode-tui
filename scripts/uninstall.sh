#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--global] [--project-path <path>] [--remove-state]

Remove the opencode-status-footer plugin from OpenCode configuration.

Options:
  --global              Remove from global config (~/.config/opencode)
  --project-path <path> Remove from project-specific config (default: cwd)
  --remove-state        Also delete accumulated plugin state
  --help                Show this help
EOF
  exit 0
}

GLOBAL=false
REMOVE_STATE=false
PROJECT_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --global) GLOBAL=true; shift ;;
    --project-path) PROJECT_PATH="$2"; shift 2 ;;
    --remove-state) REMOVE_STATE=true; shift ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="file:$SOURCE_DIR"

if $GLOBAL; then
  CONFIG_DIR="$HOME/.config/opencode"
else
  CONFIG_DIR="$(cd "${PROJECT_PATH:-$(pwd)}" && pwd)/.opencode"
fi

echo "==> Removing $SPEC from OpenCode configuration..."

for f in "$CONFIG_DIR/opencode.json" "$CONFIG_DIR/opencode.jsonc" "$CONFIG_DIR/tui.json" "$CONFIG_DIR/tui.jsonc"; do
  if [[ -f "$f" ]]; then
    node "$SOURCE_DIR/scripts/remove-plugin.mjs" "$f" "$SPEC"
  fi
done

if $REMOVE_STATE && ! $GLOBAL; then
  STATE_DIR="$CONFIG_DIR/status-footer"
  if [[ -d "$STATE_DIR" ]]; then
    echo "==> Removing plugin state: $STATE_DIR"
    rm -rf "$STATE_DIR"
  fi
fi

echo "==> Removed $SPEC from OpenCode configuration."
