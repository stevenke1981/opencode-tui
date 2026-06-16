import type { BudgetConfig, DisplayScope, PricingOptions, ProgressWeights, StatusFooterOptions } from "./types.js"

const DEFAULT_WEIGHTS: ProgressWeights = {
  tasks: 0.5,
  markers: 0.1,
  git: 0.2,
  files: 0.2,
}
const DEFAULT_PRICING: PricingOptions = {
  inputPerMillion: 0,
  outputPerMillion: 0,
  cacheReadPerMillion: 0,
  cacheWritePerMillion: 0,
}

const DEFAULT_BUDGET: BudgetConfig = {
  maxCostUsd: 0,
  warnAtPercent: 80,
  mode: "warn",
}

export const DEFAULT_OPTIONS: StatusFooterOptions = {
  scope: "session",
  refreshIntervalMs: 5_000,
  progressRefreshIntervalMs: 30_000,
  activeWindowMs: 120_000,
  stateFile: ".opencode/status-footer/state.json",
  maxSessions: 200,
  maxMessagesPerSession: 5_000,
  maxScanFiles: 20_000,
  todoPatterns: ["TODO", "FIXME"],
  markerBudget: 50,
  targetCommitCount: 20,
  progressWeights: DEFAULT_WEIGHTS,
  pricing: DEFAULT_PRICING,
  showCost: true,
  showCache: true,
  showReasoning: false,
  compactBreakpoint: 100,
  progressBarWidth: 10,
  toggleKey: "ctrl+shift+s",
  toastFallback: false,
  toastIntervalMs: 30_000,
  showSpeed: true,
  showAgentCosts: false,
  budget: { ...DEFAULT_BUDGET },
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function scope(value: unknown): DisplayScope {
  return value === "project" ? "project" : "session"
}

function weights(value: unknown): ProgressWeights {
  const input = record(value)
  const parsed = {
    tasks: number(input.tasks, DEFAULT_WEIGHTS.tasks, 0, 1),
    markers: number(input.markers, DEFAULT_WEIGHTS.markers, 0, 1),
    git: number(input.git, DEFAULT_WEIGHTS.git, 0, 1),
    files: number(input.files, DEFAULT_WEIGHTS.files, 0, 1),
  }
  const total = parsed.tasks + parsed.markers + parsed.git + parsed.files
  if (total <= 0) return { ...DEFAULT_WEIGHTS }
  return {
    tasks: parsed.tasks / total,
    markers: parsed.markers / total,
    git: parsed.git / total,
    files: parsed.files / total,
  }
}

function pricing(value: unknown): PricingOptions {
  const input = record(value)
  return {
    inputPerMillion: number(input.inputPerMillion, 0, 0, 1_000_000),
    outputPerMillion: number(input.outputPerMillion, 0, 0, 1_000_000),
    cacheReadPerMillion: number(input.cacheReadPerMillion, 0, 0, 1_000_000),
    cacheWritePerMillion: number(input.cacheWritePerMillion, 0, 0, 1_000_000),
  }
}

function budget(value: unknown): BudgetConfig {
  const input = record(value)
  return {
    maxCostUsd: number(input.maxCostUsd, DEFAULT_BUDGET.maxCostUsd, 0, 1_000_000),
    warnAtPercent: number(input.warnAtPercent, DEFAULT_BUDGET.warnAtPercent, 0, 100),
    mode: input.mode === "block" ? "block" : "warn",
  }
}

export function parseOptions(value: unknown): StatusFooterOptions {
  const input = record(value)
  const patterns = Array.isArray(input.todoPatterns)
    ? input.todoPatterns.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 20)
    : DEFAULT_OPTIONS.todoPatterns

  return {
    scope: scope(input.scope),
    refreshIntervalMs: number(input.refreshIntervalMs, DEFAULT_OPTIONS.refreshIntervalMs, 3_000, 8_000),
    progressRefreshIntervalMs: number(
      input.progressRefreshIntervalMs,
      DEFAULT_OPTIONS.progressRefreshIntervalMs,
      10_000,
      600_000,
    ),
    activeWindowMs: number(input.activeWindowMs, DEFAULT_OPTIONS.activeWindowMs, 10_000, 900_000),
    stateFile:
      typeof input.stateFile === "string" && input.stateFile.trim() ? input.stateFile.trim() : DEFAULT_OPTIONS.stateFile,
    maxSessions: number(input.maxSessions, DEFAULT_OPTIONS.maxSessions, 1, 5_000),
    maxMessagesPerSession: number(input.maxMessagesPerSession, DEFAULT_OPTIONS.maxMessagesPerSession, 10, 100_000),
    maxScanFiles: number(input.maxScanFiles, DEFAULT_OPTIONS.maxScanFiles, 100, 200_000),
    todoPatterns: patterns.length > 0 ? patterns : DEFAULT_OPTIONS.todoPatterns,
    markerBudget: number(input.markerBudget, DEFAULT_OPTIONS.markerBudget, 1, 100_000),
    targetCommitCount: number(input.targetCommitCount, DEFAULT_OPTIONS.targetCommitCount, 1, 100_000),
    progressWeights: weights(input.progressWeights),
    pricing: pricing(input.pricing),
    showCost: boolean(input.showCost, DEFAULT_OPTIONS.showCost),
    showCache: boolean(input.showCache, DEFAULT_OPTIONS.showCache),
    showReasoning: boolean(input.showReasoning, DEFAULT_OPTIONS.showReasoning),
    compactBreakpoint: number(input.compactBreakpoint, DEFAULT_OPTIONS.compactBreakpoint, 60, 400),
    progressBarWidth: number(input.progressBarWidth, DEFAULT_OPTIONS.progressBarWidth, 5, 30),
    toggleKey: typeof input.toggleKey === "string" && input.toggleKey.trim() ? input.toggleKey : DEFAULT_OPTIONS.toggleKey,
    toastFallback: boolean(input.toastFallback, DEFAULT_OPTIONS.toastFallback),
    toastIntervalMs: number(input.toastIntervalMs, DEFAULT_OPTIONS.toastIntervalMs, 10_000, 600_000),
    showSpeed: boolean(input.showSpeed, DEFAULT_OPTIONS.showSpeed),
    showAgentCosts: boolean(input.showAgentCosts, DEFAULT_OPTIONS.showAgentCosts),
    budget: budget(input.budget),
  }
}
