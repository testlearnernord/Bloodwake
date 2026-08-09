# Bloodwake

Bloodwake is a free browser-only gothic strategy-action RPG built with TypeScript, Phaser 3, Vite, plain HTML/CSS, IndexedDB, and deterministic simulation systems.

> Current status: Milestone 0.6.3b Human Work Foundation — captive mortals now perform deterministic daytime labor with real construction, crafting, gathering, and hunting outputs.

## Zero-cost architecture

- Static deployment to GitHub Pages
- No backend, accounts, telemetry, analytics, or runtime API calls
- No paid services
- No runtime CDN dependencies
- Local SVG icons and programmatic visuals only

## Current gameplay systems

- Persistent world-cycle state: collected resource nodes and defeated enemies are remembered within a night cycle and cleared when a new night begins.
- Tactical top-down combat with lock-on, light/heavy attacks, dodge, Blood Lance, enemy telegraphs, hit feedback, and Predatory Bite.
- Predatory Bite uses two circular timing checks with randomized green hit sectors; successful combat feeding executes vulnerable enemies and restores Vitae.
- Vampire sustenance and supernatural abilities share the single personal Vitae resource.
- Free humans have profession, traits, Blood Resonance, Resolve, Disposition and Fear.
- Feed and Drain use Blood Resonance for different tactical rewards.
- Free humans can be Turned directly into Vampire Vassals or Enthralled as captive Human Thralls.
- Human Thralls use Control and Resistance rather than Loyalty/Ambition/Morale.
- The ruined stronghold provides two Human Thrall housing spaces; each Servant Quarters adds four.
- Human Thralls consume Food each resolved day, lose Control based on Resistance, and suffer additional Control/Stress pressure during shortages.
- At night the player can spend Vitae to Reassert Control. A Thrall whose Control reaches zero escapes back into the free-human world.
- Vampire Vassals remain autonomous subordinates with Loyalty and Ambition and can perform the existing stronghold work loop.
- Built rooms are visualized at their grid positions in Ruined Stronghold with progress indicators.
- Save format is v7. Older v1-v6 saves are intentionally unsupported.

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
- `F`: contextual bite / feed action
- `Escape`: close overlay, or open Pause if none is open

### Menu shortcuts
- `C`: Character & Bloodline
- `I`: Inventory & Equipment
- `V`: Domain Population
- `B`: Stronghold
- `K`: Crafting
- `J`: Journal & Memories

Shortcuts are guarded and do not trigger while typing in form controls or while overlays own focus. While gameplay is focused, `Ctrl/Cmd+S`, `Ctrl/Cmd+P`, `Tab`, right-click context menu, and gameplay wheel scrolling are intercepted so the browser interferes less.

## Supported core loop

1. Explore and fight at night.
2. Manage personal Vitae through hunting, Blood Resonance choices, and risky combat feeding.
3. Inspect free humans for profession, traits, Blood Resonance and Resolve.
4. Choose what each useful human is worth to you: Feed, Drain, Enthrall as a mortal captive, or Turn into a Vampire Vassal.
5. House and feed Human Thralls while managing the strength of their vampiric Control.
6. Spend Vitae to reinforce unstable Thralls before the bond breaks and they escape.
7. Use Vampire Vassals, rooms, crafting and future Human work systems to expand the stronghold.
8. Build toward long-term human genetics, Blood Donors, bloodline selection and vampire-domain politics.

## Human Thralls versus Vampire Vassals

Human Thralls are prisoners under vampiric venom and domination, not citizens. They retain their mortal identity and useful human characteristics, but their relationship to the player is measured through **Control** and **Resistance**. Their upkeep is primarily Food, housing, and attention to the weakening bond.

Vampire Vassals are fundamentally different. They are immortal, powerful and autonomous. They retain political agency and therefore use **Loyalty** and **Ambition** rather than Thrall Control. Turning a human is intended to become a strategic trade-off, not an automatic upgrade from mortal worker to better worker.

The retained human identity fields are deliberate groundwork for later profession development, donor selection, families/genetics, and the choice between cultivating a valuable mortal line or converting selected humans into the vampire bloodline.

## Combat highlights

- **Target lock:** closest hostile to your aim wins; Tab / wheel cycling follows stable angular order and middle mouse locks near the cursor.
- **Orbital movement:** while locked, `W/S` move toward/away and `A/D` circle the target with normalized speed.
- **Heavy Attack:** spends Vitae once when the strike commits, not on rejected windups.
- **Blood Lance:** locked shots bias toward the target; free shots aim at the mouse pointer.
- **Predatory Bite:** vulnerable enemies can be pounced on and executed only after clearing two circular timing checks.
- **Human bite flow:** contextual actions share one animated pipeline so Feed, Drain, Enthrall and Turn commit exactly once.
- **Telegraphs:** enemy damage is preceded by readable combat telegraphs.

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

- Human Thralls are now recruitable/manageable, but their day-work assignments and production roles are the next layer rather than being faked by the Vampire Vassal worker system.
- Blood Stock / Blood Cellar donor production is not implemented yet.
- Genetics, family lines and deeper learned-skill development remain later Character/Bloodline work.
- Combat presentation uses compact generated silhouettes and Phaser effects rather than hand-authored sprite sheets.
- The current world still uses the three prototype combat zones from earlier milestones.
- Large raids, traps, walls, path blocking, and defensive stronghold tactics are intentionally deferred.

## Next milestone direction

Milestone 0.6.3b gives Human Thralls actual daytime work roles and introduces the first Blood Cellar / Blood Donor source-storage-use loop without collapsing Humans and Vampire Vassals into the same worker type.

## License

MIT. See `LICENSE`.
