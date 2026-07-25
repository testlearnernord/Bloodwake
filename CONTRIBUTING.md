# Contributing

## Local workflow

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

## Data definition patterns

- Add traits in `src/data/traits.ts`
- Add professions in `src/data/professions.ts`
- Add items in `src/data/items.ts`
- Add recipes in `src/data/recipes.ts`
- Add rooms in `src/data/rooms.ts`
- Add quests in `src/data/quests.ts`

## Rules

- Keep deterministic systems in `src/simulation`
- Keep Phaser-specific code inside `src/game`
- Update documentation and tests alongside behavior changes
- Avoid architecture rewrites in small issue-focused changes
