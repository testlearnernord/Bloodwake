import Phaser from 'phaser';
import {
  BITE_RANGE,
  COFFIN_RESPAWN_FADE_MS,
  DODGE_SPEED,
  LOCK_BREAK_RANGE,
  LOCK_RANGE,
  PLAYER_MOVE_SPEED,
  TURN_COST_VITAE,
} from '../../config/balancing';
import { COFFIN_RESPAWN, WORLD_BOUNDS } from '../../config/game';
import { BLOOD_LANCE_PROJECTILE, HOLY_BOLT_PROJECTILE } from '../../data/abilities';
import { PLAYER_ACTIONS_BY_ID } from '../../data/combatActions';
import { ENEMY_ATTACKS_BY_ID } from '../../data/enemyAttacks';
import { ENEMIES_BY_ID } from '../../data/enemies';
import { canPlayerExplore } from '../../simulation/time/dayNight';
import type { EnemyType, HumanCharacter, ItemId } from '../../types/models';
import type { GameBridge } from '../bridge';
import { CombatPresentation, type TargetIndicator } from '../combat/CombatPresentation';
import type { CombatActionId, CombatDamageEvent, CombatTargetSnapshot, CombatUiSnapshot, HumanActionMode, LockedTargetHudState } from '../combat/combatTypes';
import { createBiteSequence, stepBiteSequence, validateHumanAction, type BiteSequenceRuntime } from '../../simulation/combat/bite';
import {
  createInitialPlayerActionRuntime,
  isInvulnerable,
  registerActionHit,
  setPlayerDead,
  startAction,
  stepAction,
  type PlayerActionRuntime,
} from '../../simulation/combat/actionState';
import { createEnemyRuntime, applyEnemyStagger, stepEnemyCombat, type EnemyRuntimeState } from '../../simulation/combat/enemyCombat';
import { computeFreeMovement, computeLockedMovement, type MovementInput } from '../../simulation/combat/movement';
import { createProjectile, registerProjectileImpact, resolveProjectileDirection, stepProjectile, type CombatProjectile } from '../../simulation/combat/projectiles';
import { cycleLockTarget, selectLockTarget, selectTargetNearPoint, shouldBreakLock } from '../../simulation/combat/targeting';
import { applyIncomingDamage } from '../../simulation/combat/stats';

interface SceneEnemy {
  id: string;
  sprite: Phaser.Physics.Arcade.Image;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  runtime: EnemyRuntimeState;
  telegraph: Phaser.GameObjects.Container | null;
  aimAngle: number;
}

interface SceneHuman {
  sprite: Phaser.Physics.Arcade.Image;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  human: HumanCharacter;
}

interface SceneResourceNode {
  id: string;
  itemId: ItemId;
  amount: number;
  sprite: Phaser.GameObjects.Rectangle;
}

interface SceneProjectile {
  runtime: CombatProjectile;
  visual: Phaser.GameObjects.Arc;
  owner: 'player' | 'enemy';
  lastTrailAt: number;
}

export class WorldScene extends Phaser.Scene {
  private readonly bridge: GameBridge;
  private player!: Phaser.Physics.Arcade.Image;
  private playerShadow: Phaser.GameObjects.Ellipse | null = null;
  private humans: SceneHuman[] = [];
  private enemies: SceneEnemy[] = [];
  private resources: SceneResourceNode[] = [];
  private projectiles: SceneProjectile[] = [];
  private memoryFragment: Phaser.GameObjects.Rectangle | null = null;
  private nearbyHumanId: string | null = null;
  private lockedTargetId: string | null = null;
  private targetIndicator: TargetIndicator | null = null;
  private cursors!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private dodgeKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private biteKey!: Phaser.Input.Keyboard.Key;
  private rangedKey!: Phaser.Input.Keyboard.Key;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private lockKey!: Phaser.Input.Keyboard.Key;
  private activeZone = 'Ruined Stronghold';
  private hintText!: Phaser.GameObjects.Text;
  private playerAction: PlayerActionRuntime = createInitialPlayerActionRuntime();
  private biteSequence: BiteSequenceRuntime | null = null;
  private dodgeVelocity: { x: number; y: number } | null = null;
  private playerStatePreview = 'idle';
  private playerHealthPreview = 0;
  private lastUiEmitAt = 0;
  private reducedMotion = false;
  private followOffset = new Phaser.Math.Vector2(0, 0);
  private playerAimAngle = 0;

  constructor(bridge: GameBridge) {
    super('world');
    this.bridge = bridge;
  }

  create(): void {
    this.reducedMotion = this.bridge.getReducedMotion();
    this.playerHealthPreview = this.bridge.getState().player.health;
    this.cameras.main.setBackgroundColor('#0c1014');
    this.physics.world.setBounds(0, 0, WORLD_BOUNDS.width, WORLD_BOUNDS.height);
    CombatPresentation.ensureTextures(this);
    this.createWorldGeometry();
    this.createPlayer();
    this.createHumans();
    this.createEnemies();
    this.createResources();
    this.createMemoryFragment();
    this.createUiHints();
    this.configureInput();
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setRoundPixels(true);
    this.targetIndicator = CombatPresentation.createTargetIndicator(this);
    this.bridge.registerWorldSceneApi({
      startHumanActionSequence: (humanId, mode) => this.startHumanActionSequence(humanId, mode),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupCombatRuntime());
    this.emitCombatUi(this.time.now);
  }

  update(time: number, delta: number): void {
    const state = this.bridge.getState();
    this.syncHumansWithState();
    this.syncMemoryWithState();
    this.playerHealthPreview = Phaser.Math.Linear(this.playerHealthPreview, state.player.health, state.player.health < this.playerHealthPreview ? 0.08 : 0.28);
    if (!canPlayerExplore(state.time.phase)) {
      this.releaseTargetLock();
      this.player.setPosition(COFFIN_RESPAWN.x, COFFIN_RESPAWN.y);
      this.player.setVelocity(0, 0);
      this.hintText.setText('Daylight drives you back to the keep.');
    }
    this.updateNearbyHuman();
    this.updateZone();
    this.stepPlayerAction(time);
    this.updateMovement(time);
    this.updateEnemyAi(time);
    this.updateProjectiles(time, delta);
    this.updateTargetLock(time);
    this.updateCameraFraming();
    this.updatePresentation(time);
    if (!this.bridge.isGameplayInputBlocked()) {
      this.handleActionKeys(time);
    } else {
      this.player.setVelocity(0, 0);
    }
    if (time - this.lastUiEmitAt >= 90) {
      this.emitCombatUi(time);
    }
  }

  private createWorldGeometry(): void {
    this.add.rectangle(170, 360, 300, 640, 0x1b2630, 1).setStrokeStyle(2, 0x4f5d75);
    this.add.rectangle(640, 360, 540, 640, 0x173321, 1).setStrokeStyle(2, 0x355e3b);
    this.add.rectangle(1090, 360, 300, 640, 0x3b2d1f, 1).setStrokeStyle(2, 0x8d6e63);
    this.add.text(60, 50, 'Ruined Stronghold', { color: '#f8f9fa', fontSize: '20px' });
    this.add.text(530, 50, 'Forest Road', { color: '#f8f9fa', fontSize: '20px' });
    this.add.text(1000, 50, 'Village Edge', { color: '#f8f9fa', fontSize: '20px' });
  }

  private createPlayer(): void {
    this.player = this.physics.add.image(COFFIN_RESPAWN.x, COFFIN_RESPAWN.y, 'player-token');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(5);
    this.player.setCircle(12, 3, 8);
    this.playerShadow = CombatPresentation.createShadow(this, COFFIN_RESPAWN.x, COFFIN_RESPAWN.y, 24, 11);
  }

  private createHumans(): void {
    const state = this.bridge.getState();
    const positions = [
      { x: 930, y: 260 },
      { x: 1010, y: 330 },
      { x: 1120, y: 280 },
      { x: 880, y: 430 },
      { x: 980, y: 500 },
    ];
    this.humans = state.npcs
      .filter((human) => human.status !== 'drained' && human.status !== 'turned')
      .map((human, index) => {
        const position = positions[index % positions.length];
        const shadow = CombatPresentation.createShadow(this, position.x, position.y, 22, 10);
        const sprite = this.physics.add.image(position.x, position.y, 'human-token').setDepth(5);
        sprite.setCircle(10, 4, 10);
        const label = this.add.text(position.x, position.y - 28, `${human.name} ${human.familyName}`, { color: '#f8f9fa', fontSize: '11px' }).setOrigin(0.5).setDepth(6).setVisible(false);
        return { sprite, shadow, human, label };
      });
  }

  private createEnemies(): void {
    const spawns: Array<{ id: string; type: EnemyType; x: number; y: number }> = [
      { id: 'bandit-1', type: 'bandit', x: 520, y: 270 },
      { id: 'clergy-1', type: 'clergy_hunter', x: 730, y: 470 },
      { id: 'knight-1', type: 'elite_knight', x: 1160, y: 410 },
    ];
    this.enemies = spawns.map((spawn) => {
      const shadow = CombatPresentation.createShadow(this, spawn.x, spawn.y, spawn.type === 'elite_knight' ? 28 : 24, 11);
      const sprite = this.physics.add.image(spawn.x, spawn.y, `${spawn.type}-token`).setDepth(5);
      sprite.setCircle(spawn.type === 'elite_knight' ? 13 : 11, 4, 10);
      sprite.setCollideWorldBounds(true);
      const definition = ENEMIES_BY_ID[spawn.type];
      const label = this.add.text(spawn.x, spawn.y - 34, definition.elite ? `${definition.name} • Elite` : definition.name, {
        color: '#f8f9fa',
        fontSize: '12px',
      }).setOrigin(0.5).setDepth(6);
      return {
        id: spawn.id,
        sprite,
        shadow,
        label,
        runtime: createEnemyRuntime(spawn.id, spawn.type, { x: spawn.x, y: spawn.y }),
        telegraph: null,
        aimAngle: 0,
      };
    });
  }

  private createResources(): void {
    this.resources = [
      { id: 'wood-node', itemId: 'wood', amount: 3, sprite: this.add.rectangle(430, 340, 20, 20, 0x2d6a4f).setDepth(4) },
      { id: 'herb-node', itemId: 'herbs', amount: 2, sprite: this.add.rectangle(740, 250, 18, 18, 0x74c69d).setDepth(4) },
      { id: 'ore-node', itemId: 'iron_ore', amount: 2, sprite: this.add.rectangle(840, 520, 20, 20, 0x6c757d).setDepth(4) },
      { id: 'stone-node', itemId: 'stone', amount: 2, sprite: this.add.rectangle(300, 280, 18, 18, 0x868e96).setDepth(4) },
      { id: 'food-node', itemId: 'food', amount: 2, sprite: this.add.rectangle(980, 180, 18, 18, 0xe9c46a).setDepth(4) },
    ];
  }

  private createMemoryFragment(): void {
    const collected = this.bridge.getState().collectibles.find((entry) => entry.collectibleId === 'memory_fragment_1')?.discovered;
    if (!collected) {
      this.memoryFragment = this.add.rectangle(600, 180, 18, 18, 0xe9c46a).setDepth(4);
    }
  }

  private createUiHints(): void {
    this.hintText = this.add
      .text(24, 680, 'WASD move · Ctrl lock · Tab next · Shift+Tab prev · MMB cursor lock · Q Blood Lance · F feed', {
        color: '#f8f9fa',
        fontSize: '16px',
      })
      .setScrollFactor(0)
      .setDepth(20);
  }

  private configureInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }
    this.cursors = {
      up: keyboard.addKey('W'),
      down: keyboard.addKey('S'),
      left: keyboard.addKey('A'),
      right: keyboard.addKey('D'),
    };
    this.dodgeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.interactKey = keyboard.addKey('E');
    this.biteKey = keyboard.addKey('F');
    this.rangedKey = keyboard.addKey('Q');
    this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.lockKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.bridge.isGameplayInputBlocked()) return;
      if (pointer.middleButtonDown()) {
        this.lockTargetNearCursor();
        return;
      }
      if (pointer.rightButtonDown()) {
        this.tryStartPlayerAction('heavy', this.time.now);
      } else {
        this.tryStartPlayerAction('light', this.time.now);
      }
    });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: Phaser.GameObjects.GameObject[], _dx: number, dy: number, _dz: number, event: WheelEvent) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      if (this.bridge.isGameplayInputBlocked()) {
        return;
      }
      this.cycleTargetLock(dy < 0 ? -1 : 1);
    });
  }

  private cleanupCombatRuntime(): void {
    for (const projectile of this.projectiles) {
      projectile.visual.destroy();
    }
    this.projectiles = [];
    for (const enemy of this.enemies) {
      enemy.telegraph?.destroy();
    }
    this.targetIndicator?.destroy();
    this.targetIndicator = null;
    this.input.removeAllListeners();
  }

  private getMovementInput(): MovementInput {
    return {
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
    };
  }

  private updateMovement(time: number): void {
    if (this.playerAction.state === 'dead' || this.biteSequence) {
      this.player.setVelocity(0, 0);
      return;
    }
    // Preserve the stored dodge velocity for the entire dodge window so
    // normal/locked movement and attack multipliers cannot overwrite it.
    if ((this.playerAction.state === 'dodge_windup' || this.playerAction.state === 'dodge_active') && this.dodgeVelocity) {
      this.player.setVelocity(this.dodgeVelocity.x, this.dodgeVelocity.y);
      if (this.playerAction.state === 'dodge_active' && time % 40 < 20) {
        CombatPresentation.showAfterimage(this, this.player);
      }
      return;
    }
    const input = this.getMovementInput();
    const pointer = this.input.activePointer;
    const lockedEnemy = this.getLockedEnemy();
    const moving = input.up || input.down || input.left || input.right;
    const movement = lockedEnemy
      ? computeLockedMovement(input, { x: this.player.x, y: this.player.y }, { x: lockedEnemy.sprite.x, y: lockedEnemy.sprite.y }, PLAYER_MOVE_SPEED)
      : computeFreeMovement(input, PLAYER_MOVE_SPEED, { x: pointer.worldX - this.player.x, y: pointer.worldY - this.player.y });
    const actionMultiplier = this.playerAction.actionId ? PLAYER_ACTIONS_BY_ID[this.playerAction.actionId].movementMultiplier : 1;
    this.player.setVelocity(movement.velocity.x * actionMultiplier, movement.velocity.y * actionMultiplier);
    if (lockedEnemy) {
      this.playerAimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, lockedEnemy.sprite.x, lockedEnemy.sprite.y);
      if (this.playerAction.state === 'idle' || this.playerAction.state === 'moving') {
        this.playerStatePreview = moving ? 'locked_moving' : 'idle';
      }
    } else {
      this.playerAimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
      if (this.playerAction.state === 'idle') {
        this.playerStatePreview = moving ? 'moving' : 'idle';
      }
    }
  }

  private updateNearbyHuman(): void {
    const human = this.humans
      .filter((entry) => entry.sprite.active)
      .find((entry) => Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.sprite.x, entry.sprite.y) <= BITE_RANGE);
    const nextHumanId = human?.human.id ?? null;
    if (nextHumanId !== this.nearbyHumanId) {
      this.nearbyHumanId = nextHumanId;
      this.bridge.onHumanFocused(nextHumanId);
    }
    for (const entry of this.humans) {
      const showLabel = entry.human.id === this.nearbyHumanId;
      entry.label.setVisible(showLabel);
    }
  }

  private updateZone(): void {
    const zone = this.player.x < 320 ? 'Ruined Stronghold' : this.player.x < 920 ? 'Forest Road' : 'Village Edge';
    if (zone !== this.activeZone) {
      this.activeZone = zone;
      this.bridge.onZoneChanged(zone);
    }
  }

  private handleActionKeys(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.lockKey)) {
      this.toggleTargetLock();
    }
    if (Phaser.Input.Keyboard.JustDown(this.dodgeKey)) {
      this.tryStartPlayerAction('dodge', time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.interactNearbyObject();
    }
    if (Phaser.Input.Keyboard.JustDown(this.biteKey) && this.nearbyHumanId) {
      this.startHumanActionSequence(this.nearbyHumanId, 'feed');
    }
    if (Phaser.Input.Keyboard.JustDown(this.rangedKey)) {
      this.tryStartPlayerAction('blood_lance', time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      this.cycleTargetLock(this.shiftKey.isDown ? -1 : 1);
    }
  }

  private tryStartPlayerAction(actionId: 'light' | 'heavy' | 'blood_lance' | 'dodge', now: number): void {
    const state = this.bridge.getState();
    const started = startAction(PLAYER_ACTIONS_BY_ID[actionId], this.playerAction, {
      now,
      blocked: this.bridge.isGameplayInputBlocked() || Boolean(this.biteSequence),
      dead: state.player.health <= 0,
      activeMenuOpen: this.bridge.isInputBlocked(),
      currentVitae: state.player.vitae,
    });
    if (!started.ok) {
      if (started.reason === 'Insufficient Vitae') {
        this.hintText.setText(actionId === 'heavy' ? 'Heavy Attack requires Vitae.' : 'Blood Lance requires Vitae.');
      }
      return;
    }
    this.playerAction = started.runtime;
    this.playerStatePreview = started.runtime.state;
    if (actionId === 'dodge') {
      const dodgeDirection = this.resolveDodgeDirection();
      const vx = dodgeDirection.x * DODGE_SPEED;
      const vy = dodgeDirection.y * DODGE_SPEED;
      this.dodgeVelocity = { x: vx, y: vy };
      this.player.setVelocity(vx, vy);
      this.hintText.setText('You become untouchable for a brief instant.');
    }
  }

  private resolveDodgeDirection(): Phaser.Math.Vector2 {
    const lockedEnemy = this.getLockedEnemy();
    const input = this.getMovementInput();
    if (lockedEnemy) {
      const movement = computeLockedMovement(input, { x: this.player.x, y: this.player.y }, { x: lockedEnemy.sprite.x, y: lockedEnemy.sprite.y }, 1);
      if (movement.velocity.x !== 0 || movement.velocity.y !== 0) {
        return new Phaser.Math.Vector2(movement.velocity.x, movement.velocity.y).normalize();
      }
      return new Phaser.Math.Vector2(this.player.x - lockedEnemy.sprite.x, this.player.y - lockedEnemy.sprite.y).normalize();
    }
    const free = computeFreeMovement(input, 1, { x: this.input.activePointer.worldX - this.player.x, y: this.input.activePointer.worldY - this.player.y });
    if (free.velocity.x !== 0 || free.velocity.y !== 0) {
      return new Phaser.Math.Vector2(free.velocity.x, free.velocity.y).normalize();
    }
    return new Phaser.Math.Vector2(Math.cos(this.playerAimAngle), Math.sin(this.playerAimAngle)).normalize();
  }

  private stepPlayerAction(time: number): void {
    if (this.biteSequence) {
      const biteStep = stepBiteSequence(this.biteSequence, time);
      this.biteSequence = biteStep.finished ? null : biteStep.runtime;
      this.playerStatePreview = biteStep.finished ? 'idle' : biteStep.runtime.phase;
      if (biteStep.shouldCommit) {
        const result = this.bridge.commitHumanAction(biteStep.runtime.humanId, biteStep.runtime.mode);
        if (!result.ok) {
          this.hintText.setText(result.message);
        } else {
          this.hintText.setText(result.inheritanceSummary ?? result.message);
        }
      }
      if (!this.biteSequence) {
        this.playerAction = { ...createInitialPlayerActionRuntime(), cooldowns: { ...this.playerAction.cooldowns }, invulnerableUntil: this.playerAction.invulnerableUntil };
      }
    }
    const step = stepAction(this.playerAction, time);
    this.playerAction = step.runtime;
    if (step.committedCost && this.playerAction.actionId) {
      const state = this.bridge.getState();
      const definition = PLAYER_ACTIONS_BY_ID[this.playerAction.actionId];
      this.bridge.onPlayerVitalsChanged(state.player.health, state.player.vitae - definition.vitaeCost);
    }
    if (step.becameActive && this.playerAction.actionId) {
      this.onPlayerActionBecameActive(this.playerAction.actionId, time);
    }
    if (step.finished && !this.biteSequence) {
      this.playerStatePreview = 'idle';
      this.dodgeVelocity = null;
    } else if (this.playerAction.actionId) {
      this.playerStatePreview = this.playerAction.state;
    }
  }

  private onPlayerActionBecameActive(actionId: 'light' | 'heavy' | 'blood_lance' | 'dodge' | 'bite', time: number): void {
    const definition = PLAYER_ACTIONS_BY_ID[actionId];
    if (actionId === 'light' || actionId === 'heavy') {
      const direction = new Phaser.Math.Vector2(Math.cos(this.playerAimAngle), Math.sin(this.playerAimAngle));
      this.player.setVelocity(direction.x * (definition.lungeDistance * 9), direction.y * (definition.lungeDistance * 9));
      CombatPresentation.showSlash(this, this.player.x, this.player.y, this.playerAimAngle, definition.range, definition.attackArc, actionId === 'light' ? 0xf8f9fa : 0xb91c3c, this.reducedMotion);
      this.damageEnemiesInArc(actionId, time);
    }
    if (actionId === 'blood_lance') {
      this.spawnPlayerProjectile(time);
      CombatPresentation.spawnBloodBurst(this, this.player.x + Math.cos(this.playerAimAngle) * 16, this.player.y + Math.sin(this.playerAimAngle) * 16);
    }
  }

  private damageEnemiesInArc(actionId: 'light' | 'heavy', time: number): void {
    const state = this.bridge.getState();
    const combatStats = this.bridge.getCombatStats();
    const definition = PLAYER_ACTIONS_BY_ID[actionId];
    const facing = new Phaser.Math.Vector2(Math.cos(this.playerAimAngle), Math.sin(this.playerAimAngle)).normalize();
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active || enemy.runtime.health <= 0) continue;
      const toEnemy = new Phaser.Math.Vector2(enemy.sprite.x - this.player.x, enemy.sprite.y - this.player.y);
      const distance = toEnemy.length();
      if (distance > definition.range) continue;
      const angleDot = toEnemy.normalize().dot(facing);
      const minDot = Math.cos(Phaser.Math.DegToRad(definition.attackArc / 2));
      if (angleDot < minDot) continue;
      const hit = registerActionHit(this.playerAction, enemy.id);
      this.playerAction = hit.runtime;
      if (!hit.applied) continue;
      const rawDamage = Math.max(1, Math.round(combatStats.attackDamage * definition.damageMultiplier + definition.flatDamage));
      const event: CombatDamageEvent = {
        sourceId: 'player',
        targetId: enemy.id,
        actionId,
        rawDamage,
        mitigatedDamage: rawDamage,
        stagger: definition.stagger,
        worldPosition: { x: enemy.sprite.x, y: enemy.sprite.y },
      };
      this.applyDamageEvent(event, time);
      enemy.runtime = applyEnemyStagger(enemy.runtime, event.stagger, time);
    }
    const weaponName = state.player.equipment.Weapon ? 'Simple Sword' : 'Claws';
    this.hintText.setText(`${weaponName} lashes out during the ${actionId === 'light' ? 'quick' : 'heavy'} opening.`);
  }

  private spawnPlayerProjectile(now: number): void {
    const target = this.getLockedEnemy();
    const direction = resolveProjectileDirection(
      { x: this.player.x, y: this.player.y },
      target ? { x: target.sprite.x, y: target.sprite.y } : null,
      { x: this.input.activePointer.worldX, y: this.input.activePointer.worldY },
    );
    const runtime = createProjectile('blood_lance', 'player', { x: this.player.x, y: this.player.y }, direction, now, target?.id ?? null);
    const visual = CombatPresentation.showProjectile(this, this.player.x, this.player.y, BLOOD_LANCE_PROJECTILE.trailColor, 6);
    this.projectiles.push({ runtime, visual, owner: 'player', lastTrailAt: now });
  }

  private spawnEnemyProjectile(enemy: SceneEnemy, now: number): void {
    const direction = new Phaser.Math.Vector2(enemy.runtime.facing.x, enemy.runtime.facing.y);
    const runtime = createProjectile('holy_bolt', enemy.id, { x: enemy.sprite.x, y: enemy.sprite.y }, direction, now, 'player');
    const visual = CombatPresentation.showProjectile(this, enemy.sprite.x, enemy.sprite.y, HOLY_BOLT_PROJECTILE.trailColor, 5);
    this.projectiles.push({ runtime, visual, owner: 'enemy', lastTrailAt: now });
  }

  private updateProjectiles(time: number, delta: number): void {
    this.projectiles = this.projectiles.filter((projectile) => {
      const target = projectile.runtime.targetId ? this.findEnemyById(projectile.runtime.targetId) : null;
      projectile.runtime = stepProjectile(
        projectile.runtime,
        time,
        delta,
        target?.sprite.active ? { x: target.sprite.x, y: target.sprite.y } : null,
      );
      projectile.visual.setPosition(projectile.runtime.position.x, projectile.runtime.position.y);
      if (time - projectile.lastTrailAt >= 60) {
        projectile.lastTrailAt = time;
        const color = projectile.owner === 'player' ? BLOOD_LANCE_PROJECTILE.trailColor : HOLY_BOLT_PROJECTILE.trailColor;
        const dot = this.add.circle(projectile.runtime.position.x, projectile.runtime.position.y, projectile.owner === 'player' ? 3 : 2, color, 0.45).setDepth(5);
        this.tweens.add({ targets: dot, alpha: 0, scale: 0.4, duration: 160, onComplete: () => dot.destroy() });
      }
      if (!projectile.runtime.destroyed) {
        if (projectile.owner === 'player') {
          for (const enemy of this.enemies) {
            if (!enemy.sprite.active || enemy.runtime.health <= 0) continue;
            const distance = Phaser.Math.Distance.Between(projectile.runtime.position.x, projectile.runtime.position.y, enemy.sprite.x, enemy.sprite.y);
            if (distance <= BLOOD_LANCE_PROJECTILE.collisionRadius) {
              const impact = registerProjectileImpact(projectile.runtime, enemy.id);
              projectile.runtime = impact.projectile;
              if (impact.applied) {
                this.applyDamageEvent(
                  {
                    sourceId: 'player',
                    targetId: enemy.id,
                    actionId: 'blood_lance',
                    rawDamage: BLOOD_LANCE_PROJECTILE.damage,
                    mitigatedDamage: BLOOD_LANCE_PROJECTILE.damage,
                    stagger: BLOOD_LANCE_PROJECTILE.stagger,
                    worldPosition: { x: enemy.sprite.x, y: enemy.sprite.y },
                  },
                  time,
                );
                enemy.runtime = applyEnemyStagger(enemy.runtime, BLOOD_LANCE_PROJECTILE.stagger, time);
              }
              break;
            }
          }
        } else {
          const distance = Phaser.Math.Distance.Between(projectile.runtime.position.x, projectile.runtime.position.y, this.player.x, this.player.y);
          if (distance <= HOLY_BOLT_PROJECTILE.collisionRadius) {
            const impact = registerProjectileImpact(projectile.runtime, 'player');
            projectile.runtime = impact.projectile;
            if (impact.applied && !isInvulnerable(this.playerAction, time)) {
              const state = this.bridge.getState();
              const damage = applyIncomingDamage(HOLY_BOLT_PROJECTILE.damage, this.bridge.getCombatStats().armor);
              this.bridge.onPlayerVitalsChanged(Math.max(0, state.player.health - damage), state.player.vitae);
              CombatPresentation.flashSprite(this, this.player, 0xffa8a8, true);
              CombatPresentation.spawnFloatingDamage(this, this.player.x, this.player.y - 20, damage, '#ffd7d7');
            }
          }
        }
      }
      if (projectile.runtime.destroyed) {
        CombatPresentation.spawnBloodBurst(this, projectile.runtime.position.x, projectile.runtime.position.y, projectile.owner === 'player' ? BLOOD_LANCE_PROJECTILE.impactColor : HOLY_BOLT_PROJECTILE.impactColor);
        projectile.visual.destroy();
        return false;
      }
      return true;
    });
  }

  private applyDamageEvent(event: CombatDamageEvent, time: number): void {
    if (event.targetId === 'player') {
      if (isInvulnerable(this.playerAction, time)) {
        return;
      }
      const state = this.bridge.getState();
      const nextHealth = Math.max(0, state.player.health - event.mitigatedDamage);
      this.bridge.onPlayerVitalsChanged(nextHealth, state.player.vitae);
      CombatPresentation.flashSprite(this, this.player, 0xffa8a8, true);
      CombatPresentation.spawnFloatingDamage(this, this.player.x, this.player.y - 20, event.mitigatedDamage, '#ffd7d7');
      if (nextHealth <= 0) {
        this.playerAction = setPlayerDead(this.playerAction);
        this.playerStatePreview = 'dead';
        this.releaseTargetLock();
        this.time.delayedCall(COFFIN_RESPAWN_FADE_MS, () => {
          this.bridge.onRespawn();
          this.player.clearTint();
          this.player.setAlpha(0);
          this.player.setPosition(COFFIN_RESPAWN.x, COFFIN_RESPAWN.y);
          this.tweens.add({ targets: this.player, alpha: 1, duration: COFFIN_RESPAWN_FADE_MS });
          this.playerAction = createInitialPlayerActionRuntime();
          this.playerStatePreview = 'idle';
        });
      }
      return;
    }
    const enemy = this.findEnemyById(event.targetId);
    if (!enemy) {
      return;
    }
    enemy.runtime.health = Math.max(0, enemy.runtime.health - event.mitigatedDamage);
    CombatPresentation.flashSprite(this, enemy.sprite, 0xff6b81);
    CombatPresentation.spawnFloatingDamage(this, enemy.sprite.x, enemy.sprite.y - 24, event.mitigatedDamage, '#ffe3e3');
    CombatPresentation.spawnBloodBurst(this, enemy.sprite.x, enemy.sprite.y);
    const shakeDurationByAction: Partial<Record<CombatActionId, number>> = {
      light: 45,
      heavy: 85,
      blood_lance: 55,
    };
    const shakeActionId: CombatActionId | null =
      event.actionId === 'light' || event.actionId === 'heavy' || event.actionId === 'blood_lance' ? event.actionId : null;
    const shakeDuration = shakeActionId ? shakeDurationByAction[shakeActionId] ?? 40 : 40;
    const shakeIntensity = shakeActionId === 'heavy' ? 0.003 : 0.0015;
    this.cameras.main.shake(this.reducedMotion ? 40 : shakeDuration, shakeIntensity, false);
    if (enemy.runtime.health <= 0) {
      enemy.runtime.state = 'dead';
      enemy.runtime.telegraphVisible = false;
      enemy.telegraph?.destroy();
      enemy.telegraph = null;
      if (this.lockedTargetId === enemy.id) {
        this.releaseTargetLock();
      }
      CombatPresentation.fadeDeath(this, enemy.sprite, enemy.shadow);
      enemy.label.destroy();
      this.bridge.onEnemyDefeated(enemy.runtime.type);
    }
  }

  private updateEnemyAi(time: number): void {
    const playerArmor = this.bridge.getCombatStats().armor;
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active || enemy.runtime.health <= 0) {
        continue;
      }
      enemy.runtime.position = { x: enemy.sprite.x, y: enemy.sprite.y };
      const step = stepEnemyCombat(enemy.runtime, { x: this.player.x, y: this.player.y }, time, playerArmor);
      const previousState = enemy.runtime.state;
      enemy.runtime = step.enemy;
      if (previousState !== 'windup' && enemy.runtime.state === 'windup') {
        const attack = ENEMY_ATTACKS_BY_ID[enemy.runtime.attackId];
        enemy.telegraph?.destroy();
        enemy.telegraph = CombatPresentation.showTelegraph(
          this,
          attack.telegraphShape,
          enemy.sprite.x,
          enemy.sprite.y,
          enemy.aimAngle,
          attack.range,
          attack.width ?? attack.arc ?? 22,
          enemy.runtime.type === 'clergy_hunter' ? 0xf8e16c : enemy.runtime.type === 'elite_knight' ? 0xe9ecef : 0xff758f,
          enemy.runtime.type === 'clergy_hunter' ? 'Aim' : enemy.runtime.type === 'elite_knight' ? 'Cleave' : 'Slash',
        );
      }
      if (step.shouldCleanupTelegraph) {
        enemy.telegraph?.destroy();
        enemy.telegraph = null;
      }
      if (step.shouldFireProjectile) {
        this.spawnEnemyProjectile(enemy, time);
      }
      for (const damageEvent of step.damageEvents) {
        this.applyDamageEvent(damageEvent, time);
      }
      this.updateEnemyMovement(enemy);
    }
  }

  private updateEnemyMovement(enemy: SceneEnemy): void {
    const definition = ENEMIES_BY_ID[enemy.runtime.type];
    const attack = ENEMY_ATTACKS_BY_ID[enemy.runtime.attackId];
    if (enemy.runtime.state === 'approach') {
      if (enemy.runtime.type === 'bandit') {
        const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y) + 0.35;
        this.physics.moveTo(enemy.sprite, this.player.x + Math.cos(angle) * 20, this.player.y + Math.sin(angle) * 20, definition.speed);
      } else {
        this.physics.moveToObject(enemy.sprite, this.player, definition.speed);
      }
    } else if (enemy.runtime.state === 'reposition') {
      const away = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y);
      this.physics.moveTo(enemy.sprite, enemy.sprite.x + Math.cos(away) * 40, enemy.sprite.y + Math.sin(away) * 40, definition.speed);
    } else if (enemy.runtime.state === 'return_home') {
      this.physics.moveTo(enemy.sprite, enemy.runtime.homePosition.x, enemy.runtime.homePosition.y, definition.speed * 0.7);
      const homeDistance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, enemy.runtime.homePosition.x, enemy.runtime.homePosition.y);
      if (homeDistance < 8) {
        enemy.sprite.setVelocity(0, 0);
      }
    } else if (enemy.runtime.state === 'windup' || enemy.runtime.state === 'recovery' || enemy.runtime.state === 'active_attack' || enemy.runtime.state === 'stagger') {
      enemy.sprite.setVelocity(0, 0);
    } else {
      enemy.sprite.setVelocity(0, 0);
    }
    if (enemy.runtime.state === 'windup' && attack.trackingDuringWindup) {
      enemy.aimAngle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
      enemy.telegraph?.setRotation(enemy.aimAngle);
      enemy.telegraph?.setPosition(enemy.sprite.x, enemy.sprite.y);
    } else if (enemy.runtime.directionLock) {
      enemy.aimAngle = Phaser.Math.Angle.Between(0, 0, enemy.runtime.directionLock.x, enemy.runtime.directionLock.y);
      enemy.telegraph?.setRotation(enemy.aimAngle);
      enemy.telegraph?.setPosition(enemy.sprite.x, enemy.sprite.y);
    } else if (enemy.runtime.state === 'approach' || enemy.runtime.state === 'reposition' || enemy.runtime.state === 'return_home') {
      const velocity = enemy.sprite.body?.velocity;
      if (velocity && (velocity.x !== 0 || velocity.y !== 0)) {
        enemy.aimAngle = Phaser.Math.Angle.Between(0, 0, velocity.x, velocity.y);
      }
    }
  }

  private updateTargetLock(time: number): void {
    const enemy = this.getLockedEnemy();
    if (enemy && shouldBreakLock(this.toTargetSnapshot(enemy), { x: this.player.x, y: this.player.y }, LOCK_BREAK_RANGE)) {
      this.releaseTargetLock();
    }
    const current = this.getLockedEnemy();
    if (current && this.targetIndicator) {
      CombatPresentation.updateTargetIndicator(this.targetIndicator, current.sprite.x, current.sprite.y, current.runtime.type === 'elite_knight' ? 20 : 16, time, ENEMIES_BY_ID[current.runtime.type].elite === true);
    } else if (this.targetIndicator) {
      CombatPresentation.clearTargetIndicator(this.targetIndicator);
    }
  }

  private toggleTargetLock(): void {
    if (this.lockedTargetId) {
      this.releaseTargetLock();
      return;
    }
    const mouseDirection = { x: Math.cos(this.playerAimAngle), y: Math.sin(this.playerAimAngle) };
    const target = selectLockTarget(
      this.enemies.filter((enemy) => enemy.sprite.active && enemy.runtime.health > 0).map((enemy) => this.toTargetSnapshot(enemy)),
      { x: this.player.x, y: this.player.y },
      mouseDirection,
      LOCK_RANGE,
    );
    if (target) {
      this.lockedTargetId = target.id;
      this.hintText.setText(`Locked onto ${target.name}.`);
    } else {
      this.hintText.setText('No enemy is in lock range.');
    }
  }

  private cycleTargetLock(direction: 1 | -1): void {
    if (!this.lockedTargetId) {
      this.toggleTargetLock();
      return;
    }
    const next = cycleLockTarget(
      this.enemies.filter((enemy) => enemy.sprite.active && enemy.runtime.health > 0).map((enemy) => this.toTargetSnapshot(enemy)),
      this.lockedTargetId,
      { x: this.player.x, y: this.player.y },
      direction,
      LOCK_RANGE,
    );
    if (next) {
      this.lockedTargetId = next.id;
      this.hintText.setText(`Locked onto ${next.name}.`);
    }
  }

  private lockTargetNearCursor(): void {
    const target = selectTargetNearPoint(
      this.enemies.filter((enemy) => enemy.sprite.active && enemy.runtime.health > 0).map((enemy) => this.toTargetSnapshot(enemy)),
      { x: this.player.x, y: this.player.y },
      { x: this.input.activePointer.worldX, y: this.input.activePointer.worldY },
      110,
      LOCK_RANGE,
    );
    if (!target) {
      this.hintText.setText('No enemy is close enough to the cursor.');
      return;
    }
    this.lockedTargetId = target.id;
    this.hintText.setText(`Locked onto ${target.name} near the cursor.`);
  }

  private releaseTargetLock(): void {
    this.lockedTargetId = null;
    if (this.targetIndicator) {
      CombatPresentation.clearTargetIndicator(this.targetIndicator);
    }
    this.hintText.setText('Target lock released.');
  }

  private updateCameraFraming(): void {
    const lockedEnemy = this.getLockedEnemy();
    const targetOffset = lockedEnemy ? new Phaser.Math.Vector2((lockedEnemy.sprite.x - this.player.x) * 0.18, (lockedEnemy.sprite.y - this.player.y) * 0.18) : new Phaser.Math.Vector2(0, 0);
    this.followOffset.lerp(targetOffset, 0.08);
    this.cameras.main.setFollowOffset(-this.followOffset.x, -this.followOffset.y);
  }

  private updatePresentation(time: number): void {
    if (this.playerShadow) {
      this.playerShadow.setPosition(this.player.x, this.player.y + 14);
    }
    this.player.setRotation(0);
    this.player.setFlipX(Math.cos(this.playerAimAngle) < 0);
    this.player.setScale(this.playerStatePreview === 'moving' || this.playerStatePreview === 'locked_moving' ? 1.04 : this.playerStatePreview === 'heavy_windup' ? 1.12 : 1);
    this.player.setAlpha(this.playerStatePreview === 'dead' ? 0.3 : 1);
    for (const human of this.humans) {
      human.shadow.setPosition(human.sprite.x, human.sprite.y + 13);
      human.label.setPosition(human.sprite.x, human.sprite.y - 28);
      human.sprite.setRotation(0);
      human.sprite.setFlipX(human.sprite.x < this.player.x);
      if (human.human.id === this.nearbyHumanId) {
        human.sprite.setScale(1 + Math.sin(time / 120) * 0.02);
      } else {
        human.sprite.setScale(1);
      }
    }
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue;
      enemy.shadow.setPosition(enemy.sprite.x, enemy.sprite.y + 14);
      enemy.label.setPosition(enemy.sprite.x, enemy.sprite.y - 34);
      enemy.sprite.setRotation(0);
      enemy.sprite.setFlipX(Math.cos(enemy.aimAngle) < 0);
      if (enemy.runtime.state === 'windup') {
        enemy.sprite.setScale(enemy.runtime.type === 'elite_knight' ? 1.16 : 1.08);
      } else if (enemy.runtime.state === 'stagger') {
        enemy.sprite.setScale(0.94);
      } else {
        enemy.sprite.setScale(1);
      }
    }
  }

  private startHumanActionSequence(humanId: string, mode: HumanActionMode): boolean {
    const human = this.bridge.getState().npcs.find((entry) => entry.id === humanId);
    const validation = validateHumanAction(this.bridge.getState(), human, mode);
    if (!validation.ok || !human) {
      this.hintText.setText(validation.ok ? 'No valid human target.' : validation.reason);
      return false;
    }
    const started = startAction(PLAYER_ACTIONS_BY_ID.bite, this.playerAction, {
      now: this.time.now,
      blocked: this.bridge.isGameplayInputBlocked(),
      dead: this.bridge.getState().player.health <= 0,
      activeMenuOpen: this.bridge.isInputBlocked(),
      currentVitae: this.bridge.getState().player.vitae,
    });
    if (!started.ok) {
      return false;
    }
    this.playerAction = started.runtime;
    this.biteSequence = createBiteSequence(humanId, mode, this.time.now);
    this.playerStatePreview = 'bite_approach';
    const targetHuman = this.humans.find((entry) => entry.human.id === humanId);
    if (targetHuman) {
      this.playerAimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetHuman.sprite.x, targetHuman.sprite.y);
      this.physics.moveToObject(this.player, targetHuman.sprite, 180);
      targetHuman.sprite.setTint(mode === 'turn' ? 0xb91c3c : 0xf8f9fa);
      this.time.delayedCall(180, () => targetHuman.sprite.clearTint());
    }
    this.hintText.setText(mode === 'turn' && this.bridge.getState().player.vitae < TURN_COST_VITAE ? 'You reach but lack the vitae to complete the turning.' : `You seize ${human.name}.`);
    return true;
  }

  private interactNearbyObject(): void {
    for (const node of this.resources) {
      if (!node.sprite.active) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, node.sprite.x, node.sprite.y);
      if (distance <= 50) {
        node.sprite.destroy();
        this.bridge.onCollectItem(node.itemId, node.amount);
        this.hintText.setText(`Collected ${node.amount} ${node.itemId.replace('_', ' ')}.`);
        return;
      }
    }
    if (this.memoryFragment?.active) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.memoryFragment.x, this.memoryFragment.y);
      if (distance <= 50) {
        this.memoryFragment.destroy();
        this.memoryFragment = null;
        this.bridge.onCollectMemory('memory_fragment_1');
        this.hintText.setText('A lost memory stirs in the dark.');
        return;
      }
    }
    if (this.nearbyHumanId) {
      this.hintText.setText('Human is within reach. F bites, or use context buttons to feed, drain, or turn.');
    }
  }

  private syncHumansWithState(): void {
    const state = this.bridge.getState();
    const byId = new Map(state.npcs.map((human) => [human.id, human]));
    this.humans = this.humans.filter((entry) => {
      const updated = byId.get(entry.human.id);
      if (!updated || updated.status === 'drained' || updated.status === 'turned') {
        entry.shadow.destroy();
        entry.label.destroy();
        entry.sprite.destroy();
        return false;
      }
      entry.human = updated;
      return true;
    });
    if (this.nearbyHumanId && !state.npcs.some((human) => human.id === this.nearbyHumanId && human.status !== 'drained' && human.status !== 'turned')) {
      this.nearbyHumanId = null;
      this.bridge.onHumanFocused(null);
    }
  }

  private syncMemoryWithState(): void {
    const discovered = this.bridge.getState().collectibles.find((entry) => entry.collectibleId === 'memory_fragment_1')?.discovered;
    if (discovered && this.memoryFragment) {
      this.memoryFragment.destroy();
      this.memoryFragment = null;
    }
  }

  private getLockedEnemy(): SceneEnemy | null {
    return this.lockedTargetId ? this.findEnemyById(this.lockedTargetId) ?? null : null;
  }

  private findEnemyById(enemyId: string): SceneEnemy | undefined {
    return this.enemies.find((enemy) => enemy.id === enemyId && enemy.sprite.active && enemy.runtime.health > 0);
  }

  private toTargetSnapshot(enemy: SceneEnemy): CombatTargetSnapshot {
    const base = this.buildTargetHudState(enemy);
    return {
      id: base.id,
      type: enemy.runtime.type,
      name: base.name,
      health: base.health,
      maxHealth: base.maxHealth,
      x: enemy.sprite.x,
      y: enemy.sprite.y,
      alive: enemy.runtime.health > 0,
      active: enemy.sprite.active,
      hostile: true,
      elite: base.elite,
      stateLabel: base.stateLabel,
    };
  }

  private buildTargetHudState(enemy: SceneEnemy): LockedTargetHudState {
    const definition = ENEMIES_BY_ID[enemy.runtime.type];
    const stateLabel =
      enemy.runtime.state === 'idle'
        ? 'Idle'
        : enemy.runtime.state === 'patrol'
          ? 'Patrolling'
          : enemy.runtime.state === 'notice'
            ? 'Alert'
            : enemy.runtime.state === 'approach'
              ? 'Closing In'
              : enemy.runtime.state === 'reposition'
                ? 'Repositioning'
                : enemy.runtime.state === 'windup'
                  ? 'Winding Up'
                  : enemy.runtime.state === 'active_attack'
                    ? 'Attacking'
                    : enemy.runtime.state === 'recovery'
                      ? 'Recovering'
                      : enemy.runtime.state === 'stagger'
                        ? 'Staggered'
                        : enemy.runtime.state === 'return_home'
                          ? 'Breaking Off'
                          : 'Defeated';
    const distance = Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y));
    return {
      id: enemy.id,
      name: definition.name,
      typeLabel: definition.roleLabel,
      health: enemy.runtime.health,
      maxHealth: enemy.runtime.maxHealth,
      elite: Boolean(definition.elite),
      stateLabel,
      statusText: `${stateLabel} · ${distance}u`,
    };
  }

  private emitCombatUi(time: number): void {
    const state = this.bridge.getState();
    const target = this.getLockedEnemy();
    const snapshot: CombatUiSnapshot = {
      playerState: this.playerStatePreview as CombatUiSnapshot['playerState'],
      lockedTarget: target ? this.buildTargetHudState(target) : null,
      lockOnActive: Boolean(target),
      dodgeInvulnerable: isInvulnerable(this.playerAction, time),
      playerHealthPreview: Math.round(this.playerHealthPreview),
      playerVitaePreview: state.player.vitae,
      abilities: ([
        'light',
        'heavy',
        'blood_lance',
        'bite',
        'dodge',
      ] as const satisfies CombatActionId[]).map((actionId) => {
        const definition = PLAYER_ACTIONS_BY_ID[actionId];
        const readyAt = this.playerAction.cooldowns[actionId] ?? 0;
        let disabledReason: string | null = null;
        if (actionId === 'bite' && !this.nearbyHumanId) {
          disabledReason = 'No human in range';
        } else if (actionId === 'heavy' && state.player.vitae < definition.vitaeCost) {
          disabledReason = 'Needs Vitae';
        } else if (actionId === 'blood_lance' && state.player.vitae < definition.vitaeCost) {
          disabledReason = 'Needs Vitae';
        } else if (actionId === 'dodge' && readyAt > time) {
          disabledReason = 'Recovering';
        } else if (this.playerAction.actionId && this.playerAction.actionId !== actionId && this.playerAction.phaseEndsAt > time) {
          disabledReason = 'Locked in action';
        }
        return {
          id: actionId,
          label: definition.label,
          shortcut: definition.shortcut,
          iconId: definition.iconId,
          cooldownMs: definition.cooldownMs,
          cooldownRemainingMs: Math.max(0, Math.round(readyAt - time)),
          vitaeCost: definition.vitaeCost,
          active: this.playerAction.actionId === actionId || (actionId === 'bite' && this.biteSequence !== null),
          disabledReason,
        };
      }),
    };
    this.lastUiEmitAt = time;
    this.bridge.onCombatUiStateChanged(snapshot);
  }
}
