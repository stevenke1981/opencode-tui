export type DisplayScope = "session" | "project"

export type TokenUsage = {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  cost: number
}
export type MessageUsage = TokenUsage & {
  updatedAt: number
}

export type TodoSummary = {
  completed: number
  total: number
}

export type SessionMetrics = {
  startedAt: number
  lastActivityAt: number
  lastSeenAt: number
  activeMs: number
  messages: Record<string, MessageUsage>
  todos: TodoSummary
}

export type PersistedState = {
  version: 1
  updatedAt: number
  sessions: Record<string, SessionMetrics>
}

export type GitProgress = {
  available: boolean
  branch: string
  commits: number
  ahead: number
  behind: number
  changedFiles: number
  conflictedFiles: number
  totalFiles: number
  completedFiles: number
}

export type ProjectProgress = {
  percent: number
  completedTasks: number
  totalTasks: number
  openMarkers: number
  git: GitProgress
}

export type MetricsSnapshot = {
  scope: DisplayScope
  tokens: TokenUsage
  totalMs: number
  activeMs: number
  sessionCount: number
}

export type ProgressWeights = {
  tasks: number
  markers: number
  git: number
  files: number
}

export type PricingOptions = {
  inputPerMillion: number
  outputPerMillion: number
  cacheReadPerMillion: number
  cacheWritePerMillion: number
}

export type StatusFooterOptions = {
  scope: DisplayScope
  refreshIntervalMs: number
  progressRefreshIntervalMs: number
  activeWindowMs: number
  stateFile: string
  maxSessions: number
  maxMessagesPerSession: number
  maxScanFiles: number
  todoPatterns: string[]
  markerBudget: number
  targetCommitCount: number
  progressWeights: ProgressWeights
  pricing: PricingOptions
  showCost: boolean
  showCache: boolean
  showReasoning: boolean
  compactBreakpoint: number
  progressBarWidth: number
  toggleKey: string
  toastFallback: boolean
  toastIntervalMs: number
}
