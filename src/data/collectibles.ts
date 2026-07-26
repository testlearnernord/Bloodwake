import type { CollectibleDefinition } from '../types/models';

export const COLLECTIBLES: CollectibleDefinition[] = [
  {
    id: 'memory_fragment_1',
    name: 'Memory Fragment: The Banner Hall',
    lore: 'You remember kneeling retainers, a torchlit hall, and the vow that your line would endure beyond empires.',
    reward: { presence: 1 },
  },
];

export const COLLECTIBLES_BY_ID = Object.fromEntries(COLLECTIBLES.map((collectible) => [collectible.id, collectible]));
