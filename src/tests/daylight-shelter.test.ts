import { describe, expect, it } from 'vitest';
import { constrainVampireToDaylightShelter, STRONGHOLD_DAYLIGHT_SHELTER } from '../simulation/world/daylightShelter';

describe('daylight stronghold movement', () => {
  it('does not constrain vampire movement at night', () => {
    expect(constrainVampireToDaylightShelter('night', { x: 900, y: 300 })).toEqual({ x: 900, y: 300 });
  });

  it('allows movement inside the stronghold during day', () => {
    expect(constrainVampireToDaylightShelter('day', { x: 170, y: 360 })).toEqual({ x: 170, y: 360 });
  });

  it('clamps daylight movement at the sheltered stronghold bounds', () => {
    expect(constrainVampireToDaylightShelter('day', { x: 900, y: 10 })).toEqual({
      x: STRONGHOLD_DAYLIGHT_SHELTER.maxX,
      y: STRONGHOLD_DAYLIGHT_SHELTER.minY,
    });
  });
});
