# Copilot instructions for Bloodwake

- Preserve the zero-cost architecture: browser-only, no backend, no paid APIs, no telemetry, and no runtime CDN dependencies.
- Keep the game deployable to GitHub Pages as a static site.
- Keep gameplay-relevant randomness deterministic through the seeded RNG service.
- Keep TypeScript strict mode enabled and avoid `any`.
- Prefer data-driven content definitions over hard-coded branching.
- Add or update deterministic tests when gameplay behavior changes.
- Make small focused changes; do not silently rewrite architecture.
- Update documentation whenever user-visible behavior, commands, or data definitions change.
- Do not claim incomplete systems are complete.
