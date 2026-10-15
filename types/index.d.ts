export type ContextFill = { tokens?: number; window: number; percent?: number }

export type Lang = 'en' | 'it'

export type HandoffPhase = 'idle' | 'writing' | 'clearing' | 'resuming'

export type CacheInfo = { lastAt: number | null; hit: number | null; now: number }

export type Limit = { percent: number; resetsAt?: string }

export type Limits = { session?: Limit; week?: Limit }

declare module 'claude-code' {
  interface PluginState {
    'context-meter': { fill: ContextFill | null; phase: HandoffPhase; cache: CacheInfo; limits: Limits; lang: Lang }
  }
}
