# AGENTS.md

Nova Chat — SvelteKit 5 + Tailwind v4 AI chat demo. Single package, no tests, no CI.

## Commands (bun — `bun.lock` exists, `engine-strict=true`)

- `bun run dev` → runs **`vite dev`** (there is no `svelte.config.js`; do not use `svelte-kit dev`)
- `bun run check` → `svelte-kit sync && svelte-check` (typecheck; must pass)
- `bun run build` → `vite build` (must pass)
- `bun run lint` → `prettier --check . && eslint .` · `bun run format` to fix
- Deps: `bun add <pkg>` (`motion` = animation, `ogl` = FaultyTerminal WebGL)

## Structure

- `src/routes/+page.svelte` — the whole chat UI (state, fake streaming, `/image` flow)
- `src/routes/+layout.svelte`, `layout.css` (Tailwind v4: `@import 'tailwindcss'`, theme tokens live here)
- `src/lib/components/` — vendored Svelte Bits components, occasionally **patched locally**:
  `FaultyTerminal.svelte` (window mousemove listener, damping `0.22`, alpha computed pre-tint),
  `GridReveal.svelte` (keep the license header; visible credit to https://rareui.com must stay
  somewhere — currently `README.md`)
- Import alias is **`#lib`** (`package.json` `imports`), not SvelteKit's `$lib`; routes import
  components via relative paths (`../lib/components/...`)
- `vite.config.ts` forces runes mode for all non-`node_modules` files
- Prettier: tabs, single quotes, no trailing commas, width 100

## Svelte gotchas (all hit before — do not reintroduce)

- `import X, type Y from './C.svelte'` **fails** `svelte-check` parsing. Always split:
  `import X from '...'; import type { Y } from '...';`
- `{@const}` must be a direct child of `{#if}`/`{#each}`/etc. — never inside a plain `<div>`; use
  inline expressions instead
- Dark mode is **class-based**: `@custom-variant dark` + `.dark` on `<html>` (+ inline
  `localStorage` theme script in `src/app.html`). Design tokens in `layout.css` (`:root` /
  `.dark`), consumed as `bg-(--bg)`, `text-(--ink)`, `border-(--line)`, …
- Component color props accept `var()` (e.g. `background="var(--prompt-bg)"`), but **never pass a
  same-named variable** (`--pb-bg: var(--pb-bg)` is a self-reference cycle and silently breaks)
- `ThoughtLine`: drive it in controlled mode (`elapsed` prop fed by our own clock) and persist a
  self-measured duration; ignore `onSettle` values `<= 0`
- `GridReveal` uniforms are mount-time only — remount via `{#key …}` when props like `tint` change
- Demo images are remote `picsum.photos/seed/…` URLs (deterministic per prompt, needs network)

## Workflow

- Verify with `bun run check` (and `build` for anything touching markup/shaders); there is no test suite
- Never commit, amend, or push unless explicitly asked; history uses `feat:`/`fix:`/`style:` prefixes
- Secrets: `.env*` files are gitignored — never commit them
