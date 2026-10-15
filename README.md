# context-meter

A Claude Code mod that keeps the context window in sight. It draws one compact row above the prompt:

```
38% ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  381k/1M  🕐  [Handoff]
    ───────────────────
```

- **Context bar**: full-width, green → amber from 60% → red from 80%, with tokens used / window.
- **Session line**: a thin grey line under the bar fills with the 5-hour session usage. Hover the bar for `5h 27% · reset 2h 39m · 7d 30%`.
- **Cache clock**: a small clock shows how long the prompt (KV) cache stays warm (1-hour TTL from the last API reply). Green, yellow under 10 minutes, red once expired. Hover it for the minutes left and the last turn's cache-hit %, plus a **↻ refresh** button that sends a tiny ping to keep the cache warm.
- **Handoff**: one click asks Claude to write a handoff document, runs `/clear`, and starts the fresh context from that document. While it runs the row shows a spinner with the step (1/3 … 3/3) and prompts you type are held back, so `/clear` cannot wipe them. If writing the handoff fails, nothing is cleared. The last handoff is kept in the mod's store under `last-handoff`.

The row hides while Claude Code shows its own next-step or question box. In a terminal the same information is drawn with text and coloured blocks.

## Install

```
/plugin install context-meter --marketplace m0s4ik/context-meter
```

Or add the marketplace first and pick the plugin from the list:

```
/plugin marketplace add m0s4ik/context-meter
```

Sessions already open keep the version they started with; open a new session to load it.

## Language

The row speaks English or Italian. With `language` set to `auto` (the default) it follows Claude Code's own `language` setting, then the system locale (`LC_ALL`, `LANG`), and falls back to English. To force one, set the plugin's **Language** option in `/config` to `en` or `it`.

Adding a language means adding one dictionary to [`hooks/i18n.ts`](hooks/i18n.ts) and its code to `Lang` in [`types/index.d.ts`](types/index.d.ts).

## Notes

- The cache timer is an estimate: Claude Code has no API that says whether the cache is warm. It assumes the 1-hour subscription TTL; in overage the real TTL drops to 5 minutes, which the cache-hit % will show.
- Rate limits are only reported on a Claude subscription; with API billing the session line is not drawn.

## Develop

```
claude plugin validate . && claude plugin test .
```

The hooks live in [`hooks/register.tsx`](hooks/register.tsx), the shared state contract in [`types/index.d.ts`](types/index.d.ts), the tests in [`tests/`](tests/).

## License

MIT
