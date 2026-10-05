# Nova Chat

Black & white AI chat interface — SvelteKit 5, Tailwind v4, light/dark mode.
Local demo: answers are simulated (streaming + thinking), no API key required.

## Features

- **Conversation**: send, stop mid-generation, history, attachments, voice dictation
  (Web Speech API), model picker and effort slider
- **Thinking line**: real measured thinking time before each answer
- **`/image <description>`**: image generation with animated grid reveal
- **Fullscreen intro**: mouse-reactive WebGL background (shown before the first message)
- **Theme**: pro monochrome, persisted light/dark toggle (`localStorage`)

## Getting started

```sh
bun install
bun run dev      # dev server (vite dev)
bun run check    # typecheck (must pass)
bun run build    # production build
bun run lint     # prettier --check + eslint
```

## Structure

- `src/routes/+page.svelte` — chat orchestration (state, streaming, theme)
- `src/lib/demo.ts` — demo data (models, efforts, commands) and fake answers
- `src/lib/components/` — page components (`ChatHeader`, `EmptyState`, `MessageItem`)
  plus vendored Svelte Bits (`PromptBar`, `ThoughtLine`, `GridReveal`, `FaultyTerminal`)
- `src/routes/layout.css` — Tailwind v4 + theme tokens (`:root` / `.dark`)

See `AGENTS.md` for conventions and known pitfalls.

## Credits

Image reveal animation: Grid Reveal, Svelte 5 port of the React component by
[Rare UI](https://rareui.com) (Swami Malode) — MIT + Commons Clause + attribution,
personal use only, do not redistribute.
