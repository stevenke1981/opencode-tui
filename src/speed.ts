import type { TokenSpeed } from "./types.js"

const CHARS_PER_TOKEN = 4
const WINDOW_MS = 2_000
const MIN_WINDOW_MS = 100

type SpeedEntry = {
  time: number
  chars: number
}

export class TokenSpeedTracker {
  private entries: SpeedEntry[] = []
  private sessionStart = 0
  private sessionChars = 0

  /** Record characters streamed in a delta update. */
  recordChars(text: string, at = Date.now()): void {
    if (this.sessionStart === 0) this.sessionStart = at
    const len = text.length
    if (len === 0) return
    this.entries.push({ time: at, chars: len })
    this.sessionChars += len
    this.prune(at)
  }

  /** Get current tok/s (sliding window) and session average. */
  getSpeed(now = Date.now()): TokenSpeed {
    this.prune(now)

    const totalChars = this.entries.reduce((sum, e) => sum + e.chars, 0)
    const firstEntry = this.entries.length > 0 ? this.entries[0] : undefined
    const elapsed = firstEntry ? Math.max(now - firstEntry.time, MIN_WINDOW_MS) : 1_000
    const current = ((totalChars / elapsed) * 1_000) / CHARS_PER_TOKEN

    const sessionElapsed = this.sessionStart > 0 ? Math.max(now - this.sessionStart, MIN_WINDOW_MS) : 1_000
    const average = this.sessionStart > 0 ? ((this.sessionChars / sessionElapsed) * 1_000) / CHARS_PER_TOKEN : 0

    return { current, average }
  }

  /** Reset streaming session counters (e.g. after response completes). */
  reset(): void {
    this.entries = []
    this.sessionStart = 0
    this.sessionChars = 0
  }

  private prune(now: number): void {
    const cutoff = now - WINDOW_MS
    this.entries = this.entries.filter((e) => e.time >= cutoff)
  }
}
