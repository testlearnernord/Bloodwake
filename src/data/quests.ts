import type { QuestDefinition } from '../types/models';

export const QUESTS: QuestDefinition[] = [
  {
    id: 'awakening',
    name: 'Awaken to Ashes',
    description: 'Reclaim the first pieces of your lost domain.',
    steps: [
      { id: 'awaken', text: 'Awaken in the coffin chamber.' },
      { id: 'inspect', text: 'Inspect the ruined stronghold.' },
      { id: 'travel', text: 'Travel to the forest road.' },
      { id: 'feed', text: 'Feed on a human to restore Vitae for future turning and combat.' },
      { id: 'memory', text: 'Find a memory fragment.' },
      { id: 'turn', text: 'Turn a suitable human into a vampire servant.' },
      { id: 'return', text: 'Return to the ruined stronghold.' },
      { id: 'build', text: 'Build the workshop.' },
      { id: 'assign', text: 'Assign a servant so the stronghold starts producing.' },
      { id: 'craft', text: 'Craft a Simple Sword to turn servant labor into combat power.' },
    ],
  },
];

export const QUESTS_BY_ID = Object.fromEntries(QUESTS.map((quest) => [quest.id, quest]));
