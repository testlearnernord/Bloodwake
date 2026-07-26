import Phaser from 'phaser';
import { BITE_RANGE, TURN_COST_VITAE } from '../../config/balancing';
import { COFFIN_RESPAWN, WORLD_BOUNDS } from '../../config/game';
import { ENEMIES } from '../../data/enemies';
import { applyIncomingDamage } from '../../simulation/combat/stats';
import { canPlayerExplore } from '../../simulation/time/dayNight';
import type { EnemyType, HumanCharacter, ItemId } from '../../types/models';
import type { GameBridge } from '../bridge';

interface SceneEnemy {
  sprite: Phaser.Physics.Arcade.Sprite;
  type: EnemyType;
  health: number;
  homeX: number;
  homeY: number;
}

interface SceneHuman {
  sprite: Phaser.Physics.Arcade.Sprite;
  human: HumanCharacter;
}

interface SceneResourceNode {
  id: string;
  itemId: ItemId;
  amount: number;
  sprite: Phaser.GameObjects.Rectangle;
}

export class WorldScene extends Phaser.Scene {
  private readonly bridge: GameBridge;
  private player!: Phaser.Physics.Arcade.Sprite;
  private humans: SceneHuman[] = [];
  private enemies: SceneEnemy[] = [];
  private resources: SceneResourceNode[] = [];
  private memoryFragment: Phaser.GameObjects.Rectangle | null = null;
  private nearbyHumanId: string | null = null;
  private cursors!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private dodgeKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private biteKey!: Phaser.Input.Keyboard.Key;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private lastAttackAt = 0;
  private lastHeavyAttackAt = 0;
  private lastDodgeAt = 0;
  private activeZone = 'Ruined Stronghold';
  private hintText!: Phaser.GameObjects.Text;

  constructor(bridge: GameBridge) {
    super('world');
    this.bridge = bridge;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0c1014');
    this.physics.world.setBounds(0, 0, WORLD_BOUNDS.width, WORLD_BOUNDS.height);
    this.createPlaceholderTextures();
    this.createWorldGeometry();
    this.createPlayer();
    this.createHumans();
    this.createEnemies();
    this.createResources();
    this.createMemoryFragment();
    this.createUiHints();
    this.configureInput();
  }

  update(time: number): void {
    const state = this.bridge.getState();
    this.syncHumansWithState();
    this.syncMemoryWithState();
    if (!this.bridge.isInputBlocked()) {
      this.updateMovement();
      this.updateNearbyHuman();
      this.updateZone();
      this.updateEnemyAi(time);
      this.handleActionKeys(time);
    } else {
      this.player.setVelocity(0, 0);
      this.bridge.onHumanFocused(null);
    }
    if (!canPlayerExplore(state.time.phase)) {
      this.player.setPosition(COFFIN_RESPAWN.x, COFFIN_RESPAWN.y);
      this.player.setVelocity(0, 0);
      this.hintText.setText('Daylight: retreat to the keep while servants work.');
    }
  }

  private createPlaceholderTextures(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xc13535);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture('player-token', 16, 16);
    graphics.clear();
    graphics.fillStyle(0xb9a06a);
    graphics.fillRect(0, 0, 14, 14);
    graphics.generateTexture('human-token', 14, 14);
    graphics.clear();
    graphics.fillStyle(0x495057);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture('bandit-token', 16, 16);
    graphics.clear();
    graphics.fillStyle(0x6c757d);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture('clergy_hunter-token', 16, 16);
    graphics.clear();
    graphics.fillStyle(0x9d4edd);
    graphics.fillRect(0, 0, 20, 20);
    graphics.generateTexture('elite_knight-token', 20, 20);
    graphics.destroy();
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
    this.player = this.physics.add.sprite(COFFIN_RESPAWN.x, COFFIN_RESPAWN.y, 'player-token');
    this.player.setCollideWorldBounds(true);
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
        const sprite = this.physics.add.sprite(position.x, position.y, 'human-token');
        return { sprite, human };
      });
  }

  private createEnemies(): void {
    const spawns: Array<{ type: EnemyType; x: number; y: number }> = [
      { type: 'bandit', x: 520, y: 270 },
      { type: 'clergy_hunter', x: 730, y: 470 },
      { type: 'elite_knight', x: 1160, y: 410 },
    ];
    this.enemies = spawns.map((spawn) => {
      const texture = `${spawn.type}-token`;
      const definition = ENEMIES.find((enemy) => enemy.id === spawn.type);
      if (!definition) {
        throw new Error(`Missing enemy definition for ${spawn.type}.`);
      }
      const sprite = this.physics.add.sprite(spawn.x, spawn.y, texture);
      sprite.setCollideWorldBounds(true);
      return { sprite, type: spawn.type, health: definition.health, homeX: spawn.x, homeY: spawn.y };
    });
  }

  private createResources(): void {
    this.resources = [
      { id: 'wood-node', itemId: 'wood', amount: 3, sprite: this.add.rectangle(430, 340, 20, 20, 0x2d6a4f) },
      { id: 'herb-node', itemId: 'herbs', amount: 2, sprite: this.add.rectangle(740, 250, 18, 18, 0x74c69d) },
      { id: 'ore-node', itemId: 'iron_ore', amount: 2, sprite: this.add.rectangle(840, 520, 20, 20, 0x6c757d) },
      { id: 'stone-node', itemId: 'stone', amount: 2, sprite: this.add.rectangle(300, 280, 18, 18, 0x868e96) },
      { id: 'food-node', itemId: 'food', amount: 2, sprite: this.add.rectangle(980, 180, 18, 18, 0xe9c46a) },
    ];
  }

  private createMemoryFragment(): void {
    const collected = this.bridge.getState().collectibles.find((entry) => entry.collectibleId === 'memory_fragment_1')?.discovered;
    if (!collected) {
      this.memoryFragment = this.add.rectangle(600, 180, 18, 18, 0xe9c46a);
    }
  }

  private createUiHints(): void {
    this.hintText = this.add
      .text(24, 680, 'WASD move, LMB attack, RMB heavy attack, Space dodge, E interact, F feed.', {
        color: '#f8f9fa',
        fontSize: '16px',
      })
      .setScrollFactor(0);
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
    this.pauseKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.bridge.isInputBlocked()) return;
      if (pointer.rightButtonDown()) {
        this.performHeavyAttack(this.time.now);
      } else {
        this.performPrimaryAttack(this.time.now);
      }
    });
  }

  private updateMovement(): void {
    const speed = 150;
    const velocity = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown) velocity.x -= 1;
    if (this.cursors.right.isDown) velocity.x += 1;
    if (this.cursors.up.isDown) velocity.y -= 1;
    if (this.cursors.down.isDown) velocity.y += 1;
    velocity.normalize().scale(speed);
    this.player.setVelocity(velocity.x, velocity.y);
    const pointer = this.input.activePointer;
    this.player.rotation = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
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
  }

  private updateZone(): void {
    const zone = this.player.x < 320 ? 'Ruined Stronghold' : this.player.x < 920 ? 'Forest Road' : 'Village Edge';
    if (zone !== this.activeZone) {
      this.activeZone = zone;
      this.bridge.onZoneChanged(zone);
    }
  }

  private updateEnemyAi(time: number): void {
    const state = this.bridge.getState();
    const combat = this.bridge.getCombatStats();
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue;
      const definition = ENEMIES.find((entry) => entry.id === enemy.type);
      if (!definition) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y);
      if (state.time.phase === 'night' && distance < 170) {
        this.physics.moveToObject(enemy.sprite, this.player, definition.speed);
        if (distance < 28 && time - Number(enemy.sprite.getData('lastHit') ?? 0) > 1000) {
          enemy.sprite.setData('lastHit', time);
          const reduced = applyIncomingDamage(definition.damage, combat.armor);
          const health = Math.max(0, state.player.health - reduced);
          this.bridge.onPlayerVitalsChanged(health, state.player.vitae);
          if (health <= 0) {
            this.bridge.onRespawn();
            this.player.setPosition(COFFIN_RESPAWN.x, COFFIN_RESPAWN.y);
          }
        }
      } else {
        this.physics.moveTo(enemy.sprite, enemy.homeX, enemy.homeY, definition.speed * 0.7);
        if (distance < 8) {
          enemy.sprite.setVelocity(0, 0);
        }
      }
    }
  }

  private handleActionKeys(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.dodgeKey) && time - this.lastDodgeAt > 1200) {
      this.lastDodgeAt = time;
      this.bridge.onDodgeUsed(Date.now() + 1200);
      const body = this.player.body as Phaser.Physics.Arcade.Body | null;
      const dash = new Phaser.Math.Vector2(body?.velocity.x ?? 0, body?.velocity.y ?? 0).normalize();
      if (dash.length() === 0) {
        dash.setToPolar(this.player.rotation, 1);
      }
      this.player.setVelocity(dash.x * 260, dash.y * 260);
    }
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.interactNearbyObject();
    }
    if (Phaser.Input.Keyboard.JustDown(this.biteKey) && this.nearbyHumanId) {
      this.bridge.onFeedShortcut(this.nearbyHumanId);
    }
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey) || Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      this.bridge.onPauseRequested();
    }
  }

  private performPrimaryAttack(time: number): void {
    if (time - this.lastAttackAt < 450) return;
    this.lastAttackAt = time;
    const combat = this.bridge.getCombatStats();
    this.damageEnemiesInFront(combat.attackDamage, 54);
  }

  private performHeavyAttack(time: number): void {
    const state = this.bridge.getState();
    if (time - this.lastHeavyAttackAt < 900 || state.player.vitae < 1) return;
    this.lastHeavyAttackAt = time;
    this.bridge.onPlayerVitalsChanged(state.player.health, state.player.vitae - 1);
    const combat = this.bridge.getCombatStats();
    this.damageEnemiesInFront(combat.attackDamage + 3, 70);
  }

  private damageEnemiesInFront(damage: number, range: number): void {
    const pointer = this.input.activePointer;
    const facing = new Phaser.Math.Vector2(pointer.worldX - this.player.x, pointer.worldY - this.player.y).normalize();
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue;
      const toEnemy = new Phaser.Math.Vector2(enemy.sprite.x - this.player.x, enemy.sprite.y - this.player.y);
      if (toEnemy.length() <= range && toEnemy.normalize().dot(facing) > 0.2) {
        enemy.health -= damage;
        enemy.sprite.setTint(0xff6b6b);
        this.time.delayedCall(120, () => enemy.sprite.clearTint());
        if (enemy.health <= 0) {
          enemy.sprite.destroy();
          this.bridge.onEnemyDefeated(enemy.type);
        }
      }
    }
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
      const state = this.bridge.getState();
      if (state.player.vitae >= TURN_COST_VITAE) {
        this.hintText.setText('Human is within reach. Open context actions to feed, drain, or turn.');
      }
    }
  }

  private syncHumansWithState(): void {
    const activeIds = new Set(
      this.bridge
        .getState()
        .npcs.filter((human) => human.status !== 'drained' && human.status !== 'turned')
        .map((human) => human.id),
    );
    this.humans = this.humans.filter((entry) => {
      const keep = activeIds.has(entry.human.id);
      if (!keep) entry.sprite.destroy();
      return keep;
    });
    if (this.nearbyHumanId && !activeIds.has(this.nearbyHumanId)) {
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
}
