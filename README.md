# Nova Chat

Interface de chat IA en noir & blanc — SvelteKit 5, Tailwind v4, mode clair/sombre.
Démo locale : les réponses sont simulées (streaming + réflexion), aucune clé API requise.

## Fonctionnalités

- **Conversation** : envoi, stop en cours de génération, historique, pièces jointes, dictée
  vocale (Web Speech API), sélecteur de modèle et curseur d'effort
- **Ligne de réflexion** : chrono réel de réflexion avant chaque réponse
- **`/image <description>`** : génération d'image avec révélation animée en grille
- **Intro plein écran** : fond WebGL réactif à la souris (visible avant le premier message)
- **Thème** : monochrome pro, toggle clair/sombre persisté (`localStorage`)

## Démarrage

```sh
bun install
bun run dev      # serveur de dev (vite dev)
bun run check    # typecheck (doit passer)
bun run build    # build de prod
bun run lint     # prettier --check + eslint
```

## Structure

- `src/routes/+page.svelte` — toute l'interface de chat
- `src/routes/layout.css` — Tailwind v4 + tokens de thème (`:root` / `.dark`)
- `src/lib/components/` — composants Svelte Bits vendored (`PromptBar`, `ThoughtLine`,
  `GridReveal`, `FaultyTerminal`), adaptés au projet

Voir `AGENTS.md` pour les conventions et pièges connus.

## Crédits

Animation de révélation d'image : Grid Reveal, port Svelte 5 du composant React
[Rare UI](https://rareui.com) par Swami Malode (MIT + Commons Clause + attribution,
usage personnel — ne pas redistribuer).
