import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { cacheLabel, pace } from '../hooks/register'
import { detectLang, EN, IT } from '../hooks/i18n'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 },
}

const EMPTY = { type: 'Box', props: {}, children: [] }

async function measure($: Engine): Promise<void> {
  await $.session.measure({ context: { tokens: 123000, window: 1000000, percent: 12 }, rateLimits: [], changed: ['context'] })
}

test('la barra mostra percentuale e token su terminale e desktop', async ($, on) => {
  on('ui.render', () => EMPTY as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await measure($)

  const term = await $.ui.mount({ plugin: 'context-meter', surface: 'terminal', ...BAND } as never)
  expect(await term.find({ type: 'Text', text: '12%  ·  123k / 1M' })).toBeDefined()
  expect(await term.find({ type: 'Button', text: 'Handoff' })).toBeDefined()
  await term.unmount()

  const desk = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  expect(await desk.find({ type: 'Text', text: '12%' })).toBeDefined()
  expect(await desk.find({ type: 'Text', text: '123k/1M' })).toBeDefined()
  expect(JSON.stringify(await desk.drawn())).toContain('width=\\"120\\"')
  await desk.unmount()
})

test('Handoff: scrive l’handoff, fa /clear e riparte da lì', async ($, on) => {
  const calls: string[] = []
  mock.store(on)
  on('ui.render', () => EMPTY as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('model.fork', () => ({ value: { isAnswered: true, text: '# Handoff\nstato X', usage: {} } }) as never)
  on('command.run', (_$, e) => {
    calls.push(`/${e.command}`)
    return { text: '' } as never
  })
  on('prompt.submit', (_$, e) => {
    calls.push(e.text)
    return { text: e.text } as never
  })
  await measure($)

  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  await ui.press({ key: 'handoff' })
  expect(calls[0]).toBe('/clear')
  expect(calls[1]).toContain('# Handoff\nstato X')
  expect(calls[1]).toContain('Resuming from a handoff')
  await ui.unmount()
})

test('Handoff fallito: niente /clear', async ($, on) => {
  const calls: string[] = []
  on('ui.render', () => EMPTY as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', () => ({ value: undefined }) as never)
  on('model.fork', () => ({ value: { isAnswered: false, reason: 'empty-reply', usage: {} } }) as never)
  on('command.run', (_$, e) => {
    calls.push(e.command)
    return { text: '' } as never
  })
  await measure($)

  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  await ui.press({ key: 'handoff' })
  expect(calls).toEqual([])
  await ui.unmount()
})

test('chip della cache: minuti rimasti, avviso sotto 10 minuti, scaduta dopo un’ora', async () => {
  const m = 60_000
  expect(cacheLabel({ lastAt: null, hit: null, now: 0 }).text).toBe('○ cache —')
  expect(cacheLabel({ lastAt: 0, hit: 97, now: 18 * m })).toEqual({ text: '● cache 42m · hit 97%', tone: 'success' })
  expect(cacheLabel({ lastAt: 0, hit: null, now: 55 * m }).tone).toBe('warning')
  expect(cacheLabel({ lastAt: 0, hit: 3, now: 61 * m })).toEqual({ text: '○ cache scaduta · hit 3%', tone: 'error' })
})

test('↻ sull’orologio manda un ping minuscolo per rinfrescare la cache', async ($, on) => {
  const sent: string[] = []
  on('ui.render', () => EMPTY as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('prompt.submit', (_$, e) => {
    sent.push(e.text)
    return { text: e.text } as never
  })
  await measure($)

  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'context-meter', surface, ...BAND } as never)
    await ui.press({ key: 'kv-ping' })
    await ui.unmount()
  }
  expect(sent).toEqual([EN.pingPrompt, EN.pingPrompt])
})

test('limiti: righina della sessione sotto la barra, dettagli nel hover', async ($, on) => {
  on('ui.render', () => EMPTY as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { tokens: 123000, window: 1000000, percent: 12 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23 },
      { kind: 'seven_day', percentUsed: 41 },
    ],
    changed: ['context', 'rateLimits'],
  })

  const desk = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  expect(await desk.find({ type: 'Text', text: '5h 23% · 7d 41%' })).toBeDefined()
  expect(JSON.stringify(await desk.drawn())).toContain('height=\\"10\\"')
  await desk.unmount()
})

test('ritmo settimanale: a metà settimana col 60% si buca, col 30% no', () => {
  const day = 24 * 3600_000
  const now = Date.parse('2026-10-15T12:00:00Z')
  const resetsAt = new Date(now + 3.5 * day).toISOString()
  expect(pace({ percent: 60, resetsAt }, now)).toEqual({ projected: 120, tone: 'error' })
  expect(pace({ percent: 30, resetsAt }, now)).toEqual({ projected: 60, tone: 'success' })
  expect(pace({ percent: 45, resetsAt }, now).tone).toBe('warning')
})

test('ritmo sessione: a metà delle 5 ore col 60% si buca', () => {
  const now = Date.parse('2026-10-15T12:00:00Z')
  const resetsAt = new Date(now + 2.5 * 3600_000).toISOString()
  expect(pace({ percent: 60, resetsAt }, now, 5 * 3600_000)).toEqual({ projected: 120, tone: 'error' })
})

test('lingua: opzione, poi impostazione language di Claude Code, poi LANG, altrimenti inglese', () => {
  expect(detectLang(['it'])).toBe('it')
  expect(detectLang([undefined, 'Italiano', 'en_US.UTF-8'])).toBe('it')
  expect(detectLang([undefined, 'français', 'it_IT.UTF-8'])).toBe('it')
  expect(detectLang([undefined, undefined, 'C'])).toBe('en')
  expect(detectLang([])).toBe('en')
  expect(IT.cacheShortLeft(5)).toBe('cache: scade tra 5m')
})

test('con language=it la fascia parla italiano', { options: { language: 'it' } }, async ($, on) => {
  on('ui.render', () => EMPTY as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('session.usage', () => ({ value: { context: { tokens: 123000, window: 1000000, percent: 12 }, rateLimits: [] } }) as never)
  on('config.list', () => ({ value: [] }) as never)
  mock.clock(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const desk = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  expect(await desk.find({ type: 'Button', text: 'Handoff' })).toBeDefined()
  expect(JSON.stringify(await desk.drawn())).toContain('Contesto al 12%')
  await desk.unmount()
})

test('con language=auto segue l’impostazione language di Claude Code', async ($, on) => {
  on('ui.render', () => EMPTY as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('session.usage', () => ({ value: { context: { tokens: 123000, window: 1000000, percent: 12 }, rateLimits: [] } }) as never)
  on('config.list', () => ({ value: [{ key: 'language', label: 'Language', kind: 'text', value: 'Italiano', isLocked: false }] }) as never)
  mock.clock(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const desk = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  expect(JSON.stringify(await desk.drawn())).toContain('Contesto al 12%')
  await desk.unmount()
})

test('Handoff con agenti ancora attivi: niente fork, niente /clear', async ($, on) => {
  const calls: string[] = []
  const toasts: string[] = []
  on('ui.render', () => EMPTY as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', (_$, e) => {
    toasts.push(String((e as { text?: unknown }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  on('agent.list', () => ({ value: [
    { id: 'a1', description: 'ricerca', type: 'general-purpose', status: 'running' },
    { id: 'a2', description: 'vecchio', type: 'Explore', status: 'completed' },
  ] }) as never)
  on('model.fork', () => {
    calls.push('fork')
    return { value: { isAnswered: true, text: 'x', usage: {} } } as never
  })
  on('command.run', (_$, e) => {
    calls.push(e.command)
    return { text: '' } as never
  })
  await measure($)

  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  await ui.press({ key: 'handoff' })
  expect(calls).toEqual([])
  expect(toasts.join(' ')).toContain('1 agent is still running')
  await ui.unmount()
})

test('Handoff senza risposta: dopo 5 minuti la fascia si sblocca e la risposta tardiva è ignorata', async ($, on) => {
  const calls: string[] = []
  const toasts: string[] = []
  const clock = mock.clock(on)
  on('ui.render', () => EMPTY as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', (_$, e) => {
    toasts.push(String((e as { text?: unknown }).text ?? JSON.stringify(e)))
    return { value: undefined } as never
  })
  let release = () => {}
  const late = new Promise<void>(r => { release = r })
  on('model.fork', async () => {
    await late
    return { value: { isAnswered: true, text: 'tardi', usage: {} } } as never
  })
  on('command.run', (_$, e) => {
    calls.push(e.command)
    return { text: '' } as never
  })
  await measure($)

  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  const pressed = ui.press({ key: 'handoff' })
  await clock.advance(5 * 60 * 1000 + 1)
  expect(toasts.join(' ')).toContain('5 minutes')
  expect(await ui.find({ type: 'Button', text: 'Handoff' })).toBeDefined()
  release()
  await pressed
  expect(calls).toEqual([])
  await ui.unmount()
})

test('dopo un reload senza session.start la fascia ricarica orologio e limiti', async ($, on) => {
  mock.clock(on)
  mock.env(on, {})
  on('ui.render', () => EMPTY as never)
  on('config.list', () => ({ value: [{ key: 'language', value: 'Italiano' }] }) as never)
  on('session.usage', () => ({ value: {
    context: { tokens: 200000, window: 1000000, percent: 20 },
    rateLimits: [{ kind: 'session', percent: 27, resetsAt: Date.now() + 2 * 3600_000 }],
  } }) as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await measure($)

  const ui = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  await ui.unmount()
  const again = await $.ui.mount({ plugin: 'context-meter', surface: 'desktop', ...BAND } as never)
  expect(await again.find({ type: 'Text', text: '200k/1M' })).toBeDefined()
  await again.unmount()
})
