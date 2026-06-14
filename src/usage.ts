import type { MessageUsage, PricingOptions, TokenUsage } from "./types.js"

export const EMPTY_USAGE: TokenUsage = {
  input: 0,
  output: 0,
  reasoning: 0,
  cacheRead: 0,
  cacheWrite: 0,
  cost: 0,
}
type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {}
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0
}

export function messageUsage(value: unknown, updatedAt = Date.now()): MessageUsage | undefined {
  const info = record(value)
  if (info.role !== "assistant") return undefined
  const tokens = record(info.tokens)
  const cache = record(tokens.cache)
  return {
    input: finite(tokens.input),
    output: finite(tokens.output),
    reasoning: finite(tokens.reasoning),
    cacheRead: finite(cache.read),
    cacheWrite: finite(cache.write),
    cost: finite(info.cost),
    updatedAt,
  }
}

export function addUsage(left: TokenUsage, right: TokenUsage): TokenUsage {
  return {
    input: left.input + right.input,
    output: left.output + right.output,
    reasoning: left.reasoning + right.reasoning,
    cacheRead: left.cacheRead + right.cacheRead,
    cacheWrite: left.cacheWrite + right.cacheWrite,
    cost: left.cost + right.cost,
  }
}

export function sumUsage(values: Iterable<TokenUsage>): TokenUsage {
  let total = { ...EMPTY_USAGE }
  for (const value of values) total = addUsage(total, value)
  return total
}

export function estimateCost(usage: TokenUsage, pricing: PricingOptions): number {
  if (usage.cost > 0) return usage.cost
  return (
    usage.input * pricing.inputPerMillion +
    (usage.output + usage.reasoning) * pricing.outputPerMillion +
    usage.cacheRead * pricing.cacheReadPerMillion +
    usage.cacheWrite * pricing.cacheWritePerMillion
  ) / 1_000_000
}

export function totalTokens(usage: TokenUsage): number {
  return usage.input + usage.output + usage.reasoning + usage.cacheRead + usage.cacheWrite
}
