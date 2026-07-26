# Bloodwake

Bloodwake is a free browser-only gothic strategy-action RPG built with TypeScript, Phaser 3, Vite, plain HTML/CSS, IndexedDB, and deterministic simulation systems.

> Current status: Milestone 0.2 UI, inventory, and presentation overhaul.

## Zero-cost architecture

- Static deployment to GitHub Pages
- No backend, accounts, telemetry, analytics, or runtime API calls
- No paid services
- No runtime CDN dependencies
- Local SVG icons and programmatic visuals only

## Implemented in Milestone 0.2

- Fullscreen application shell (top strategic bar, centered world view, bottom combat HUD)
- Overlay-based management UI (Character, Inventory, Servants, Stronghold, Crafting, Journal, Pause)
- Deterministic world seed + `characterRoll` new-game generation flow
- New games start with **no starter servant**; first servant is acquired by turning a human
- Item-based inventory operations with deterministic helpers
- Strategic resources split from physical inventory items
- Equipment loadout with stat impact (weapon damage, armor mitigation)
- Healing Draught consumable support
- Save format version 2 migration from legacy data
- Startup fatal-error panel fallback instead of blank white startup failures
- GitHub Pages smoke validation (`npm run smoke:pages`)

## Controls

### World controls
- `WASD`: move
- `Left Mouse`: primary attack
- `Right Mouse`: heavy attack
- `Space`: dodge
- `E`: interact / collect
- `F`: feed nearby human

### Menu shortcuts
- `C`: Character & Bloodline
- `I`: Inventory & Equipment
- `V`: Servants
- `B`: Stronghold
- `K`: Crafting
- `J`: Journal & Memories
- `Escape`: close overlay, or open Pause if none is open

Shortcuts are guarded and do not trigger while typing in form controls.

## Display targets

The shell is tuned for desktop play and tested for:
- 1366×768
- 1920×1080
- 2560×1440

Document-level scrolling is disabled during gameplay. Only overlay bodies scroll when needed.

## Local installation

```bash
npm install
npm run dev
```

## Validation commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run smoke:pages
```

## GitHub Pages configuration

- Repository Pages source must be set to **GitHub Actions** in Settings → Pages.
- Production base path is `/Bloodwake/`.
- Deploy workflow builds `dist/` and uploads the generated artifact.

## Current limitations

- Milestone 0.3 combat/animation systems are not implemented yet.
- This milestone keeps placeholder world visuals and lightweight combat logic.

## Deferred to Milestone 0.3

- Ctrl target lock toggle
- Target selection and cycling
- Target-relative orbital movement
- Ranged target-seeking projectiles
- Full light/heavy/bite animation state machines
- Enemy telegraphs and advanced combat patterns
- Hit stop, camera shake, and deeper attack feedback
- Full animated world character sprite sheets

## License

MIT. See `LICENSE`.
