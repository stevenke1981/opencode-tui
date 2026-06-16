# AGENTS.md — opencode-status-footer

## Project Overview

This is an OpenCode TUI plugin that provides a persistent status footer showing:
- Token usage (input, output, reasoning, cache, cost)
- Session wall time and active time
- Project progress (OpenCode todos, TODO/FIXME markers, Git status, file changes)

## Architecture

```
src/
├── core.ts          — Metrics aggregation, dedup, pricing
├── project.ts       — Project state persistence (sessions → JSON)
├── tui.tsx          — TUI SolidJS component (app_bottom slot)
├── progress.ts      — Progress estimation (tasks, markers, git, files)
├── events.ts        — Event listeners for metrics
├── config.ts        — Config parsing & defaults
└── server.ts        — OpenCode server plugin entry (no-op / toast fallback)
tests/
├── core.test.mjs
├── project.test.mjs
└── tui.test.mjs
scripts/
├── install.sh       — Linux install script
├── install.ps1      — Windows install script
├── uninstall.sh     — Linux uninstall script
├── uninstall.ps1    — Windows uninstall script
├── remove-plugin.mjs— Shared config-entry remover
└── build.mjs        — Build orchestration
examples/
├── opencode.json    — Server plugin example config
└── tui.json         — TUI plugin example config
```

## Key Conventions

- **Language**: TypeScript, SolidJS for TUI rendering
- **Build**: `bun scripts/build.mjs` + `tsc --emitDeclarationOnly`
- **Tests**: Node native `--test` runner (`node --test tests/*.test.mjs`)
- **Validate**: `npm run validate` (typecheck + test + build + pack dry-run)
- **Config**: `opencode.json` for server plugin, `tui.json` for TUI plugin
- **State**: Persisted to `<project>/.opencode/status-footer/state.json`

## Agent Instructions

1. **Always run `npm run validate` after code changes** to verify correctness.
2. **Keep SolidJS rendering logic in `tui.tsx`** — core logic goes in `core.ts`, state in `project.ts`.
3. **Config defaults are in `config.ts`**; update both the TypeScript default and README doc when adding options.
4. **Scripts are dual-platform** — any new script behavior must be mirrored in both `.sh` (Linux) and `.ps1` (Windows).
5. **Test files use `.mjs` extension** (ESM) with Node's `--test` runner.
6. **No secrets** in code, config, or state files.
7. **Commit convention**: conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`).
