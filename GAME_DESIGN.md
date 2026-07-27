# Game Design

## Core loop (Milestone 0.3)

1. Generate a deterministic starting vampire from world seed + character roll.
2. Explore the world at night and collect physical items.
3. Lock hostile targets and fight with orbital movement, dodge timing, melee chains, and Blood Lance.
4. Feed on, drain, or turn humans through a shared bite pipeline.
5. Expand the stronghold with item-based construction costs.
6. Queue crafting recipes that consume inventory items and produce item outputs.
7. Equip weapon/armor/accessory items and consume Healing Draught when needed.
8. Progress quest and memory log through overlays and HUD context.

## Combat pillars

- **Readability first:** windups, active frames, recovery, target lock feedback, and enemy telegraphs are always visible.
- **Deterministic resolution:** cooldowns, projectile travel, bite commits, and target selection rules are testable without Phaser.
- **Pressure through positioning:** lock-on movement, dodge timing, and enemy preferred ranges matter more than contact damage.
- **Shared interaction flow:** keyboard and UI buttons funnel through the same human bite pipeline.

## Resource model

- **Physical inventory items**: wood, stone, ore, herbs, food, crafted equipment/consumables.
- **Strategic resources**: Blood Essence, Security (plus placeholders for gold/knowledge/influence).

## UI design pillars

- Top bar for strategic state + resources + management entry points
- Bottom HUD for combat vitals, cooldowns, and locked-target status
- Context panel only when interactions are available
- Overlay-based management screens that pause/block world input

## Current limitations

- Enemy roster is still limited to one bandit, one clergy hunter, and one elite knight encounter at a time.
- Combat presentation is intentionally compact and uses generated art rather than hand-authored sprite sheets.
