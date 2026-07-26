# Game Design

## Core loop (Milestone 0.2)

1. Generate a deterministic starting vampire from world seed + character roll.
2. Explore the world at night and collect physical items.
3. Fight enemies for Blood Essence (strategic resource).
4. Feed on or turn humans.
5. Expand the stronghold with item-based construction costs.
6. Queue crafting recipes that consume inventory items and produce item outputs.
7. Equip weapon/armor/accessory items and consume Healing Draught when needed.
8. Progress quest and memory log through overlays and HUD context.

## Resource model

- **Physical inventory items**: wood, stone, ore, herbs, food, crafted equipment/consumables.
- **Strategic resources**: Blood Essence, Security (plus placeholders for gold/knowledge/influence).

## UI design pillars

- Top bar for strategic state + resources + management entry points
- Bottom HUD for combat vitals and future combat expansion hooks
- Context panel only when interactions are available
- Overlay-based management screens that pause/block world input

## Deferred systems

Milestone 0.3 handles advanced lock-on combat and full animation overhaul.
