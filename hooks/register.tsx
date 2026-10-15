import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CacheInfo, ContextFill, Limit, Limits } from '../types'
import { detectLang, IT, STRINGS } from './i18n'
import type { Strings } from './i18n'

const fill = atom({ plugin: 'context-meter', key: 'fill' } as const, null)
const phase = atom({ plugin: 'context-meter', key: 'phase' } as const, 'idle')
const cache = atom({ plugin: 'context-meter', key: 'cache' } as const, { lastAt: null, hit: null, now: 0 })
const limits = atom({ plugin: 'context-meter', key: 'limits' } as const, {})
const lang = atom({ plugin: 'context-meter', key: 'lang' } as const, 'en')

// Claude Code's prompt cache TTL on a subscription; it drops to 5 minutes in overage.
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_WARN_MS = 10 * 60 * 1000

export function cacheLabel(c: CacheInfo, s: Strings = IT): { text: string; tone: 'success' | 'warning' | 'error' | 'subtle' } {
  if (c.lastAt === null) {
    return { text: s.cacheNone, tone: 'subtle' }
  }

  const left = CACHE_TTL_MS - (c.now - c.lastAt)
  const hit = c.hit === null ? '' : ` · hit ${c.hit}%`

  if (left <= 0) {
    return { text: `${s.cacheExpired}${hit}`, tone: 'error' }
  }

  return { text: `● cache ${Math.ceil(left / 60000)}m${hit}`, tone: left <= CACHE_WARN_MS ? 'warning' : 'success' }
}

export const SPINNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">`
  + `<circle cx="8" cy="8" r="6" fill="none" stroke="#f59e0b" stroke-opacity="0.25" stroke-width="2"/>`
  + `<path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round">`
  + `<animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.9s" repeatCount="indefinite"/>`
  + `</path></svg>`

function kilo(n: number): string {
  return n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

export function label(f: ContextFill, s: Strings = IT): string {
  return f.percent === undefined
    ? `— ${s.of(kilo(f.window))}`
    : `${f.percent}%  ·  ${kilo(f.tokens ?? 0)} / ${kilo(f.window)}`
}

function tone(percent: number): 'success' | 'warning' | 'error' {
  return percent >= 80 ? 'error' : percent >= 60 ? 'warning' : 'success'
}

const HEX = { success: ['#34d399', '#10b981'], warning: ['#fbbf24', '#f59e0b'], error: ['#fb7185', '#ef4444'] }

export type LimitLine = { percent: number; elapsed?: number; tone: 'success' | 'warning' | 'error' }

export function barSvg(percent: number, week?: LimitLine): string {
  const [from, to] = HEX[tone(percent)]
  const w = Math.max(percent, 0.6) * 10
  const h = week === undefined ? 6 : 10
  const line = week === undefined
    ? ''
    : `<rect x="0" y="8.5" width="1000" height="1.5" fill="#8882" />`
      + `<rect x="0" y="8.5" width="${Math.min(100, Math.max(week.percent, 0.6)) * 10}" height="1.5" fill="#8a8f98" />`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="${h}" viewBox="0 0 1000 ${h}" preserveAspectRatio="none">`
    + `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>`
    + `<rect x="0" y="0" width="1000" height="6" rx="3" fill="#8883" />`
    + `<rect x="0" y="0" width="${w}" height="6" rx="3" fill="url(#g)" />`
    + line
    + `</svg>`
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const SESSION_MS = 5 * 60 * 60 * 1000

type RateLimit = { kind: string; percentUsed: number; resetsAt?: string }

export function toLimits(rl: readonly RateLimit[]): Limits {
  const pick = (kind: string): Limit | undefined => {
    const r = rl.find(x => x.kind === kind)
    return r === undefined ? undefined : { percent: r.percentUsed, resetsAt: r.resetsAt }
  }
  return { session: pick('five_hour'), week: pick('seven_day') }
}

export function inLabel(ms: number, s: Strings = IT): string {
  const m = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d > 0 ? `${d}${s.days} ${h}h` : h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

// Share of the window already elapsed (0..1), from its reset: 7 days for the week, 5 hours for the session.
export function elapsed(w: Limit, now: number, windowMs = WEEK_MS): number | undefined {
  if (w.resetsAt === undefined || now === 0) {
    return undefined
  }
  const left = Date.parse(w.resetsAt) - now
  return Number.isNaN(left) ? undefined : Math.min(1, Math.max(0, 1 - left / windowMs))
}

// Where the window ends up at its reset if usage keeps the current pace.
export function pace(w: Limit, now: number, windowMs = WEEK_MS): { projected?: number; tone: 'success' | 'warning' | 'error' } {
  const el = elapsed(w, now, windowMs)
  if (el === undefined || el < 0.02) {
    return { tone: tone(w.percent) }
  }
  const projected = Math.round(w.percent / el)
  return { projected, tone: projected >= 100 ? 'error' : projected >= 85 ? 'warning' : 'success' }
}

export function limitsTip(l: Limits, now: number, s: Strings = IT): string {
  const parts: string[] = []
  if (l.session !== undefined) {
    parts.push(`5h ${Math.round(l.session.percent)}%`)
    if (l.session.resetsAt !== undefined && now !== 0) {
      parts.push(`${s.reset} ${inLabel(Date.parse(l.session.resetsAt) - now, s)}`)
    }
  }
  if (l.week !== undefined) {
    parts.push(`${s.week} ${Math.round(l.week.percent)}%`)
  }
  return parts.join(' · ')
}

const TONE_HEX = { success: '#10b981', warning: '#f59e0b', error: '#ef4444', subtle: '#9ca3af' }

export function cacheTip(c: CacheInfo, s: Strings = IT): string {
  if (c.lastAt === null) {
    return s.cacheTipNone
  }

  const left = CACHE_TTL_MS - (c.now - c.lastAt)
  const head = left <= 0
    ? s.cacheTipExpired(Math.floor(-left / 60000))
    : s.cacheTipLeft(Math.ceil(left / 60000))
  const hit = c.hit === null ? '' : `\n${s.cacheTipHit(c.hit)}`

  return `${head} ${s.cacheTipTtl}${hit}`
}

export function cacheShort(c: CacheInfo, s: Strings = IT): string {
  if (c.lastAt === null) {
    return s.cacheShortNone
  }

  const left = CACHE_TTL_MS - (c.now - c.lastAt)
  const hit = c.hit === null ? '' : ` · hit ${c.hit}%`

  return (left <= 0 ? s.cacheShortExpired(Math.floor(-left / 60000)) : s.cacheShortLeft(Math.ceil(left / 60000))) + hit
}

export function cacheClockSvg(c: CacheInfo): string {
  const { tone: t } = cacheLabel(c)
  const color = TONE_HEX[t]
  const frac = c.lastAt === null ? 0 : Math.min(1, Math.max(0, (CACHE_TTL_MS - (c.now - c.lastAt)) / CACHE_TTL_MS))
  const at = (angle: number, r: number) => `${(10 + r * Math.sin(angle)).toFixed(2)} ${(10 - r * Math.cos(angle)).toFixed(2)}`
  const a = frac * 2 * Math.PI
  const remaining = frac >= 0.999
    ? `<circle cx="10" cy="10" r="7.5" fill="${color}" fill-opacity="0.18"/>`
    : frac <= 0
      ? ''
      : `<path d="M10 10 L10 2.5 A7.5 7.5 0 ${a > Math.PI ? 1 : 0} 1 ${at(a, 7.5)} Z" fill="${color}" fill-opacity="0.18"/>`
  const ticks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    .map(i => {
      const q = i % 3 === 0
      return `<line x1="${at((i * Math.PI) / 6, q ? 6 : 6.8).split(' ')[0]}" y1="${at((i * Math.PI) / 6, q ? 6 : 6.8).split(' ')[1]}" x2="${at((i * Math.PI) / 6, 7.6).split(' ')[0]}" y2="${at((i * Math.PI) / 6, 7.6).split(' ')[1]}" stroke="${color}" stroke-width="${q ? 1.2 : 0.6}" stroke-linecap="round"/>`
    })
    .join('')
  const minute = `<line x1="10" y1="10" x2="${at(a, 5.8).split(' ')[0]}" y2="${at(a, 5.8).split(' ')[1]}" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`
  const hour = `<line x1="10" y1="10" x2="10" y2="6.4" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">`
    + remaining
    + `<circle cx="10" cy="10" r="8.6" fill="none" stroke="${color}" stroke-width="1.4"/>`
    + ticks + hour + minute
    + `<circle cx="10" cy="10" r="1.1" fill="${color}"/>`
    + `</svg>`
}

async function handoff($: EngineInterface, s: Strings): Promise<void> {
  if ((await read($, phase)) !== 'idle') {
    return
  }

  try {
    await update($, phase, () => 'writing')
    $.ui.toast(s.toastStarted)
    const r = await $.model.fork({ prompt: s.handoffPrompt })

    if (!r.isAnswered) {
      $.ui.toast(s.toastFailed(r.reason))
      return
    }

    await $.store.set('last-handoff', r.text)

    await update($, phase, () => 'clearing')
    await $.command.run({ command: 'clear' })
    await update($, fill, f => (f === null ? null : { window: f.window }))
    await update($, cache, c => ({ ...c, lastAt: null, hit: null }))

    await update($, phase, () => 'resuming')
    await $.prompt.submit({ text: s.resumePrefix + r.text, asUser: true })
  } catch (err) {
    $.ui.toast(s.toastInterrupted(err instanceof Error ? err.message : String(err)))
  } finally {
    await update($, phase, () => 'idle')
  }
}

// The `language` option wins; on `auto`, Claude Code's own `language` setting, then the system locale; English otherwise.
async function resolveLang($: EngineInterface, option: unknown): Promise<void> {
  const hints: (string | undefined)[] = [typeof option === 'string' && option !== 'auto' ? option : undefined]

  try {
    const row = (await $.config.list()).find(r => r.key === 'language')
    hints.push(typeof row?.value === 'string' ? row.value : undefined)
  } catch {
    // no config rows on this host
  }

  try {
    hints.push(await $.env.get('LC_ALL'), await $.env.get('LANG'))
  } catch {
    // no environment on this host
  }

  await update($, lang, () => detectLang(hints))
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    $.ui.status(undefined)
    await resolveLang($, options.language)
    const t = await $.clock.now()
    await update($, cache, c => ({ ...c, now: t }))
    $.clock.every(30_000, () => {
      void $.clock.now().then(n => update($, cache, c => ({ ...c, now: n })))
    })
    const { context, rateLimits } = await $.session.usage()
    await update($, fill, () => ({ tokens: context.tokens, window: context.window, percent: context.percent }))
    await update($, limits, () => toLimits(rateLimits))

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      const c = e.context
      await update($, fill, () => ({ tokens: c.tokens, window: c.window, percent: c.percent }))
    }

    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => toLimits(e.rateLimits))
    }

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)

    if (e.agentId === undefined) {
      const t = await $.clock.now()
      await update($, cache, c => ({ ...c, lastAt: t, now: t }))
    }

    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const u = r.usage

    if (u !== undefined) {
      const total = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens

      if (total > 0) {
        await update($, cache, c => ({ ...c, hit: Math.round((u.cache_read_input_tokens / total) * 100) }))
      }
    }

    return r
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'plugin' && (await read($, phase)) !== 'idle') {
      return { drop: STRINGS[await read($, lang)].dropDuringHandoff }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const f = await read($, fill)

    if (e.props.hasSurvey || f === null) {
      return next(e)
    }

    const s = STRINGS[await read($, lang)]
    const busy = await read($, phase)
    const kvInfo = await read($, cache)
    const kv = cacheLabel(kvInfo, s)
    const lim = await read($, limits)
    const sess = lim.session === undefined ? undefined : { ...lim.session, ...pace(lim.session, kvInfo.now, SESSION_MS) }
    const limitLine: LimitLine | undefined = sess === undefined || lim.session === undefined
      ? undefined
      : { percent: sess.percent, tone: sess.tone, elapsed: elapsed(lim.session, kvInfo.now, SESSION_MS) }
    const percent = Math.min(100, Math.max(0, f.percent ?? 0))
    const t = tone(percent)
    const onPress = () => {
      if (e.props.isWorking) {
        $.ui.toast(s.toastWaitTurn)
        return
      }
      void handoff($, s)
    }

    const onPing = () => {
      if (e.props.isWorking || busy !== 'idle') {
        $.ui.toast(s.toastAlreadyWorking)
        return
      }
      void $.prompt.submit({ text: s.pingPrompt })
    }

    if (busy !== 'idle') {
      if (e.surface === 'desktop') {
        const { Box, Text, Svg } = $.ui.resolve(e)

        return (
          <Box flexDirection="row" alignItems="center" gap={2} paddingX={1}>
            <Box flexShrink={0}>
              <Svg key="spinner" source={SPINNER_SVG} alt={s.busyAlt} width={16} height={16} isInteractive />
            </Box>
            <Box flexShrink={0}>
              <Text color="warning" bold wrap="truncate">{s.phase[busy]}</Text>
            </Box>
            <Box flexShrink={1} minWidth={0}>
              <Text dimColor wrap="truncate">{s.busyHint}</Text>
            </Box>
          </Box>
        )
      }

      const { Box, Text } = $.ui.resolve(e)

      return (
        <Box flexDirection="row" gap={1}>
          <Text color="warning" bold>⏳ {s.phase[busy]}</Text>
          <Text dimColor>{s.busyHint}</Text>
        </Box>
      )
    }

    if (e.surface === 'desktop') {
      const { Box, Text, Svg, Button } = $.ui.resolve(e)

      return (
        <Box flexDirection="row" alignItems="center" gap={2} paddingX={1}>
          <Box flexShrink={0}>
            <Text color={t} wrap="truncate">{f.percent === undefined ? '—' : `${percent}%`}</Text>
          </Box>
          <Box key="ctx" flexGrow={1} flexShrink={1} minWidth={0} flexDirection="row" alignItems="center" gap={2}>
            <Box flexGrow={1} flexShrink={1} minWidth={0}>
              <Svg key="bar" source={barSvg(percent, limitLine)} alt={s.contextAlt(percent)} height={limitLine === undefined ? 6 : 10} />
            </Box>
            {lim.session === undefined && lim.week === undefined ? null : (
              <Box display="none" hover={{ display: 'flex' }} flexShrink={0}>
                <Text dimColor wrap="truncate">{limitsTip(lim, kvInfo.now, s)}</Text>
              </Box>
            )}
          </Box>
          <Box flexShrink={0}>
            <Text dimColor wrap="truncate">{f.percent === undefined ? s.of(kilo(f.window)) : `${kilo(f.tokens ?? 0)}/${kilo(f.window)}`}</Text>
          </Box>
          <Box key="kv" flexDirection="row" alignItems="center" gap={1} flexShrink={0}>
            <Box display="none" hover={{ display: 'flex' }} flexDirection="row" alignItems="center" gap={1}>
              <Text color={kv.tone} wrap="truncate">{cacheShort(kvInfo, s)}</Text>
              <Button key="kv-ping" label={s.refresh} plain dimColor onPress={onPing} />
            </Box>
            <Svg key="cache" source={cacheClockSvg(kvInfo)} alt={cacheTip(kvInfo, s)} width={20} height={20} />
          </Box>
          <Box flexShrink={0}>
            <Button key="handoff" label={s.phase[busy]} onPress={onPress} />
          </Box>
        </Box>
      )
    }

    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Box flexGrow={1} backgroundColor="subtle">
          <Box width={`${Math.max(percent, 1)}%`} backgroundColor={t}>
            <Text backgroundColor={t}> </Text>
          </Box>
          <Text> </Text>
        </Box>
        <Text dimColor={f.percent === undefined}>{label(f, s)}</Text>
        {sess === undefined ? null : <Text dimColor>{`5h ${Math.round(sess.percent)}%`}</Text>}
        <Text key="cache" color={kv.tone}>{kv.text}</Text>
        <Button key="kv-ping" label="↻" onPress={onPing} />
        <Button key="handoff" label={s.phase[busy]} onPress={onPress} />
      </Box>
    )
  })
}
