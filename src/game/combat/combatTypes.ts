import type { EnemyType } from '../../types/models';

export type CombatActionId = 'light' | 'heavy' | 'blood_lance' | 'bite' | 'dodge';
export type HumanActionMode = 'feed' | 'drain' | 'turn';
export type TelegraphShape = 'arc' | 'line' | 'circle';

export type PlayerActionState =
  | 'idle'
  | 'moving'
  | 'locked_moving'
  | 'dodge'
  | 'light_windup'
  | 'light_active'
  | 'light_recovery'
  | 'heavy_windup'
  | 'heavy_active'
  | 'heavy_recovery'
  | 'ranged_windup'
  | 'ranged_release'
  | 'ranged_recovery'
  | 'bite_approach'
  | 'bite_hold'
  | 'bite_release'
  | 'hurt'
  | 'dead';

export type EnemyCombatState =
  | 'idle'
  | 'patrol'
  | 'notice'
  | 'approach'
  | 'reposition'
  | 'windup'
  | 'active_attack'
  | 'recovery'
  | 'stagger'
  | 'return_home'
  | 'dead';

export interface VectorLike {
  x: number;
  y: number;
}

export interface CombatActionDefinition {
  id: CombatActionId;
  label: string;
  shortcut: string;
  iconId: string;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  damageMultiplier: number;
  flatDamage: number;
  range: number;
  attackArc: number;
  vitaeCost: number;
  movementMultiplier: number;
  lungeDistance: number;
  interruptible: boolean;
  stagger: number;
  hitStopMs: number;
  cameraShake: number;
  animationId: string;
  effectId: string;
  activeState: PlayerActionState;
  recoveryState: PlayerActionState;
  windupState: PlayerActionState;
  commitOnStart?: boolean;
  commitOnActiveStart?: boolean;
  projectileId?: string;
}

export interface ProjectileDefinition {
  id: string;
  label: string;
  speed: number;
  lifetimeMs: number;
  maxRange: number;
  collisionRadius: number;
  damage: number;
  stagger: number;
  trailColor: number;
  impactColor: number;
  hitStopMs: number;
  cameraShake: number;
  canHitHumans: boolean;
  homingStrength?: number;
}

export interface EnemyAttackDefinition {
  id: string;
  enemyType: EnemyType;
  name: string;
  range: number;
  preferredDistance: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  damage: number;
  telegraphShape: TelegraphShape;
  trackingDuringWindup: boolean;
  directionLockMs: number;
  cooldownMs: number;
  staggerResistance: number;
  projectileId?: string;
  width?: number;
  arc?: number;
}

export interface CombatDamageEvent {
  sourceId: string;
  targetId: string;
  actionId: string;
  rawDamage: number;
  mitigatedDamage: number;
  stagger: number;
  worldPosition: VectorLike;
}

export interface CombatTargetSnapshot {
  id: string;
  type: EnemyType;
  name: string;
  health: number;
  maxHealth: number;
  x: number;
  y: number;
  alive: boolean;
  active: boolean;
  hostile: boolean;
  elite: boolean;
  stateLabel: string;
}

export interface CombatAbilityUiState {
  id: CombatActionId;
  label: string;
  shortcut: string;
  iconId: string;
  cooldownMs: number;
  cooldownRemainingMs: number;
  vitaeCost: number;
  active: boolean;
  disabledReason: string | null;
}

export interface LockedTargetHudState {
  id: string;
  name: string;
  typeLabel: string;
  health: number;
  maxHealth: number;
  elite: boolean;
  stateLabel: string;
  statusText: string;
}

export interface CombatUiSnapshot {
  playerState: PlayerActionState;
  lockedTarget: LockedTargetHudState | null;
  abilities: CombatAbilityUiState[];
  lockOnActive: boolean;
  dodgeInvulnerable: boolean;
  playerHealthPreview: number;
  playerVitaePreview: number;
}

export interface HumanActionCommitResult {
  ok: boolean;
  message: string;
  inheritanceSummary?: string;
}

export interface WorldSceneApi {
  startHumanActionSequence: (humanId: string, mode: HumanActionMode) => boolean;
}
