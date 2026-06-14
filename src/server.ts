import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import { formatStatusLine } from "./format.js"
import { parseOptions } from "./options.js"
import { emptyProgress, scanProject } from "./project.js"
import { MetricsStore } from "./state.js"

const PLUGIN_ID = "opencode.status-footer.server"

function properties(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function sessionIDFrom(input: unknown): string | undefined {
  const item = properties(input)
  if (typeof item.sessionID === "string") return item.sessionID
  const info = properties(item.info)
  return typeof info.sessionID === "string" ? info.sessionID : undefined
}

const server: Plugin = async (ctx, rawOptions) => {
  const options = parseOptions(rawOptions)
  // Native TUI mode does not need a server plugin. This path exists for older clients.
  if (!options.toastFallback) return {}

  const store = await MetricsStore.open(ctx.directory, options)
  let activeSessionID: string | undefined
  let progress = emptyProgress()
  let scanAt = 0

  async function updateProgress(force = false): Promise<void> {
    const now = Date.now()
    if (!force && now < scanAt) return
    progress = await scanProject(ctx.directory, store.todoSummary(activeSessionID, options.scope), options)
    scanAt = now + options.progressRefreshIntervalMs
  }

  async function showToast(): Promise<void> {
    await updateProgress()
    const snapshot = store.snapshot(options.scope, activeSessionID)
    await ctx.client.tui.showToast({
      body: {
        title: "OpenCode status",
        message: formatStatusLine(snapshot, progress, options, true),
        variant: "info",
        duration: Math.min(options.toastIntervalMs - 1_000, 10_000),
      },
    })
    await store.flush()
  }

  const timer = setInterval(() => void showToast().catch(() => undefined), options.toastIntervalMs)

  return {
    dispose: async () => {
      clearInterval(timer)
      await store.flush()
    },
    event: async ({ event }) => {
      const eventProperties = properties(event.properties)
      const sessionID = sessionIDFrom(eventProperties)
      if (sessionID) {
        activeSessionID = sessionID
        store.markActivity(sessionID)
      }
      if (event.type === "message.updated" && sessionID) {
        store.updateMessage(sessionID, properties(eventProperties.info))
      } else if (event.type === "message.removed" && sessionID && typeof eventProperties.messageID === "string") {
        store.removeMessage(sessionID, eventProperties.messageID)
      } else if (event.type === "todo.updated" && sessionID && Array.isArray(eventProperties.todos)) {
        store.updateTodos(sessionID, eventProperties.todos)
        scanAt = 0
      }
    },
    "chat.message": async ({ sessionID }) => {
      activeSessionID = sessionID
      store.markActivity(sessionID)
    },
    "tool.execute.before": async ({ sessionID }) => {
      activeSessionID = sessionID
      store.markActivity(sessionID)
    },
    "tool.execute.after": async ({ sessionID }) => {
      activeSessionID = sessionID
      store.markActivity(sessionID)
    },
  }
}

const plugin: PluginModule & { id: string } = {
  id: PLUGIN_ID,
  server,
}

export default plugin
