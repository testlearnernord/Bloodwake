# Bloodwake

Bloodwake is a free browser-only gothic strategy-action RPG built with TypeScript, Phaser 3, Vite, plain HTML/CSS, IndexedDB, and deterministic simulation systems.

> Current status: Milestone 0.6.2b Blood Choices — Blood Resonance now drives Feed/Drain decisions.

## Zero-cost architecture

- Static deployment to GitHub Pages
- No backend, accounts, telemetry, analytics, or runtime API calls
- No paid services
- No runtime CDN dependencies
- Local SVG icons and programmatic visuals only

## Implemented in Milestone 0.5

- Persistent world-cycle state: collected resource nodes and defeated enemies are remembered within a night cycle and cleared when a new night begins
- Vampire vassals appear in Ruined Stronghold with name and job labels; newly turned vassals appear without reloading
- Built rooms are visualized at their grid positions in Ruined Stronghold with progress indicators
- Human population replenishes at each new night: drained/turned humans are removed, fed humans recover, new humans fill up to the configured target of 5
- Centralized `advanceWorldPhase()` coordinates day/night toggle, Vitae upkeep, daylight restrictions, vassal work shifts, and world refresh
- Vampire sustenance and supernatural abilities now share the single personal Vitae resource.
- HUD shows Vitae condition (Sated / Thirsty / Starved / Bloodless) and its active penalties.
- Save format incremented to version 3 with a safe migration from version 2
- Deterministic regression coverage tracks phase lifecycle, human replenishment, resource/enemy persistence, population state, rooms, and saves.

## Implemented in Milestone 0.4

- Tactical top-down combat with readable lock-on feedback, Tab / Shift+Tab target cycling, middle-mouse cursor lock, and browser-safe inputs
- Visual facing that keeps silhouettes upright instead of spinning fully upside down
- Truthful combat, turning, crafting, and building UI states with disabled reasons instead of fake-active controls
- Human evaluation and turning flow that clearly explains eligibility, blocked reasons, and why a candidate matters
- Servant overview that shows practical profession value, likely work contribution, and the turn → servant → stronghold loop
- Practical fullscreen shell fixes for desktop resolutions, safe overlay scrolling, and an in-game UI scale setting (90/100/110/125%)
- Deterministic regression coverage for turn reliability, target cycling, shortcut guards, save persistence, and servant productivity flow

## Controls

### World controls
- `WASD`: move
- `Ctrl`: toggle hostile target lock
- `Tab`: next hostile target
- `Shift+Tab`: previous hostile target
- `Mouse Wheel`: cycle locked targets
- `Middle Mouse`: lock the hostile nearest the cursor
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

Shortcuts are guarded and do not trigger while typing in form controls or while overlays own focus. While gameplay is focused, `Ctrl/Cmd+S`, `Ctrl/Cmd+P`, `Tab`, right-click context menu, and gameplay wheel scrolling are intercepted so the browser interferes less.

## Supported core loop

1. Explore and fight at night.
2. Feed to restore Vitae and avoid low-blood combat and movement penalties.
3. Inspect humans for Blood Resonance, profession value, and useful traits.
4. Turn a qualified human into exactly one vampire vassal.
5. Assign vassal priorities so they build, craft, gather, or guard.
6. Use new rooms and crafted gear to strengthen both stronghold and combat.
7. Loop back into stronger combat, better candidates, and steadier stronghold growth.

## Combat highlights

- **Target lock:** closest hostile to your aim wins; Tab / wheel cycling follows stable angular order and middle mouse locks near the cursor.
- **Orbital movement:** while locked, `W/S` move toward/away and `A/D` circle the target with normalized speed.
- **Heavy Attack:** spends Vitae once when the strike commits, not on rejected windups.
- **Blood Lance:** locked shots bias toward the target; free shots aim at the mouse pointer.
- **Bite flow:** `F` and context buttons share one animated pipeline so feed/drain/turn outcomes commit exactly once.
- **Telegraphs:** every enemy damage event is preceded by a readable arc or line marker.

## Turning and vassals

- Context UI now shows whether a nearby human is eligible for feeding, draining, or turning.
- Turn failures explain the real blocker before resources are spent.
- Successful turns consume Vitae once, create one vampire vassal once, add one inheritance report once, and remove the human from the world state once.
- Domain Population screens explain why a profession or trait matters and what work a vassal is likely to do next.

## Display targets

The shell is tuned for desktop play and tested for:
- 1366×768
- 1920×1080
- 2560×1440

Document-level scrolling is disabled during gameplay. Only overlay bodies scroll when needed. Use the pause/settings overlay to switch UI scale between 90%, 100%, 110%, and 125%.

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
- Camera zoom is not currently a supported gameplay feature; browser zoom should not be treated as in-game zoom.
- Large raids, traps, walls, path blocking, and defensive stronghold tactics are intentionally deferred.

## Next milestone direction

Milestone 0.6.2b makes Feed and Drain use Blood Resonance as an actual tactical choice. Human recruitment/housing follows in 0.6.3.

## License

MIT. See `LICENSE`.
