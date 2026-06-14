import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
  DisplayScope,
  MetricsSnapshot,
  PersistedState,
  SessionMetrics,
  StatusFooterOptions,
  TodoSummary,
  TokenUsage,
} from "./types.js"
import { EMPTY_USAGE, messageUsage, sumUsage } from "./usage.js"

type SessionLike = {
  id?: string
  time?: {
    created?: number
    updated?: number
  }
}

type MessageLike = {
  id?: string
  role?: string
  time?: {
    created?: number
    completed?: number
  }
}

const EMPTY_TODOS: TodoSummary = { completed: 0, total: 0 }

function emptyState(): PersistedState {
  return { version: 1, updatedAt: Date.now(), sessions: {} }
}

function emptySession(startedAt = Date.now()): SessionMetrics {
  return {
    startedAt,
    lastActivityAt: startedAt,
    lastSeenAt: startedAt,
    activeMs: 0,
    messages: {},
    todos: { ...EMPTY_TODOS },
  }
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback
}

function normalizeSession(value: unknown): SessionMetrics | undefined {
  if (!value || typeof value !== "object") return undefined
  const item = value as Partial<SessionMetrics>
  const startedAt = finite(item.startedAt, Date.now())
  const messages = item.messages && typeof item.messages === "object" ? item.messages : {}
  const todos = item.todos && typeof item.todos === "object" ? item.todos : EMPTY_TODOS
  return {
    startedAt,
    lastActivityAt: finite(item.lastActivityAt, startedAt),
    lastSeenAt: finite(item.lastSeenAt, startedAt),
    activeMs: finite(item.activeMs, 0),
    messages,
    todos: {
      completed: finite(todos.completed, 0),
      total: finite(todos.total, 0),
    },
  }
}

function normalizeState(value: unknown): PersistedState {
  if (!value || typeof value !== "object") return emptyState()
  const item = value as Partial<PersistedState>
  const sessions: Record<string, SessionMetrics> = {}
  if (item.sessions && typeof item.sessions === "object") {
    for (const [id, candidate] of Object.entries(item.sessions)) {
      const session = normalizeSession(candidate)
      if (session) sessions[id] = session
    }
  }
  return {
    version: 1,
    updatedAt: finite(item.updatedAt, Date.now()),
    sessions,
  }
}

function resolveStatePath(directory: string, relativePath: string): string {
  const root = path.resolve(directory)
  const target = path.resolve(root, relativePath)
  const relative = path.relative(root, target)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`stateFile must stay inside the project directory: ${relativePath}`)
  }
  return target
}

function messageStart(info: MessageLike, fallback: number): number {
  return finite(info.time?.created, fallback)
}

function sessionStart(info: SessionLike | undefined, fallback: number): number {
  return finite(info?.time?.created, fallback)
}

function usageFor(session: SessionMetrics | undefined): TokenUsage {
  if (!session) return { ...EMPTY_USAGE }
  return sumUsage(Object.values(session.messages))
}

export class MetricsStore {
  readonly directory: string
  readonly filePath: string
  private state: PersistedState
  private dirty = false
  private flushPromise: Promise<void> = Promise.resolve()

  private constructor(directory: string, filePath: string, state: PersistedState, private readonly options: StatusFooterOptions) {
    this.directory = directory
    this.filePath = filePath
    this.state = state
    this.prune()
  }

  static async open(directory: string, options: StatusFooterOptions): Promise<MetricsStore> {
    const filePath = resolveStatePath(directory, options.stateFile)
    let state = emptyState()
    try {
      state = normalizeState(JSON.parse(await readFile(filePath, "utf8")))
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
      if (code !== "ENOENT" && !(error instanceof SyntaxError)) throw error
    }
    return new MetricsStore(directory, filePath, state, options)
  }

  markActivity(sessionID: string, at = Date.now(), startedAt?: number): void {
    const session = this.ensureSession(sessionID, startedAt ?? at)
    if (at > session.lastActivityAt) {
      // Cap idle gaps so leaving the TUI open does not inflate active editing time.
      session.activeMs += Math.min(at - session.lastActivityAt, this.options.activeWindowMs)
      session.lastActivityAt = at
    }
    session.lastSeenAt = Math.max(session.lastSeenAt, at)
    if (startedAt !== undefined) session.startedAt = Math.min(session.startedAt, startedAt)
    this.touch()
  }

  updateMessage(sessionID: string, info: MessageLike & Record<string, unknown>, at = Date.now()): void {
    if (!info.id) return
    const usage = messageUsage(info, at)
    if (!usage) {
      this.markActivity(sessionID, at, messageStart(info, at))
      return
    }
    const session = this.ensureSession(sessionID, messageStart(info, at))
    session.messages[info.id] = usage
    session.startedAt = Math.min(session.startedAt, messageStart(info, at))
    this.markActivity(sessionID, at)
    this.pruneMessages(session)
  }

  removeMessage(sessionID: string, messageID: string): void {
    const session = this.state.sessions[sessionID]
    if (!session || !session.messages[messageID]) return
    delete session.messages[messageID]
    this.touch()
  }

  reconcileSession(sessionID: string, messages: readonly unknown[], info?: SessionLike): void {
    const now = Date.now()
    const session = this.ensureSession(sessionID, sessionStart(info, now))
    const next: SessionMetrics["messages"] = {}
    let earliest = sessionStart(info, session.startedAt)
    for (const candidate of messages) {
      if (!candidate || typeof candidate !== "object") continue
      const message = candidate as MessageLike & Record<string, unknown>
      if (!message.id) continue
      const usage = messageUsage(message, finite(message.time?.completed, now))
      if (!usage) continue
      next[message.id] = usage
      earliest = Math.min(earliest, messageStart(message, earliest))
    }
    // Replacing the map makes resumed sessions exact and removes deleted messages.
    session.messages = next
    session.startedAt = earliest
    session.lastSeenAt = Math.max(session.lastSeenAt, finite(info?.time?.updated, now))
    this.pruneMessages(session)
    this.touch()
  }

  updateTodos(sessionID: string, todos: readonly { status?: string }[]): void {
    const active = todos.filter((todo) => todo.status !== "cancelled")
    const completed = active.filter((todo) => todo.status === "completed").length
    const session = this.ensureSession(sessionID)
    session.todos = { completed, total: active.length }
    this.touch()
  }

  snapshot(scope: DisplayScope, sessionID: string | undefined, now = Date.now()): MetricsSnapshot {
    const sessions = Object.entries(this.state.sessions)
    const selected = sessionID ? this.state.sessions[sessionID] : undefined
    if (scope === "session") {
      return {
        scope,
        tokens: usageFor(selected),
        totalMs: selected ? Math.max(0, now - selected.startedAt) : 0,
        activeMs: selected ? this.activeWithTail(selected, now) : 0,
        sessionCount: selected ? 1 : 0,
      }
    }

    const tokens = sumUsage(sessions.map(([, session]) => usageFor(session)))
    let totalMs = 0
    let activeMs = 0
    for (const [id, session] of sessions) {
      const end = id === sessionID ? now : Math.max(session.lastSeenAt, session.startedAt)
      totalMs += Math.max(0, end - session.startedAt)
      activeMs += this.activeWithTail(session, now)
    }
    return { scope, tokens, totalMs, activeMs, sessionCount: sessions.length }
  }

  todoSummary(sessionID: string | undefined, scope: DisplayScope = "session"): TodoSummary {
    if (scope === "session") {
      if (!sessionID) return { ...EMPTY_TODOS }
      return { ...(this.state.sessions[sessionID]?.todos ?? EMPTY_TODOS) }
    }
    return Object.values(this.state.sessions).reduce<TodoSummary>(
      (total, session) => ({
        completed: total.completed + session.todos.completed,
        total: total.total + session.todos.total,
      }),
      { ...EMPTY_TODOS },
    )
  }

  async flush(): Promise<void> {
    if (!this.dirty) return this.flushPromise
    this.dirty = false
    this.state.updatedAt = Date.now()
    const payload = `${JSON.stringify(this.state, null, 2)}\n`
    const target = this.filePath
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`
    // Serialize writes and replace through a temporary file to avoid partial JSON.
    this.flushPromise = this.flushPromise.then(async () => {
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(temporary, payload, "utf8")
      try {
        await rename(temporary, target)
      } catch {
        await rm(target, { force: true })
        await rename(temporary, target)
      }
    })
    return this.flushPromise
  }

  private ensureSession(sessionID: string, startedAt = Date.now()): SessionMetrics {
    const existing = this.state.sessions[sessionID]
    if (existing) return existing
    const created = emptySession(startedAt)
    this.state.sessions[sessionID] = created
    this.prune()
    this.touch()
    return created
  }

  private activeWithTail(session: SessionMetrics, now: number): number {
    const tail = Math.min(Math.max(0, now - session.lastActivityAt), this.options.activeWindowMs)
    return session.activeMs + tail
  }

  private pruneMessages(session: SessionMetrics): void {
    const entries = Object.entries(session.messages)
    if (entries.length <= this.options.maxMessagesPerSession) return
    entries.sort((left, right) => right[1].updatedAt - left[1].updatedAt)
    session.messages = Object.fromEntries(entries.slice(0, this.options.maxMessagesPerSession))
  }

  private prune(): void {
    const entries = Object.entries(this.state.sessions)
    if (entries.length <= this.options.maxSessions) return
    entries.sort((left, right) => right[1].lastSeenAt - left[1].lastSeenAt)
    this.state.sessions = Object.fromEntries(entries.slice(0, this.options.maxSessions))
    this.touch()
  }

  private touch(): void {
    this.dirty = true
  }
}
