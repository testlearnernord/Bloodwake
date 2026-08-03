import type { CombatUiSnapshot, HumanActionCommitResult, HumanActionMode, WorldSceneApi } from './combat/combatTypes';
import type { CombatStats } from '../simulation/combat/stats';
import type { ItemId, SaveGame } from '../types/models';

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
  onCollectItem(itemId: ItemId, amount: number): void;
  onCollectMemory(collectibleId: string): void;
  onEnemyDefeated(enemyId: string): void;
  onZoneChanged(zone: string): void;
  onPlayerVitalsChanged(nextHealth: number, nextVitae: number): void;
  onRespawn(): void;
  onPauseRequested(): void;
}
