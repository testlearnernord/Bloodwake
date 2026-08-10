import type { VampireVassal } from '../../types/models';
import { SeededRng } from '../../utilities/rng';

export type VassalPoliticalStance = 'Devoted' | 'Loyal' | 'Wary' | 'Resentful' | 'Defiant';

export interface VassalPoliticalProfile {
  stance: VassalPoliticalStance;
  obedience: number;
  defianceRisk: number;
  pressureSummary: string;
}

export interface VassalPoliticalEventRecord {
  vassalId: string;
  eventId: string;
  title: string;
  description: string;
  loyaltyDelta: number;
  moraleDelta: number;
  stressDelta: number;
}

export interface VassalPoliticsResult {
  vampireVassals: VampireVassal[];
  events: string[];
  records: VassalPoliticalEventRecord[];
}

interface PoliticalEventDefinition {
  id: string;
  title: string;
  description: string;
  weight: (vassal: VampireVassal, profile: VassalPoliticalProfile, dominionStrain: number) => number;
  effect: (vassal: VampireVassal, profile: VassalPoliticalProfile, dominionStrain: number) => {
    loyalty?: number;
    morale?: number;
    stress?: number;
  };
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));

const getStance = (obedience: number): VassalPoliticalStance => {
  if (obedience >= 80) return 'Devoted';
  if (obedience >= 65) return 'Loyal';
  if (obedience >= 45) return 'Wary';
  if (obedience >= 25) return 'Resentful';
  return 'Defiant';
};

export const getVassalPoliticalProfile = (vassal: VampireVassal): VassalPoliticalProfile => {
  const obedience = clamp(Math.round(
    vassal.loyalty * 0.55
    + vassal.morale * 0.15
    + (100 - vassal.ambition) * 0.15
    + (100 - vassal.stress) * 0.15,
  ));
  const pressure: string[] = [];
  if (vassal.loyalty >= 70) pressure.push('strong loyalty');
  else if (vassal.loyalty < 40) pressure.push('low loyalty');
  if (vassal.ambition >= 70) pressure.push('high ambition');
  if (vassal.stress >= 60) pressure.push('high stress');
  if (vassal.morale >= 65) pressure.push('high morale');
  else if (vassal.morale < 35) pressure.push('low morale');
  return {
    stance: getStance(obedience),
    obedience,
    defianceRisk: 100 - obedience,
    pressureSummary: pressure.length > 0 ? pressure.join(' · ') : 'balanced political pressure',
  };
};

const POLITICAL_EVENTS: PoliticalEventDefinition[] = [
  {
    id: 'blood_bound_accord',
    title: 'Blood-Bound Accord',
    description: 'Respect for the hierarchy steadies the vassal for another night.',
    weight: (vassal) => vassal.loyalty >= 65 && vassal.stress <= 45 ? 24 + Math.max(0, vassal.loyalty - 65) : 0,
    effect: () => ({ loyalty: 1, morale: 2, stress: -2 }),
  },
  {
    id: 'restless_ambition',
    title: 'Restless Ambition',
    description: 'The vassal broods over rank, influence, and what greater standing might be taken.',
    weight: (vassal) => vassal.ambition >= 60 ? 16 + (vassal.ambition - 60) : 0,
    effect: () => ({ loyalty: -1, stress: 2 }),
  },
  {
    id: 'dominion_resentment',
    title: 'Dominion Resentment',
    description: 'Overextended authority is noticed, and obedience begins to feel negotiable.',
    weight: (_vassal, profile, dominionStrain) => dominionStrain > 0 ? 30 + dominionStrain * 12 + Math.floor(profile.defianceRisk / 5) : 0,
    effect: (_vassal, _profile, dominionStrain) => ({
      loyalty: -(1 + Math.min(3, dominionStrain)),
      morale: -1,
      stress: 2 + Math.min(4, dominionStrain),
    }),
  },
  {
    id: 'predatory_rivalry',
    title: 'Predatory Rivalry',
    description: 'Ambition turns inward. The vassal starts measuring your weakness against their own ascent.',
    weight: (vassal) => vassal.ambition >= 75 && vassal.loyalty <= 50 ? 55 : 0,
    effect: () => ({ loyalty: -3, morale: -2, stress: 4 }),
  },
  {
    id: 'brooding_discontent',
    title: 'Brooding Discontent',
    description: 'Stress and resentment harden into open political distance.',
    weight: (vassal) => vassal.stress >= 65 || vassal.loyalty <= 35 ? 38 : 0,
    effect: () => ({ loyalty: -2, morale: -2, stress: 2 }),
  },
];

const EVENT_CHANCE_BY_STANCE: Record<VassalPoliticalStance, number> = {
  Devoted: 0.10,
  Loyal: 0.15,
  Wary: 0.22,
  Resentful: 0.35,
  Defiant: 0.50,
};

const formatDelta = (label: string, value: number): string | null => {
  if (value === 0) return null;
  return `${label} ${value > 0 ? '+' : ''}${value}`;
};

export const resolveVassalPoliticalEvent = (
  vassal: VampireVassal,
  seed: string,
  day: number,
  dominionStrain: number,
): { vassal: VampireVassal; record: VassalPoliticalEventRecord | null } => {
  if (vassal.state === 'torpor') return { vassal, record: null };
  const profile = getVassalPoliticalProfile(vassal);
  const eligible = POLITICAL_EVENTS
    .map((definition) => ({ definition, weight: definition.weight(vassal, profile, dominionStrain) }))
    .filter((entry) => entry.weight > 0);
  if (eligible.length === 0) return { vassal, record: null };

  const rng = new SeededRng(`${seed}:vassal-politics:${day}:${vassal.id}`);
  const triggerChance = clamp(EVENT_CHANCE_BY_STANCE[profile.stance] + Math.min(0.25, dominionStrain * 0.05), 0, 0.80);
  if (!rng.chance(triggerChance)) return { vassal, record: null };

  const definition = rng.weightedPick(eligible).definition;
  const effect = definition.effect(vassal, profile, dominionStrain);
  const next: VampireVassal = {
    ...vassal,
    loyalty: clamp(vassal.loyalty + (effect.loyalty ?? 0)),
    morale: clamp(vassal.morale + (effect.morale ?? 0)),
    stress: clamp(vassal.stress + (effect.stress ?? 0)),
  };
  return {
    vassal: next,
    record: {
      vassalId: vassal.id,
      eventId: definition.id,
      title: definition.title,
      description: definition.description,
      loyaltyDelta: next.loyalty - vassal.loyalty,
      moraleDelta: next.morale - vassal.morale,
      stressDelta: next.stress - vassal.stress,
    },
  };
};

/**
 * Temporary night-start adapter. Political authority lives here, not in phase advancement or work output.
 * 0.6.5a can call the same resolver from scheduled world time.
 */
export const resolveVassalPolitics = (
  vampireVassals: VampireVassal[],
  seed: string,
  day: number,
  dominionStrain: number,
): VassalPoliticsResult => {
  const updated: VampireVassal[] = [];
  const records: VassalPoliticalEventRecord[] = [];
  for (const vassal of vampireVassals) {
    const result = resolveVassalPoliticalEvent(vassal, seed, day, dominionStrain);
    updated.push(result.vassal);
    if (result.record) records.push(result.record);
  }
  const events = records.map((record) => {
    const vassal = updated.find((candidate) => candidate.id === record.vassalId);
    const deltas = [
      formatDelta('Loyalty', record.loyaltyDelta),
      formatDelta('Morale', record.moraleDelta),
      formatDelta('Stress', record.stressDelta),
    ].filter((entry): entry is string => Boolean(entry)).join(', ');
    return `${vassal?.name ?? record.vassalId}: ${record.title} - ${record.description}${deltas ? ` (${deltas})` : ''}`;
  });
  return { vampireVassals: updated, events, records };
};
