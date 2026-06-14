import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { compactNumber, formatDuration, formatStatusLine, progressBar } from "../dist/format.js"
import { DEFAULT_OPTIONS, parseOptions } from "../dist/options.js"
import { MetricsStore } from "../dist/state.js"
import { messageUsage, totalTokens } from "../dist/usage.js"

test("parseOptions clamps refresh intervals and normalizes weights", () => {
  const options = parseOptions({
    refreshIntervalMs: 100,
    progressRefreshIntervalMs: 1_000_000,
    progressWeights: { tasks: 2, markers: 0, git: 0, files: 0 },
  })
  assert.equal(options.refreshIntervalMs, 3_000)
  assert.equal(options.progressRefreshIntervalMs, 600_000)
  assert.equal(options.progressWeights.tasks, 1)
})
test("message usage preserves cache and reasoning token categories", () => {
  const usage = messageUsage({
    role: "assistant",
    cost: 0.48,
    tokens: {
      input: 89_000,
      output: 30_000,
      reasoning: 5_000,
      cache: { read: 10_000, write: 2_000 },
    },
  })
  assert.ok(usage)
  assert.equal(totalTokens(usage), 136_000)
  assert.equal(usage.cacheRead, 10_000)
  assert.equal(usage.cost, 0.48)
})

test("formatters render compact counts, durations, and progress bars", () => {
  assert.equal(compactNumber(124_000), "124k")
  assert.equal(formatDuration(9_300_000), "2h 35m")
  assert.equal(progressBar(67, 10), "#######---")

  const line = formatStatusLine(
    {
      scope: "session",
      tokens: { input: 89_000, output: 30_000, reasoning: 5_000, cacheRead: 0, cacheWrite: 0, cost: 0.48 },
      totalMs: 9_300_000,
      activeMs: 6_480_000,
      sessionCount: 1,
    },
    {
      percent: 67,
      completedTasks: 42,
      totalTasks: 63,
      openMarkers: 0,
      git: {
        available: true,
        branch: "main",
        commits: 20,
        ahead: 0,
        behind: 0,
        changedFiles: 0,
        conflictedFiles: 0,
        totalFiles: 10,
        completedFiles: 10,
      },
    },
    DEFAULT_OPTIONS,
  )
  assert.match(line, /Tokens: 124k/)
  assert.match(line, /Time: 2h 35m \(Active: 1h 48m\)/)
  assert.match(line, /Progress: 67% #######--- \[42\/63 tasks\]/)
})

test("MetricsStore de-duplicates message updates and persists project totals", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "status-footer-state-"))
  try {
    const options = parseOptions({ stateFile: ".opencode/test-state.json", activeWindowMs: 10_000 })
    const store = await MetricsStore.open(directory, options)
    const message = {
      id: "msg-1",
      role: "assistant",
      time: { created: 1_000, completed: 2_000 },
      cost: 0.1,
      tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 20, write: 5 } },
    }
    store.updateMessage("session-1", message, 2_000)
    store.updateMessage("session-1", { ...message, tokens: { ...message.tokens, output: 75 } }, 3_000)
    store.updateTodos("session-1", [{ status: "completed" }, { status: "pending" }])
    await store.flush()

    const snapshot = store.snapshot("project", "session-1", 4_000)
    assert.equal(snapshot.tokens.output, 75)
    assert.equal(snapshot.tokens.input, 100)
    assert.deepEqual(store.todoSummary("session-1"), { completed: 1, total: 2 })

    const persisted = JSON.parse(await readFile(path.join(directory, ".opencode/test-state.json"), "utf8"))
    assert.equal(Object.keys(persisted.sessions["session-1"].messages).length, 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
