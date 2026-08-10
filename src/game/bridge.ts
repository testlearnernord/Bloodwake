import type { CombatUiSnapshot, HumanActionCommitResult, HumanActionMode, WorldSceneApi } from './combat/combatTypes';
import type { CombatStats } from '../simulation/combat/stats';
import type { EnemyType, ItemId, SaveGame } from '../types/models';

export interface GameBridge {
  getState(): SaveGame;
  getCombatStats(): CombatStats;
  isInputBlocked(): boolean;
  isGameplayInputBlocked(): boolean;
  getReducedMotion(): boolean;
  registerWorldSceneApi(api: WorldSceneApi): void;
  onCombatUiStateChanged(snapshot: CombatUiSnapshot): void;
  commitHumanAction(humanId: string, mode: HumanActionMode): HumanActionCommitResult;
  onHumanFocused(humanId: string | null): void;
  onFeedShortcut(humanId: string): void;
  onCollectItem(nodeId: string, itemId: ItemId, amount: number): void;
  onCollectMemory(collectibleId: string): void;
  onEnemyDefeated(instanceId: string, enemyType: EnemyType): void;
  onZoneChanged(zone: string): void;
  onPlayerVitalsChanged(nextHealth: number, nextVitae: number): void;
  onVassalVitalsChanged(vassalId: string, nextHealth: number, nextVitae: number): void;
  onVassalIncapacitated(vassalId: string): void;
  onRespawn(): void;
  onPauseRequested(): void;
  notifyWorldCycleChanged(): void;
}
