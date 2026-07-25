import type { SaveGame } from '../types/models';

export interface GameBridge {
  getState(): SaveGame;
  onHumanFocused(humanId: string | null): void;
  onFeedShortcut(humanId: string): void;
  onCollectResource(resourceId: string, amount: number): void;
  onCollectMemory(collectibleId: string): void;
  onEnemyDefeated(enemyId: string): void;
  onZoneChanged(zone: string): void;
  onPlayerVitalsChanged(nextHealth: number, nextVitae: number): void;
  onRespawn(): void;
  onPauseRequested(): void;
}
