import type { MetricsSnapshot, ProjectProgress, StatusFooterOptions, TokenUsage } from "./types.js"
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

export function formatTokens(usage: TokenUsage, options: StatusFooterOptions, compact = false): string {
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
  const cost = estimateCost(usage, options.pricing)
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
): string {
  return [formatTokens(snapshot.tokens, options, compact), formatTime(snapshot, compact), formatProgress(progress, options, compact)].join(
    compact ? " | " : "  |  ",
  )
}
