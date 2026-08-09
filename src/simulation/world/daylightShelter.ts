import type { DayPhase } from '../../types/models';

export interface WorldPoint {
  x: number;
  y: number;
}

// Stronghold visual bounds are x 20..320 / y 40..680. Keep a token-radius margin inside the walls.
export const STRONGHOLD_DAYLIGHT_SHELTER = {
  minX: 36,
  maxX: 304,
  minY: 56,
  maxY: 664,
} as const;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const constrainVampireToDaylightShelter = (phase: DayPhase, position: WorldPoint): WorldPoint => {
  if (phase === 'night') return { ...position };
  return {
    x: clamp(position.x, STRONGHOLD_DAYLIGHT_SHELTER.minX, STRONGHOLD_DAYLIGHT_SHELTER.maxX),
    y: clamp(position.y, STRONGHOLD_DAYLIGHT_SHELTER.minY, STRONGHOLD_DAYLIGHT_SHELTER.maxY),
  };
};
