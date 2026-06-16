import type { AgentUsage, MetricsSnapshot, ProjectProgress, StatusFooterOptions, TokenUsage } from "./types.js"
import { estimateCost, totalTokens } from "./usage.js"

export function compactNumber(value: number): string {
  if (value < 1_000) return Math.round(value).toString()
  if (value < 1_000_000) return `${trim(value / 1_000)}k`
  if (value < 1_000_000_000) return `${trim(value / 1_000_000)}m`
  return `${trim(value / 1_000_000_000)}b`
}

function trim(value: number): string {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return value.toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0+$/, "")
}

export function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000))
  const days = Math.floor(totalMinutes / 1_440)
  const hours = Math.floor((totalMinutes % 1_440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function progressBar(percent: number, width: number): string {
  const safePercent = Math.max(0, Math.min(100, percent))
  const filled = Math.round((safePercent / 100) * width)
  return `${"#".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}`
}

export function formatSpeed(speed: number): string {
  if (speed <= 0) return ""
  return `▲ ${speed.toFixed(1)} tok/s`
}

export function formatAgentCosts(agents: AgentUsage[], compact = false): string {
  if (agents.length === 0) return ""
  const top = agents.slice(0, 3) // show top 3 agents
  const parts = top.map((a) => {
    const cost = a.cost > 0.01 ? `$${a.cost.toFixed(2)}` : `<¢1`
    return compact ? `${a.agent.slice(0, 6)}:${cost}` : `${a.agent}: ${cost}`
  })
  if (agents.length > 3) parts.push(compact ? `+${agents.length - 3}` : `+${agents.length - 3} more`)
  return compact ? parts.join(" ") : parts.join(" | ")
}

export function formatBudgetStatus(
  totalCost: number,
  maxCostUsd: number,
  warnAtPercent: number,
  compact = false,
): string {
  if (maxCostUsd <= 0) return ""
  const percent = (totalCost / maxCostUsd) * 100
  if (percent >= 100) return compact ? "⚠ BUDGET EXCEEDED" : "⚠ Budget exceeded!"
  if (percent >= warnAtPercent) return compact ? `⚠ ${percent.toFixed(0)}%` : `⚠ Budget: ${percent.toFixed(0)}% used`
  return ""
}

export function formatTokens(usage: TokenUsage, options: StatusFooterOptions, compact = false, modelId?: string): string {
  const output = options.showReasoning ? usage.output : usage.output + usage.reasoning
  const details = compact
    ? `I:${compactNumber(usage.input)} O:${compactNumber(output)}`
    : `I: ${compactNumber(usage.input)} / O: ${compactNumber(output)}`
  const reasoning = options.showReasoning && usage.reasoning > 0 ? ` / R: ${compactNumber(usage.reasoning)}` : ""
  const cache =
    options.showCache && (usage.cacheRead > 0 || usage.cacheWrite > 0)
      ? compact
        ? ` C:${compactNumber(usage.cacheRead)}/${compactNumber(usage.cacheWrite)}`
        : ` / C: ${compactNumber(usage.cacheRead)}r+${compactNumber(usage.cacheWrite)}w`
      : ""
  const cost = estimateCost(usage, options.pricing, modelId)
  const costText = options.showCost && cost > 0 ? ` ~$${cost.toFixed(cost < 10 ? 2 : 1)}` : ""
  return compact
    ? `Tok ${compactNumber(totalTokens(usage))} (${details}${reasoning}${cache})${costText}`
    : `Tokens: ${compactNumber(totalTokens(usage))} (${details}${reasoning}${cache})${costText}`
}

export function formatTime(snapshot: MetricsSnapshot, compact = false): string {
  const value = `${formatDuration(snapshot.totalMs)}${compact ? "/" : " (Active: "}${formatDuration(snapshot.activeMs)}${compact ? "" : ")"}`
  return compact ? `Time ${value}` : `Time: ${value}`
}

export function formatProgress(progress: ProjectProgress, options: StatusFooterOptions, compact = false): string {
  const tasks = `[${progress.completedTasks}/${progress.totalTasks} tasks]`
  const bar = progressBar(progress.percent, compact ? Math.min(6, options.progressBarWidth) : options.progressBarWidth)
  return compact
    ? `Prog ${progress.percent}% ${bar} ${tasks}`
    : `Progress: ${progress.percent}% ${bar} ${tasks}`
}

export function formatStatusLine(
  snapshot: MetricsSnapshot,
  progress: ProjectProgress,
  options: StatusFooterOptions,
  compact = false,
  speed = 0,
  agents: AgentUsage[] = [],
  totalCost = 0,
  modelId?: string,
): string {
  const parts: string[] = [
    formatTokens(snapshot.tokens, options, compact, modelId),
    formatTime(snapshot, compact),
    formatProgress(progress, options, compact),
  ]

  const speedText = options.showSpeed ? formatSpeed(speed) : ""
  if (speedText) parts.push(speedText)

  const agentText = options.showAgentCosts ? formatAgentCosts(agents, compact) : ""
  if (agentText) parts.push(agentText)

  const budgetStatus = formatBudgetStatus(totalCost, options.budget.maxCostUsd, options.budget.warnAtPercent, compact)
  if (budgetStatus) parts.push(budgetStatus)

  return parts.join(compact ? " | " : "  |  ")
}
