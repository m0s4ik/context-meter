import type { HandoffPhase, Lang } from '../types'

export type Strings = {
  phase: Record<HandoffPhase, string>
  busyHint: string
  busyAlt: string
  contextAlt: (percent: number) => string
  of: (window: string) => string
  days: string
  reset: string
  week: string
  cacheNone: string
  cacheExpired: string
  cacheShortNone: string
  cacheShortExpired: (min: number) => string
  cacheShortLeft: (min: number) => string
  cacheTipNone: string
  cacheTipExpired: (min: number) => string
  cacheTipLeft: (min: number) => string
  cacheTipTtl: string
  cacheTipHit: (hit: number) => string
  refresh: string
  toastStarted: string
  toastFailed: (reason: string) => string
  toastInterrupted: (message: string) => string
  toastWaitTurn: string
  toastAlreadyWorking: string
  toastAgentsActive: (n: number) => string
  toastTimedOut: string
  dropDuringHandoff: string
  handoffPrompt: string
  resumePrefix: string
  pingPrompt: string
}

export const EN: Strings = {
  phase: {
    idle: 'Handoff',
    writing: 'Handoff 1/3 · writing the document…',
    clearing: 'Handoff 2/3 · clearing the context…',
    resuming: 'Handoff 3/3 · resuming from the document…',
  },
  busyHint: 'don’t type in the prompt until it resumes',
  busyAlt: 'In progress',
  contextAlt: p => `Context at ${p}%`,
  of: w => `of ${w}`,
  days: 'd',
  reset: 'reset',
  week: '7d',
  cacheNone: '○ cache —',
  cacheExpired: '○ cache expired',
  cacheShortNone: 'cache: no reply yet',
  cacheShortExpired: m => `cache expired ${m}m ago`,
  cacheShortLeft: m => `cache: expires in ${m}m`,
  cacheTipNone: 'KV cache: no reply yet in this context',
  cacheTipExpired: m => `KV cache expired ${m} min ago`,
  cacheTipLeft: m => `KV cache: expires in ${m} min`,
  cacheTipTtl: '(1h TTL from the last reply)',
  cacheTipHit: h => `Last turn read from cache: ${h}%`,
  refresh: '↻ refresh',
  toastStarted: 'Handoff started: it takes a few seconds, don’t type in the prompt.',
  toastFailed: r => `Handoff failed (${r}): context left as it was.`,
  toastInterrupted: m => `Handoff interrupted: ${m}`,
  toastWaitTurn: 'Wait for the turn to finish, then press Handoff.',
  toastAlreadyWorking: 'Claude is already working: the cache refreshes by itself.',
  toastAgentsActive: n => `${n === 1 ? '1 agent is' : `${n} agents are`} still running: wait for ${n === 1 ? 'it' : 'them'} to finish, then press Handoff.`,
  toastTimedOut: 'Handoff gave no answer within 5 minutes: context left as it was, you can press it again.',
  dropDuringHandoff: 'Handoff in progress: the prompt was not sent, /clear would wipe it. Send it again once the session resumes.',
  handoffPrompt: `Write a handoff document to continue this work in a new conversation that will see none of this one.
Include: goal; current state; decisions made and why; relevant files, paths, hosts and commands; what is left to do, as concrete steps; pitfalls and things already tried that don't work.
Reply with the document only, in markdown, in the language of this conversation, with no preamble.`,
  resumePrefix: `Resuming from a handoff of the previous session: the context was cleared. Read it and continue where we left off. Before acting, sum up in two lines where we are.

`,
  pingPrompt: 'Ping to keep the prompt cache warm: reply only “ok”, without using tools.',
}

export const IT: Strings = {
  phase: {
    idle: 'Handoff',
    writing: 'Handoff 1/3 · scrivo il documento…',
    clearing: 'Handoff 2/3 · pulisco il contesto…',
    resuming: 'Handoff 3/3 · riparto dal documento…',
  },
  busyHint: 'non scrivere nel prompt finché non riparte',
  busyAlt: 'In corso',
  contextAlt: p => `Contesto al ${p}%`,
  of: w => `di ${w}`,
  days: 'g',
  reset: 'reset',
  week: '7g',
  cacheNone: '○ cache —',
  cacheExpired: '○ cache scaduta',
  cacheShortNone: 'cache: nessuna risposta',
  cacheShortExpired: m => `cache scaduta da ${m}m`,
  cacheShortLeft: m => `cache: scade tra ${m}m`,
  cacheTipNone: 'Cache KV: nessuna risposta ancora in questo contesto',
  cacheTipExpired: m => `Cache KV scaduta da ${m} min`,
  cacheTipLeft: m => `Cache KV: scade tra ${m} min`,
  cacheTipTtl: '(TTL 1h dall’ultima risposta)',
  cacheTipHit: h => `Ultimo turno letto dalla cache: ${h}%`,
  refresh: '↻ rinfresca',
  toastStarted: 'Handoff avviato: ci vuole qualche secondo, non scrivere nel prompt.',
  toastFailed: r => `Handoff non riuscito (${r}): contesto lasciato com’è.`,
  toastInterrupted: m => `Handoff interrotto: ${m}`,
  toastWaitTurn: 'Aspetta che finisca il turno, poi premi Handoff.',
  toastAlreadyWorking: 'Claude sta già lavorando: la cache si rinfresca da sola.',
  toastAgentsActive: n => `${n === 1 ? '1 agente è' : `${n} agenti sono`} ancora attiv${n === 1 ? 'o' : 'i'}: aspetta che finisca${n === 1 ? '' : 'no'}, poi premi Handoff.`,
  toastTimedOut: 'Handoff senza risposta da 5 minuti: contesto lasciato com’è, puoi premerlo di nuovo.',
  dropDuringHandoff: 'Handoff in corso: il prompt non è stato inviato, il /clear lo cancellerebbe. Rimandalo quando la sessione riparte.',
  handoffPrompt: `Scrivi un documento di handoff per continuare questo lavoro in una conversazione nuova, che non vedrà nulla di questa.
Includi: obiettivo; stato attuale; decisioni prese e perché; file, percorsi, host e comandi rilevanti; cosa resta da fare, come passi concreti; insidie e cose già provate che non funzionano.
Rispondi solo con il documento, in markdown e in italiano, senza preamboli.`,
  resumePrefix: `Riprendo da un handoff della sessione precedente: il contesto è stato azzerato. Leggilo e continua da dove eravamo. Prima di agire, riassumi in due righe a che punto siamo.

`,
  pingPrompt: 'Ping per tenere calda la prompt cache: rispondi solo «ok», senza usare strumenti.',
}

export const STRINGS: Record<Lang, Strings> = { en: EN, it: IT }

// Maps a free-form language hint ("Italiano", "italian", "it_IT.UTF-8", "en-US") to a supported language.
export function toLang(hint: string | undefined): Lang | undefined {
  const h = hint?.trim().toLowerCase()
  if (h === undefined || h === '' || h === 'c' || h === 'posix') {
    return undefined
  }
  if (h.startsWith('it') || h.startsWith('ital')) {
    return 'it'
  }
  if (h.startsWith('en') || h.startsWith('ingl')) {
    return 'en'
  }
  return undefined
}

// The first hint that names a supported language wins; English otherwise.
export function detectLang(hints: readonly (string | undefined)[]): Lang {
  for (const hint of hints) {
    const l = toLang(hint)
    if (l !== undefined) {
      return l
    }
  }
  return 'en'
}
