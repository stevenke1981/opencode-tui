import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import plugin from "../dist/tui.js"

test("TUI plugin registers a persistent app_bottom slot", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "status-footer-tui-"))
  const keyInput = new EventEmitter()
  let slotPlugin
  let dispose
  const api = {
    app: { version: "1.17.6" },
    kv: { get: (_key, fallback) => fallback, set: () => {}, ready: true },
    state: {
      path: { directory, worktree: directory, state: "", config: "" },
      session: {
        get: () => ({ id: "session-1", time: { created: Date.now() - 60_000, updated: Date.now() } }),
        messages: () => [
          {
            id: "message-1",
            role: "assistant",
            time: { created: Date.now() - 30_000, completed: Date.now() - 20_000 },
            cost: 0.01,
            tokens: { input: 100, output: 20, reasoning: 5, cache: { read: 10, write: 0 } },
          },
        ],
        todo: () => [{ content: "test", status: "completed" }],
      },
    },
    route: { current: { name: "session", params: { sessionID: "session-1" } } },
    renderer: { terminalWidth: 120, keyInput },
    event: { on: () => () => {} },
    keymap: { registerLayer: () => () => {} },
    slots: {
      register(value) {
        slotPlugin = value
        return "fixture-slot"
      },
    },
    lifecycle: {
      onDispose(callback) {
        dispose = callback
        return () => {}
      },
    },
    ui: { toast: () => {} },
    theme: {
      current: {
        primary: "blue",
        text: "white",
        textMuted: "gray",
        backgroundPanel: "black",
      },
    },
  }

  try {
    await plugin.tui(api, { refreshIntervalMs: 3_000 }, { state: "first" })
    assert.ok(slotPlugin)
    assert.equal(typeof slotPlugin.slots.app_bottom, "function")
    assert.equal(slotPlugin.order, 20)
  } finally {
    await dispose?.()
    await rm(directory, { recursive: true, force: true })
  }
})
