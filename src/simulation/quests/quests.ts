import { QUESTS_BY_ID } from '../../data/quests';
import type { QuestState } from '../../types/models';

export const createInitialQuestState = (): QuestState[] => {
  const quest = QUESTS_BY_ID.awakening;
  return [{ questId: quest.id, activeStepId: quest.steps[0].id, completedStepIds: [] }];
};

export const completeQuestStep = (quests: QuestState[], questId: string, stepId: string): QuestState[] => {
  const quest = QUESTS_BY_ID[questId];
  return quests.map((state) => {
    if (state.questId !== questId || state.completedStepIds.includes(stepId)) {
      return state;
    }
    const stepIndex = quest.steps.findIndex((step) => step.id === stepId);
    const nextStep = quest.steps[stepIndex + 1];
    return {
      ...state,
      completedStepIds: [...state.completedStepIds, stepId],
      activeStepId: nextStep?.id ?? stepId,
    };
  });
};
