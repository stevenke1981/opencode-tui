/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { formatStatusLine } from "./format.js"
import { parseOptions } from "./options.js"
import { emptyProgress, scanProject } from "./project.js"
import { MetricsStore } from "./state.js"
import type { DisplayScope, ProjectProgress } from "./types.js"

const PLUGIN_ID = "opencode.status-footer"
const SCOPE_KEY = `${PLUGIN_ID}.scope`

function currentSessionID(api: TuiPluginApi): string | undefined {
  const route = api.route.current
  if (route.name !== "session" || !("params" in route)) return undefined
  return typeof route.params?.sessionID === "string" ? route.params.sessionID : undefined
}

function eventSessionID(event: { properties?: unknown }): string | undefined {
  if (!event.properties || typeof event.properties !== "object") return undefined
  const properties = event.properties as Record<string, unknown>
  if (typeof properties.sessionID === "string") return properties.sessionID
  if (properties.info && typeof properties.info === "object") {
    const info = properties.info as Record<string, unknown>
    if (typeof info.sessionID === "string") return info.sessionID
  }
  return undefined
}

function StatusBar(props: {
  api: TuiPluginApi
  line: () => string
  scope: () => DisplayScope
  progress: () => ProjectProgress
}) {
  const theme = () => props.api.theme.current
  const branch = () => props.progress().git.branch

  return (
    <box
      width="100%"
      paddingLeft={2}
      paddingRight={2}
      flexDirection="row"
      flexShrink={0}
      gap={1}
      backgroundColor={theme().backgroundPanel}
    >
      <text fg={theme().primary}>{props.scope() === "project" ? "[PROJECT]" : "[SESSION]"}</text>
      <text fg={theme().text}>{props.line()}</text>
      <box flexGrow={1} />
      <text fg={theme().textMuted}>{branch()}</text>
    </box>
  )
}

const tui: TuiPlugin = async (api, rawOptions) => {
  const options = parseOptions(rawOptions)
  const storedScope = api.kv.get<DisplayScope>(SCOPE_KEY, options.scope)
  const [scope, setScope] = createSignal<DisplayScope>(storedScope === "project" ? "project" : "session")
  const [line, setLine] = createSignal("Tokens: 0 | Time: 0m (Active: 0m) | Progress: scanning...")
  const [progress, setProgress] = createSignal<ProjectProgress>(emptyProgress())
  let store: MetricsStore | undefined
  let directory = ""
  let refreshRunning = false
  let scanAt = 0

  async function ensureStore(): Promise<MetricsStore | undefined> {
    const nextDirectory = api.state.path.directory || api.state.path.worktree
    if (!nextDirectory) return undefined
    if (store && directory === nextDirectory) return store
    if (store) await store.flush()
    directory = nextDirectory
    store = await MetricsStore.open(directory, options)
    scanAt = 0
    return store
  }

  async function refresh(forceScan = false): Promise<void> {
    if (refreshRunning) return
    refreshRunning = true
    try {
      const metrics = await ensureStore()
      if (!metrics) return
      const sessionID = currentSessionID(api)
      if (sessionID) {
        const info = api.state.session.get(sessionID)
        metrics.reconcileSession(sessionID, api.state.session.messages(sessionID), info)
        metrics.updateTodos(sessionID, api.state.session.todo(sessionID))
      }

      const now = Date.now()
      // Rendering is cheap; repository scans are intentionally throttled separately.
      if (forceScan || now >= scanAt) {
        setProgress(await scanProject(directory, metrics.todoSummary(sessionID, scope()), options))
        scanAt = now + options.progressRefreshIntervalMs
      }
      const snapshot = metrics.snapshot(scope(), sessionID, now)
      const compact = api.renderer.terminalWidth < options.compactBreakpoint
      setLine(formatStatusLine(snapshot, progress(), options, compact))
      await metrics.flush()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLine(`Status footer error: ${message}`)
    } finally {
      refreshRunning = false
    }
  }

  function markCurrentActivity(): void {
    const sessionID = currentSessionID(api)
    if (!sessionID || !store) return
    store.markActivity(sessionID)
  }

  const eventDisposers = [
    api.event.on("message.updated", (event) => {
      const sessionID = eventSessionID(event)
      if (!sessionID || !store) return
      store.updateMessage(sessionID, event.properties.info)
    }),
    api.event.on("message.removed", (event) => {
      if (!store) return
      store.removeMessage(event.properties.sessionID, event.properties.messageID)
    }),
    api.event.on("message.part.updated", (event) => {
      if (!store) return
      store.markActivity(event.properties.sessionID, event.properties.time)
    }),
    api.event.on("session.status", (event) => {
      if (!store) return
      store.markActivity(event.properties.sessionID)
    }),
    api.event.on("todo.updated", (event) => {
      if (!store) return
      store.updateTodos(event.properties.sessionID, event.properties.todos)
      scanAt = 0
    }),
  ]

  const onKeypress = () => markCurrentActivity()
  const onPaste = () => markCurrentActivity()
  api.renderer.keyInput.on("keypress", onKeypress)
  api.renderer.keyInput.on("paste", onPaste)

  api.keymap.registerLayer({
    mode: "base",
    commands: [
      {
        name: "status-footer.scope.toggle",
        title: "Toggle status footer scope",
        category: "Status",
        namespace: "palette",
        slashName: "status-scope",
        run() {
          const next = scope() === "session" ? "project" : "session"
          setScope(next)
          api.kv.set(SCOPE_KEY, next)
          scanAt = 0
          void refresh(true)
          api.ui.toast({
            title: "Status footer",
            message: `Scope changed to ${next}`,
            variant: "info",
            duration: 2_000,
          })
        },
      },
    ],
    bindings: [{ key: options.toggleKey, cmd: "status-footer.scope.toggle", desc: "Toggle status scope" }],
  })

  api.slots.register({
    order: 20,
    slots: {
      app_bottom() {
        return <StatusBar api={api} line={line} scope={scope} progress={progress} />
      },
    },
  })

  const timer = setInterval(() => void refresh(), options.refreshIntervalMs)
  api.lifecycle.onDispose(async () => {
    clearInterval(timer)
    for (const dispose of eventDisposers) dispose()
    api.renderer.keyInput.off("keypress", onKeypress)
    api.renderer.keyInput.off("paste", onPaste)
    await store?.flush()
  })

  await refresh(true)
}

const plugin: TuiPluginModule & { id: string } = {
  id: PLUGIN_ID,
  tui,
}

export default plugin
