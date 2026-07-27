# Bloodwake

Bloodwake is a free browser-only gothic strategy-action RPG built with TypeScript, Phaser 3, Vite, plain HTML/CSS, IndexedDB, and deterministic simulation systems.

> Current status: Milestone 0.3 tactical combat overhaul.

## Zero-cost architecture

- Static deployment to GitHub Pages
- No backend, accounts, telemetry, analytics, or runtime API calls
- No paid services
- No runtime CDN dependencies
- Local SVG icons and programmatic visuals only

## Implemented in Milestone 0.3

- Tactical top-down combat with visible Light Attack, Heavy Attack, Blood Lance, bite, feed, drain, and turn flows
- Ctrl target lock toggle with mouse-wheel target cycling and target-relative orbital WASD movement
- Real projectiles, dodge invulnerability frames, enemy telegraphs, stagger windows, and combat impact feedback
- Distinct bandit, clergy hunter, and elite knight behavior with no contact damage
- Data-driven combat definitions, deterministic combat tests, and preserved save format v2 compatibility
- Fullscreen application shell, overlays, inventory, equipment, startup error fallback, and Pages smoke validation from Milestone 0.2

## Controls

### World controls
- `WASD`: move
- `Ctrl`: toggle hostile target lock
- `Mouse Wheel`: cycle locked targets
- `Left Mouse`: Light Attack
- `Right Mouse`: Heavy Attack
- `Q`: Blood Lance
- `Space`: dodge
- `E`: interact / collect
- `F`: bite / feed nearby human
- `Escape`: close overlay, or open Pause if none is open

### Menu shortcuts
- `C`: Character & Bloodline
- `I`: Inventory & Equipment
- `V`: Servants
- `B`: Stronghold
- `K`: Crafting
- `J`: Journal & Memories
- `Tab`: Pause

Shortcuts are guarded and do not trigger while typing in form controls or while overlays own focus.

## Combat highlights

- **Target lock:** closest hostile to your facing or mouse direction wins; wheel cycling wraps in stable order.
- **Orbital movement:** while locked, `W/S` move toward/away and `A/D` circle the target with normalized speed.
- **Heavy Attack:** spends Vitae once when the strike commits, not on rejected windups.
- **Blood Lance:** locked shots bias toward the target; free shots aim at the mouse pointer.
- **Bite flow:** `F` and context buttons share one animated pipeline so feed/drain/turn outcomes commit exactly once.
- **Telegraphs:** every enemy damage event is preceded by a readable arc or line marker.

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

- Combat presentation uses compact generated silhouettes and Phaser effects rather than hand-authored sprite sheets.
- The current world still uses the three prototype combat zones from earlier milestones.
- Reduced-motion support trims camera and tween intensity, but combat is still visually denser than the management UI.

## Milestone 0.4 scope

Milestone 0.4 is reserved for:

- replacing the three rectangular zones with a real compact world map
- environmental art and collisions
- expanded stronghold
- more locations and interiors
- more quests and enemies
- loot drops
- additional weapons and vampire abilities
- broader progression

## License

MIT. See `LICENSE`.
