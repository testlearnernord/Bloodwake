export class SeededRng {
  private state: number;

  constructor(seed: string | number) {
    this.state = SeededRng.hash(seed);
  }

  private static hash(seed: string | number): number {
    const source = String(seed);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pickOne<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new Error('Cannot pick from an empty array.');
    }
    return values[this.nextInt(0, values.length - 1)];
  }

  weightedPick<T extends { weight: number }>(values: readonly T[]): T {
    const total = values.reduce((sum, value) => sum + value.weight, 0);
    if (total <= 0) {
      throw new Error('Weighted pick requires a positive total weight.');
    }
    const roll = this.next() * total;
    let cursor = 0;
    for (const value of values) {
      cursor += value.weight;
      if (roll <= cursor) {
        return value;
      }
    }
    return values[values.length - 1];
  }
}

export const createDefaultSeed = (): string => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
