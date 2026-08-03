import { DRAIN_ESSENCE_GAIN, FEED_VITAE_GAIN, TURN_COST_VITAE } from '../../config/balancing';
import { inheritVampire } from '../bloodlines/inheritance';
import { completeQuestStep } from '../quests/quests';
import { applyFeedHungerReduction, applyDrainHungerReduction } from '../time/phaseAdvance';
import type { HumanActionMode } from '../../game/combat/combatTypes';
import type { HumanCharacter, SaveGame, Servant } from '../../types/models';

export interface BiteSequenceRuntime {
  humanId: string;
  mode: HumanActionMode;
  phase: 'bite_approach' | 'bite_hold' | 'bite_release' | 'complete';
  startedAt: number;
  phaseEndsAt: number;
  commitAt: number;
  committed: boolean;
}

export const createBiteSequence = (humanId: string, mode: HumanActionMode, now: number): BiteSequenceRuntime => ({
  humanId,
  mode,
  phase: 'bite_approach',
  startedAt: now,
  phaseEndsAt: now + 180,
  commitAt: now + (mode === 'turn' ? 620 : mode === 'drain' ? 700 : 480),
  committed: false,
});

export const stepBiteSequence = (runtime: BiteSequenceRuntime, now: number): { runtime: BiteSequenceRuntime; shouldCommit: boolean; finished: boolean } => {
  const shouldCommit = !runtime.committed && now >= runtime.commitAt;
  if (runtime.phase === 'bite_approach' && now >= runtime.phaseEndsAt) {
    return {
      runtime: { ...runtime, phase: 'bite_hold', phaseEndsAt: runtime.commitAt + 180, committed: runtime.committed || shouldCommit },
      shouldCommit,
      finished: false,
    };
  }
  if (runtime.phase === 'bite_hold' && now >= runtime.phaseEndsAt) {
    return {
      runtime: { ...runtime, phase: 'bite_release', phaseEndsAt: now + 180, committed: runtime.committed || shouldCommit },
      shouldCommit,
      finished: false,
    };
  }
  if (runtime.phase === 'bite_release' && now >= runtime.phaseEndsAt) {
    return {
      runtime: { ...runtime, phase: 'complete', phaseEndsAt: now, committed: true },
      shouldCommit,
      finished: true,
    };
  }
  return {
    runtime: shouldCommit ? { ...runtime, committed: true } : runtime,
    shouldCommit,
    finished: runtime.phase === 'complete',
  };
};

export const validateHumanAction = (state: SaveGame, human: HumanCharacter | undefined, mode: HumanActionMode): { ok: true } | { ok: false; reason: string } => {
  if (!human) {
    return { ok: false, reason: 'No human target.' };
  }
  if (human.status === 'drained' || human.status === 'turned') {
    return { ok: false, reason: 'Target is no longer valid.' };
  }
  if (mode === 'turn' && state.player.vitae < TURN_COST_VITAE) {
    return { ok: false, reason: 'Turning requires more Vitae.' };
  }
  return { ok: true };
};

export const applyHumanAction = (
  state: SaveGame,
  humanId: string,
  mode: HumanActionMode,
): { state: SaveGame; message: string; inheritanceSummary?: string } => {
  const human = state.npcs.find((npc) => npc.id === humanId);
  const check = validateHumanAction(state, human, mode);
  if (!check.ok || !human) {
    return { state, message: check.ok ? 'No human target.' : check.reason };
  }
  const nextState: SaveGame = {
    ...state,
    player: { ...state.player },
    npcs: state.npcs.map((npc) => ({ ...npc })),
    strategicResources: { ...state.strategicResources },
    servants: state.servants.map((servant) => ({ ...servant, priorities: { ...servant.priorities }, equipped: { ...servant.equipped } })),
    inheritanceHistory: [...state.inheritanceHistory],
    lastEventLog: [...state.lastEventLog],
    quests: [...state.quests],
  };
  const updateHumanStatus = (status: HumanCharacter['status']): void => {
    nextState.npcs = nextState.npcs.map((npc) => (npc.id === humanId ? { ...npc, status } : npc));
  };
  if (mode === 'feed') {
    nextState.player.vitae = Math.min(nextState.player.maxVitae, nextState.player.vitae + FEED_VITAE_GAIN);
    nextState.player.hunger = applyFeedHungerReduction(nextState.player.hunger);
    updateHumanStatus('fed');
    nextState.quests = completeQuestStep(nextState.quests, 'awakening', 'feed');
    nextState.lastEventLog.unshift(`Fed on ${human.name} and left them alive.`);
    return { state: nextState, message: 'Vitae restored by feeding.' };
  }
  if (mode === 'drain') {
    nextState.player.vitae = Math.min(nextState.player.maxVitae, nextState.player.vitae + FEED_VITAE_GAIN);
    nextState.strategicResources.bloodEssence += DRAIN_ESSENCE_GAIN;
    nextState.player.hunger = applyDrainHungerReduction(nextState.player.hunger);
    updateHumanStatus('drained');
    nextState.lastEventLog.unshift(`Drained ${human.name} for Blood Essence.`);
    return { state: nextState, message: 'Blood Essence increased.' };
  }
  const result = inheritVampire(nextState.player, human, `${nextState.seed}-${nextState.characterRoll}`);
  nextState.player.vitae -= TURN_COST_VITAE;
  updateHumanStatus('turned');
  const servant: Servant = {
    ...result.vampire,
    type: 'vampire',
    priorities: {
      Building: 'Normal',
      Crafting: 'High',
      Gathering: 'Low',
      Guarding: 'Normal',
      Research: 'Low',
      Hunting: 'Low',
    },
    currentJob: null,
    currentTask: null,
    taskReason: 'Newly turned and awaiting direction.',
    hunger: result.vampire.hunger,
    equipped: {},
  };
  nextState.servants = [...nextState.servants, servant];
  nextState.inheritanceHistory.unshift(result.report);
  nextState.quests = completeQuestStep(nextState.quests, 'awakening', 'turn');
  nextState.lastEventLog.unshift(`Turned ${human.name} into a fledgling vampire.`);
  return {
    state: nextState,
    message: 'A new vampire servant has joined your bloodline.',
    inheritanceSummary: `Inherited ${result.report.inheritedTraits.join(', ') || 'no dominant traits'}; mutations: ${result.report.mutations.join(', ') || 'none'}.`,
  };
};
