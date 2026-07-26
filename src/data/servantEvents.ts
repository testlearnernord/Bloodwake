import type { ServantEventDefinition } from '../types/models';

export const SERVANT_EVENTS: ServantEventDefinition[] = [
  {
    id: 'better_quarters',
    title: 'Request for Better Quarters',
    description: 'A tired servant asks for safer sleeping space, lowering morale if ignored.',
    condition: 'low_morale',
    effect: { morale: -5 },
  },
  {
    id: 'resentful_fledgling',
    title: 'Resentful Fledgling',
    description: 'An ambitious new vampire resents idle nights and loses loyalty.',
    condition: 'ambitious_vampire',
    effect: { loyalty: -5 },
  },
  {
    id: 'loyal_overseer',
    title: 'Loyal Overseer',
    description: 'A devoted servant rallies the others, granting a productivity boost.',
    condition: 'loyal_bonus',
    effect: { productivity: 1, morale: 3 },
  },
];
