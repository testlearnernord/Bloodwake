# Balancing

Core balancing values live in `src/config/balancing.ts`.

## Current tuning groups

- Starting trait and attribute rules
- Inheritance and mutation chances
- Vitae gains, turn cost, and bite range
- Job priority weighting
- Crafting quality thresholds
- Day/night work restrictions

## Milestone 0.2 gameplay-impact additions

- Equipment now contributes to combat stats via deterministic aggregation.
- Armor reduces incoming damage with a minimum-damage rule.
- Healing Draught provides consumable health restoration.
- Building and crafting consume inventory items instead of generic resource keys.

## Editing guidance

Prefer central constants and deterministic formulas over scattered inline values.
