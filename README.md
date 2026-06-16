# OpenCode Persistent Status Footer

OpenCode TUI 的持久狀態列 plugin，顯示：

- Token：input、output、reasoning、cache read/write 與成本
- Time：session wall time 與事件驅動的 active time
- Progress：OpenCode todos、TODO/FIXME、Git、tracked files 的加權估算

預設每 5 秒重繪；較昂貴的 Git/TODO 掃描預設每 30 秒執行一次。

## 相容性

基準版本是 OpenCode `1.17.6`。此版本已正式提供 TUI plugin runtime、`tui.json` plugin 陣列，以及持久的 `app_bottom` slot。

早期 feature requests [#23539](https://github.com/anomalyco/opencode/issues/23539)、[#18969](https://github.com/anomalyco/opencode/issues/18969)、[#17492](https://github.com/anomalyco/opencode/issues/17492) 所描述的「完全沒有 TUI plugin surface」已部分過時；但語意化的 `tui.footer.items` API 仍未公開。本 plugin 使用目前正式的 `app_bottom` slot，並保留 server-side toast fallback。

## 安裝

需求：Node.js 20+、OpenCode 1.17.6+、Git。

```bash
cd /path/to/opencode-tui
npm install
npm run validate
```

### Linux / macOS

```bash
# 安裝到目前專案
./scripts/install.sh --project-path /path/to/your-project

# 安裝到全域 OpenCode 設定
./scripts/install.sh --global
```

### Windows

```powershell
.\scripts\uninstall.ps1 -ProjectPath D:\your-project -RemoveState
```

## 給 AI 代理的指引

參見 `AGENTS.md` — 包含專案架構、慣例與代理操作指示。

### 底層使用已驗證的 OpenCode installer

```bash
opencode plugin file:/path/to/opencode-tui
opencode plugin file:/path/to/opencode-tui --global
```

Installer 會偵測 package 的 `./server` 與 `./tui` exports，並分別更新 `opencode.json` 與 `tui.json`。server entry 預設為 no-op，除非啟用 `toastFallback`。

## tui.json

原生 persistent status bar 只需要 TUI 設定：

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "file:D:/qwen_tts/opencode-tui",
      {
        "scope": "session",
        "refreshIntervalMs": 5000,
        "progressRefreshIntervalMs": 30000,
        "showCache": true,
        "showCost": true,
        "toggleKey": "ctrl+shift+s"
      }
    ]
  ]
}
```

完整範例見 `examples/tui.json`。

## 舊版 fallback

OpenCode 版本沒有 TUI slot 或 TUI plugin 被停用時，可在 `opencode.json` 啟用 toast fallback：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "file:D:/qwen_tts/opencode-tui",
      {
        "toastFallback": true,
        "toastIntervalMs": 30000
      }
    ]
  ]
}
```

Toast 不是持久 UI，因此只建議作為相容 workaround。若上游未來提供 `tui.footer.items`，可把 `src/tui.tsx` 的 `app_bottom` renderer 換成 item registration，metrics/state 模組不需改寫。

## 操作

- `Ctrl+Shift+S`：切換 session / project 累計
- `/status-scope`：同一個切換命令
- project scope 會累計 plugin 已觀察並持久化的 session
- state 預設寫入 `<project>/.opencode/status-footer/state.json`

## 進度估算

預設權重：

| 因子 | 權重 | 算法 |
|---|---:|---|
| OpenCode tasks | 0.50 | completed / 非 cancelled tasks；TODO/FIXME 加入 pending 分母 |
| TODO/FIXME | 0.10 | open markers 相對 `markerBudget` 的反向分數 |
| Git | 0.20 | commit target、worktree clean、conflicts、upstream behind |
| Files | 0.20 | `(total - changed) / total` |

這是 heuristic，不是專案管理系統的真實完成率。若 OpenCode todos 有維護，task 部分最有意義。

## 自訂選項

| 選項 | 預設 | 說明 |
|---|---:|---|
| `scope` | `session` | `session` 或 `project` |
| `refreshIntervalMs` | `5000` | UI refresh；限制 3000-8000 ms |
| `progressRefreshIntervalMs` | `30000` | Git/TODO scan 間隔 |
| `activeWindowMs` | `120000` | 兩事件間最多計入 active time 的時間 |
| `todoPatterns` | `TODO,FIXME` | `git grep` marker patterns |
| `markerBudget` | `50` | marker 分數歸零門檻 |
| `targetCommitCount` | `20` | commit 進度滿分門檻 |
| `progressWeights` | `0.5/0.1/0.2/0.2` | tasks/markers/git/files，自動正規化 |
| `maxScanFiles` | `20000` | 大型 repo 掃描上限 |
| `showCache` | `true` | 顯示 cache read/write |
| `showReasoning` | `false` | 額外顯示 reasoning；預設已併入 output |
| `pricing` | 全 0 | message cost 為 0 時的每百萬 token 備援費率 |
| `compactBreakpoint` | `100` | terminal 寬度低於此值時使用 compact format |
| `toastFallback` | `false` | server plugin 的低頻 toast workaround |

自訂費率範例：

```json
{
  "pricing": {
    "inputPerMillion": 2.5,
    "outputPerMillion": 10,
    "cacheReadPerMillion": 0.25,
    "cacheWritePerMillion": 3.0
  }
}
```

## 準確性與邊緣情況

- Token 以 assistant message ID 去重；message 更新會覆蓋舊 snapshot，不會重複累加。
- 成本優先使用 OpenCode message 的 `cost`；只有 cost 為 0 才用自訂 pricing，因此畫面使用 `~$`。
- Project 累計只包含 plugin 看過的 session。首次安裝不會回溯所有歷史 session。
- Active time 監聽 keyboard、paste、message、streaming part、session status、todo 與 tool fallback events；長時間無事件會受 `activeWindowMs` 截斷。
- 切換專案時會 flush 舊 project state，再開啟新 project state。
- 非 Git 專案只用 OpenCode todos 計算進度。
- `git grep` 只掃 tracked text files，因此不會遍歷 `node_modules`、build output 或 binary files。

## 效能

- Status render 不呼叫模型，也不消耗 token。
- 每次 UI refresh 只做記憶體聚合與必要的 state flush。
- Git/TODO scan 有獨立較慢 interval、file cap 與 16 MiB output cap。
- State 有 session/message 上限，預設 200 sessions、每 session 5000 assistant messages。

## 測試與驗證

```bash
npm run validate
```

驗證內容：TypeScript typecheck、unit tests、臨時 Git repo integration test、production build、`npm pack --dry-run`。

手動 TUI 驗證：

1. 安裝後執行 `opencode`。
2. 確認底部出現 `[SESSION] Tokens ... | Time ... | Progress ...`。
3. 傳送一則 prompt，確認 input/output token 與 active time 增加。
4. 建立或完成 OpenCode todo，確認下一次 progress scan 更新。
5. 修改 tracked file 或加入 TODO，確認進度與 branch 狀態更新。
6. 按 `Ctrl+Shift+S`，確認 `[SESSION]` / `[PROJECT]` 切換並在重啟後保留。

除錯：

```bash
opencode --print-logs --log-level DEBUG
```

在 TUI 執行 `/plugins`，確認 `opencode.status-footer` 為 enabled/active。載入失敗時先確認 `dist/tui.js` 存在、OpenCode 版本至少為 1.17.6，並重跑 `npm run validate`。

## 移除

只移除精確的 plugin config entry，不改其他 plugin：

### Linux / macOS

```bash
./scripts/uninstall.sh --project-path /path/to/your-project
./scripts/uninstall.sh --global
./scripts/uninstall.sh --project-path /path/to/your-project --remove-state
```

### Windows

```powershell
.\scripts\uninstall.ps1 -ProjectPath D:\your-project
.\scripts\uninstall.ps1 -Global
.\scripts\uninstall.ps1 -ProjectPath D:\your-project -RemoveState
```
