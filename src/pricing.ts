import type { PricingOptions } from "./types.js"

/**
 * Bundled model pricing catalog (USD per 1M tokens).
 * Sources: models.dev, official provider pricing pages.
 * Last updated: 2026-06.
 *
 * Wildcard patterns match by prefix — e.g. "claude-sonnet-4" matches
 * "anthropic/claude-sonnet-4-20250514".
 */
export type ModelPricingEntry = PricingOptions & {
  match: string // glob-like prefix pattern
}

export const MODEL_PRICING: ModelPricingEntry[] = [
  // Anthropic Claude 4 series
  { match: "claude-opus-4", inputPerMillion: 15, outputPerMillion: 75, cacheReadPerMillion: 1.5, cacheWritePerMillion: 18.75 },
  { match: "claude-sonnet-4", inputPerMillion: 3, outputPerMillion: 15, cacheReadPerMillion: 0.3, cacheWritePerMillion: 3.75 },
  { match: "claude-haiku-3.5", inputPerMillion: 0.8, outputPerMillion: 4, cacheReadPerMillion: 0.08, cacheWritePerMillion: 1 },
  { match: "claude-sonnet-3.5", inputPerMillion: 3, outputPerMillion: 15, cacheReadPerMillion: 0.3, cacheWritePerMillion: 3.75 },
  { match: "claude-opus-3", inputPerMillion: 15, outputPerMillion: 75, cacheReadPerMillion: 1.5, cacheWritePerMillion: 18.75 },
  { match: "claude-sonnet-3", inputPerMillion: 3, outputPerMillion: 15, cacheReadPerMillion: 0.3, cacheWritePerMillion: 3.75 },
  { match: "claude-haiku-3", inputPerMillion: 0.25, outputPerMillion: 1.25, cacheReadPerMillion: 0.025, cacheWritePerMillion: 0.3125 },

  // Anthropic legacy patterns
  { match: "claude-3-opus", inputPerMillion: 15, outputPerMillion: 75, cacheReadPerMillion: 1.5, cacheWritePerMillion: 18.75 },
  { match: "claude-3-sonnet", inputPerMillion: 3, outputPerMillion: 15, cacheReadPerMillion: 0.3, cacheWritePerMillion: 3.75 },
  { match: "claude-3-haiku", inputPerMillion: 0.25, outputPerMillion: 1.25, cacheReadPerMillion: 0.025, cacheWritePerMillion: 0.3125 },

  // OpenAI GPT-4o series
  { match: "gpt-4.5", inputPerMillion: 2.5, outputPerMillion: 10, cacheReadPerMillion: 0.5, cacheWritePerMillion: 2.5 },
  { match: "gpt-4o", inputPerMillion: 2.5, outputPerMillion: 10, cacheReadPerMillion: 0.5, cacheWritePerMillion: 2.5 },
  { match: "gpt-4o-mini", inputPerMillion: 0.15, outputPerMillion: 0.6, cacheReadPerMillion: 0.03, cacheWritePerMillion: 0.15 },
  { match: "gpt-4-turbo", inputPerMillion: 10, outputPerMillion: 30, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
  { match: "gpt-4", inputPerMillion: 30, outputPerMillion: 60, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
  { match: "gpt-3.5-turbo", inputPerMillion: 1.5, outputPerMillion: 2, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },

  // Google Gemini series
  { match: "gemini-2.5-pro", inputPerMillion: 1.25, outputPerMillion: 10, cacheReadPerMillion: 0.03125, cacheWritePerMillion: 0 },
  { match: "gemini-2.5-flash", inputPerMillion: 0.15, outputPerMillion: 0.6, cacheReadPerMillion: 0.00375, cacheWritePerMillion: 0 },
  { match: "gemini-2.0-flash", inputPerMillion: 0.1, outputPerMillion: 0.4, cacheReadPerMillion: 0.0025, cacheWritePerMillion: 0 },
  { match: "gemini-1.5-pro", inputPerMillion: 1.25, outputPerMillion: 5, cacheReadPerMillion: 0.03125, cacheWritePerMillion: 0 },
  { match: "gemini-1.5-flash", inputPerMillion: 0.075, outputPerMillion: 0.3, cacheReadPerMillion: 0.001875, cacheWritePerMillion: 0 },

  // DeepSeek
  { match: "deepseek-v3", inputPerMillion: 0.27, outputPerMillion: 1.1, cacheReadPerMillion: 0.07, cacheWritePerMillion: 0.27 },
  { match: "deepseek-r1", inputPerMillion: 0.55, outputPerMillion: 2.19, cacheReadPerMillion: 0.14, cacheWritePerMillion: 0.55 },

  // Meta Llama (via providers)
  { match: "llama-4", inputPerMillion: 0.2, outputPerMillion: 0.2, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
  { match: "llama-3.3", inputPerMillion: 0.2, outputPerMillion: 0.2, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
  { match: "llama-3.2", inputPerMillion: 0.15, outputPerMillion: 0.15, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
  { match: "llama-3.1", inputPerMillion: 0.2, outputPerMillion: 0.2, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },

  // Mistral
  { match: "mistral-large", inputPerMillion: 2, outputPerMillion: 6, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
  { match: "mistral-small", inputPerMillion: 1, outputPerMillion: 3, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
  { match: "mistral-", inputPerMillion: 0.5, outputPerMillion: 1.5, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },

  // Amazon Nova
  { match: "nova-pro", inputPerMillion: 0.8, outputPerMillion: 3.2, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
  { match: "nova-lite", inputPerMillion: 0.06, outputPerMillion: 0.24, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
  { match: "nova-micro", inputPerMillion: 0.035, outputPerMillion: 0.14, cacheReadPerMillion: 0, cacheWritePerMillion: 0 },
]

/**
 * Resolve model pricing from the bundled catalog.
 * Uses prefix matching — the longest match wins.
 * Returns undefined if no match is found (falls back to user-configured pricing).
 */
export function resolveModelPricing(modelId: string | undefined): PricingOptions | undefined {
  if (!modelId) return undefined

  let best: ModelPricingEntry | undefined
  let bestLen = 0

  for (const entry of MODEL_PRICING) {
    const lower = modelId.toLowerCase()
    const match = entry.match.toLowerCase()
    // Prefix match: check if model ID starts with the pattern
    if (lower.includes(match) && match.length > bestLen) {
      best = entry
      bestLen = match.length
    }
  }

  if (!best) return undefined

  return {
    inputPerMillion: best.inputPerMillion,
    outputPerMillion: best.outputPerMillion,
    cacheReadPerMillion: best.cacheReadPerMillion,
    cacheWritePerMillion: best.cacheWritePerMillion,
  }
}
