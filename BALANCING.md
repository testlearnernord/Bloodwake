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
