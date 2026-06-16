import type { AgentUsage, MessageUsage, PricingOptions, TokenUsage } from "./types.js"
import { resolveModelPricing } from "./pricing.js"

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

export function agentKey(info: Record<string, unknown>): string {
  // Try common agent attribution fields
  const agent =
    typeof info.agent === "string"
      ? info.agent
      : typeof info.initiatorAgent === "string"
        ? info.initiatorAgent
        : typeof info.executingAgent === "string"
          ? info.executingAgent
          : ""
  return agent || "default"
}

export function extractAgentUsage(
  value: unknown,
  pricingInput?: PricingOptions,
  messageID?: string,
): { agent: string; usage: MessageUsage } | undefined {
  const info = record(value)
  if (info.role !== "assistant") return undefined
  const tokens = record(info.tokens)
  const cache = record(tokens.cache)
  const agent = agentKey(info)
  const costRaw = finite(info.cost)

  // If no explicit cost, estimate from model-specific pricing
  let cost = costRaw
  if (cost === 0) {
    const modelPricing = pricingInput ?? resolveModelPricing(typeof info.model === "string" ? info.model : undefined)
    if (modelPricing) {
      const input = finite(tokens.input)
      const output = finite(tokens.output) + finite(tokens.reasoning)
      const cacheRead = finite(cache.read)
      const cacheWrite = finite(cache.write)
      cost =
        (input * modelPricing.inputPerMillion +
          output * modelPricing.outputPerMillion +
          cacheRead * modelPricing.cacheReadPerMillion +
          cacheWrite * modelPricing.cacheWritePerMillion) /
        1_000_000
    }
  }

  return {
    agent,
    usage: {
      input: finite(tokens.input),
      output: finite(tokens.output),
      reasoning: finite(tokens.reasoning),
      cacheRead: finite(cache.read),
      cacheWrite: finite(cache.write),
      cost,
      updatedAt: typeof info.time === "object" && info.time !== null ? finite((info.time as Record<string, unknown>).completed) || Date.now() : Date.now(),
    },
  }
}

export function mergeAgentUsage(map: Map<string, AgentUsage>, key: string, messageUsage: MessageUsage): void {
  const existing = map.get(key)
  const total = totalTokens(messageUsage)
  if (existing) {
    existing.cost += messageUsage.cost
    existing.tokens += total
    existing.messageCount += 1
  } else {
    map.set(key, { agent: key, cost: messageUsage.cost, tokens: total, messageCount: 1 })
  }
}

export function sortedAgentUsage(map: Map<string, AgentUsage>): AgentUsage[] {
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost)
}

export function estimateCost(
  usage: TokenUsage,
  pricing: PricingOptions,
  modelId?: string,
): number {
  if (usage.cost > 0) return usage.cost

  // Use model-specific pricing from catalog if available
  const modelPricing = modelId ? resolveModelPricing(modelId) : undefined
  const active = modelPricing ?? pricing

  return (
    usage.input * active.inputPerMillion +
    (usage.output + usage.reasoning) * active.outputPerMillion +
    usage.cacheRead * active.cacheReadPerMillion +
    usage.cacheWrite * active.cacheWritePerMillion
  ) / 1_000_000
}

export function totalTokens(usage: TokenUsage): number {
  return usage.input + usage.output + usage.reasoning + usage.cacheRead + usage.cacheWrite
}
