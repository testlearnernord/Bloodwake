# Balancing

Core balancing values live in `src/config/balancing.ts`.

## Current tuning groups

- Starting trait and attribute rules
- Inheritance and mutation chances
- Vitae gains, turn cost, and bite range
- Job priority weighting
- Crafting quality thresholds
- Day/night work restrictions
- Player movement speed, lock range, and minimum orbit radius
- Dodge speed, duration, cooldown, and invulnerability window
- Light/Heavy/Blood Lance timings, cooldowns, costs, stagger, hit-stop, and camera shake
- Blood Lance projectile speed, range, lifetime, and collision radius
- Enemy detection ranges, preferred distances, attack timings, poise, and direction-lock timing
- Feedback timings for damage numbers, delayed health bars, and death fades

## Milestone 0.4 playability notes

- **Light Attack** is the quick zero-Vitae option with short windup/recovery and light stagger.
- **Heavy Attack** spends Vitae once on commit, lunges farther, and applies much stronger stagger.
- **Blood Lance** is the ranged pressure tool with higher cooldown and no neutral-human damage.
- **Target lock** should be reachable without browser-hostile inputs: Ctrl toggles, Tab advances, Shift+Tab reverses, and wheel/middle-mouse remain available.
- **Turning** should feel expensive but reliable: blocked turns must explain the real requirement before commit, and successful turns must create exactly one servant.
- **Servant value** should stay readable through profession benefits, task reasons, and visible build/craft/gather outcomes.
- **Bandits** close aggressively and can be interrupted often.
- **Clergy Hunters** try to maintain range and rely on dodgeable holy projectiles.
- **Elite Knights** have higher poise, longer windups, and direction-lock before release so flanking matters.

## Editing guidance

Prefer central constants and deterministic formulas over scattered inline values.


## Blood Resonance generation

Blood Resonance is generated deterministically with seeded RNG:

| Resonance | Label | Weight |
| --- | --- | ---: |
| 1 | Thin | 35% |
| 2 | Common | 35% |
| 3 | Rich | 20% |
| 4 | Potent | 8% |
| 5 | Exceptional | 2% |

Valid range: integer 1–5. Total weight: 100%.

Blood Resonance generation and Feed/Drain reward scaling are active in 0.6.2b. Blood Stock still waits for its actual donor/storage/upkeep source-and-sink loop.

## Unified Vampire Vitae (0.6.2a)

Vitae is both personal vampire blood reserve and supernatural ability energy.

| Condition | Vitae ratio | Attack | Movement |
| --- | --- | ---: | ---: |
| Sated | >= 50% | 100% | 100% |
| Thirsty | >= 25% and < 50% | 90% | 95% |
| Starved | > 0% and < 25% | 75% | 85% |
| Bloodless | 0% | 60% | 75% |

- Player upkeep: `1 Vitae` on Night -> Day only.
- Low Vitae does not directly deal health damage.
- Dodge speed is not modified by Vitae condition.
- Vampire Vassal strategic blood upkeep is intentionally deferred until Blood Stock/Dominion exists.
- Human Food consumption is a separate future Human Servant system.
## Blood Choices (0.6.2b)

| Resonance | Feed base Vitae | Drain Vitae | Drain Blood Essence |
| --- | ---: | ---: | ---: |
| 1 Thin | 2 | 3 | 1 |
| 2 Common | 2 | 4 | 1 |
| 3 Rich | 3 | 5 | 1 |
| 4 Potent | 3 | 6 | 2 |
| 5 Exceptional | 4 | 7 | 2 |

- Feed formula: `1 + ceil(resonance / 2)`; the target survives.
- Blood Hunter adds `+1 Vitae` to Feed only.
- Drain formula: `2 + resonance`; resonance 4-5 also yield `2 Blood Essence`, otherwise `1`.
- Vitae gains clamp to the player's current max Vitae.
- A fed human is spent for the rest of the current night: Feed, Drain, and Turn are all blocked until next-night recovery.
- Drain permanently removes that human on the next replenishment pass.
- Blood Stock is not introduced here because its donor/storage/upkeep loop belongs to later Human Servant / Dominion work.


## Combat Feeding (0.6.2c)

Predatory Bite is a zero-Vitae combat finisher and emergency recovery tool.

- Requires a locked hostile target within `112` units.
- Normal enemies are vulnerable at `<= 35%` health or while staggered.
- Elite enemies are vulnerable at `<= 20%` health or while staggered.
- Start with `F`, then clear two sequential circular timing checks.
- Each circle has a seeded-random green success sector; pressing `F` outside it fails immediately, so button mashing cannot brute-force the bite.
- Normal circles take `1150 ms` per revolution with an `18%` green sector. Elite circles take `850 ms` with a `12%` green sector.
- Green sectors spawn away from the first and final edge of the revolution (`18%` minimum start, `90%` maximum end) so the challenge stays readable rather than lottery-like.
- Success executes the already-vulnerable target and restores up to `2 Vitae`, clipped by max Vitae.
- Failure deals `3` damage against normal enemies or `5` against elites and knocks the player away.
- The execution design prevents repeatedly farming the same enemy for Vitae without adding another persistent per-enemy blood counter.
- Boss-specific feeding rules are intentionally deferred to future regional/boss progression.


## Human Thrall Work (0.6.3b)

Mortal work resolves once per completed daytime phase. Work efficiency is deterministic:

`aptitude = 1 + professionBonus × 0.35 + skill × 0.10 + relevantTraitCount × 0.15`

`controlMultiplier = 0.35 + 0.65 × Control/100`

`stressMultiplier = 1 - 0.65 × Stress/100`

Final efficiency is clamped to `0.20 .. 3.00`.

Gathering and Hunting convert efficiency into actual item quantities at `floor(efficiency × 2)`, minimum 1. Hunting grants 1 Leather when efficiency is at least 1.25.

Construction consumes efficiency as room work progress against the room's configured construction time. Human crafting accumulates efficiency as recipe work progress and produces items only when the recipe's configured work amount is reached.

## Human Thralls (0.6.3a)

Human Servants are captive thralls, not citizens and not loyalty-based vassals.

- Base ruined stronghold housing: `2` humans.
- Each built Servant Quarters: `+4` human housing.
- Enthrall cost: `1 Vitae`; enthrallment is only available at night and is blocked when housing is full.
- Initial Control: `55 + Blood Control * 5 + Fear * 0.2 - Resolve * 6`, clamped to `35..95`.
- Resistance currently starts from Resolve (`1..5`) and is stored independently for future trait/genetic modifiers.
- Daily Control decay: `6 + Resistance * 2`.
- Human upkeep: `1 Food` per thrall per resolved day. Ration shortages add proportional Control loss (up to `12`) and Stress (up to `15`).
- Reassert Control: night-only, costs `1 Vitae`, restores `35 Control`, and raises Fear/Stress slightly.
- At `0 Control`, the vampiric bond breaks and the captive escapes back into the free-human world.
- Control states: Dominated `80-100`, Subdued `60-79`, Unstable `40-59`, Defiant `20-39`, Breaking `0-19`.
- Human Thralls deliberately do not use `Loyalty`, `Ambition`, or `Morale`; those remain Vampire Vassal concerns.


## Vampire Vassal politics (0.6.4c)

Derived Obedience uses no separate save field:

`round(Loyalty × 0.55 + Morale × 0.15 + (100 - Ambition) × 0.15 + (100 - Stress) × 0.15)`

Stance thresholds: Devoted 80+, Loyal 65-79, Wary 45-64, Resentful 25-44, Defiant 0-24. Defiance Risk is `100 - Obedience`. Political-event base chance by stance is 10% / 15% / 22% / 35% / 50%, with +5 percentage points per Dominion Strain up to +25. Event selection is seeded and weighted by the Vassal's actual political pressures.
