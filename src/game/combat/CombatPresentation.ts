import Phaser from 'phaser';
import { DAMAGE_NUMBER_LIFETIME_MS, DEATH_FADE_MS, HIT_FLASH_MS, PLAYER_HURT_FLASH_MS } from '../../config/balancing';
import type { TelegraphShape } from './combatTypes';

export interface TargetIndicator {
  ring: Phaser.GameObjects.Graphics;
  marker: Phaser.GameObjects.Graphics;
  destroy(): void;
}

const drawSilhouette = (
  graphics: Phaser.GameObjects.Graphics,
  key: string,
  width: number,
  height: number,
  palette: { cloak: number; accent: number; skin: number; trim: number },
): void => {
  graphics.clear();
  graphics.fillStyle(0x000000, 0);
  graphics.fillRect(0, 0, width, height);
  graphics.fillStyle(palette.cloak, 1);
  graphics.fillTriangle(width * 0.2, height * 0.9, width * 0.5, height * 0.18, width * 0.8, height * 0.9);
  graphics.fillRoundedRect(width * 0.35, height * 0.28, width * 0.3, height * 0.36, 4);
  graphics.fillStyle(palette.skin, 1);
  graphics.fillCircle(width * 0.5, height * 0.18, width * 0.16);
  graphics.fillStyle(palette.accent, 1);
  graphics.fillTriangle(width * 0.5, height * 0.24, width * 0.39, height * 0.58, width * 0.61, height * 0.58);
  graphics.fillStyle(palette.trim, 1);
  graphics.fillRect(width * 0.66, height * 0.18, width * 0.08, height * 0.46);
  graphics.generateTexture(key, width, height);
};

export class CombatPresentation {
  static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('pixel-token')) {
      const graphics = scene.add.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(0, 0, 2, 2);
      graphics.generateTexture('pixel-token', 2, 2);
      drawSilhouette(graphics, 'player-token', 30, 34, { cloak: 0x1d2333, accent: 0xb91c3c, skin: 0xe8d7c8, trim: 0xced4da });
      drawSilhouette(graphics, 'human-token', 28, 32, { cloak: 0x7f5539, accent: 0xa7c957, skin: 0xcda27e, trim: 0xf2cc8f });
      drawSilhouette(graphics, 'bandit-token', 28, 32, { cloak: 0x343a40, accent: 0x9d0208, skin: 0xc68642, trim: 0x6c757d });
      drawSilhouette(graphics, 'clergy_hunter-token', 28, 34, { cloak: 0xc9cba3, accent: 0xf8e16c, skin: 0xdcc5b2, trim: 0x6c757d });
      drawSilhouette(graphics, 'elite_knight-token', 34, 38, { cloak: 0x495057, accent: 0xa68a64, skin: 0xbcb8b1, trim: 0xe9ecef });
      graphics.destroy();
    }
  }

  static createShadow(scene: Phaser.Scene, x: number, y: number, width: number, height: number): Phaser.GameObjects.Ellipse {
    return scene.add.ellipse(x, y + 11, width, height, 0x000000, 0.28).setDepth(1);
  }

  static createTargetIndicator(scene: Phaser.Scene): TargetIndicator {
    const ring = scene.add.graphics().setDepth(4);
    const marker = scene.add.graphics().setDepth(6);
    return {
      ring,
      marker,
      destroy: () => {
        ring.destroy();
        marker.destroy();
      },
    };
  }

  static updateTargetIndicator(indicator: TargetIndicator, x: number, y: number, radius: number, time: number, elite: boolean): void {
    indicator.ring.clear();
    indicator.ring.lineStyle(elite ? 3 : 2, elite ? 0xf8e16c : 0xb91c3c, 0.9);
    indicator.ring.strokeCircle(x, y + 14, radius + Math.sin(time / 120) * 2);
    indicator.ring.lineStyle(1, 0xf8f9fa, 0.7);
    indicator.ring.strokeCircle(x, y + 14, Math.max(6, radius - 4));
    indicator.marker.clear();
    indicator.marker.fillStyle(elite ? 0xf8e16c : 0xff758f, 1);
    indicator.marker.fillTriangle(x, y - radius - 18, x - 6, y - radius - 8, x + 6, y - radius - 8);
  }

  static clearTargetIndicator(indicator: TargetIndicator): void {
    indicator.ring.clear();
    indicator.marker.clear();
  }

  static showSlash(scene: Phaser.Scene, x: number, y: number, angle: number, radius: number, arcDeg: number, color: number, reducedMotion: boolean): void {
    const graphics = scene.add.graphics().setDepth(7);
    graphics.lineStyle(4, color, 0.92);
    const start = Phaser.Math.DegToRad(-arcDeg / 2);
    const end = Phaser.Math.DegToRad(arcDeg / 2);
    graphics.strokePoints(
      Array.from({ length: 14 }, (_, index) => {
        const progress = index / 13;
        const theta = Phaser.Math.Linear(start, end, progress);
        const pointRadius = radius + progress * 8;
        return new Phaser.Geom.Point(Math.cos(theta) * pointRadius, Math.sin(theta) * pointRadius);
      }),
      false,
      true,
    );
    graphics.setPosition(x, y);
    graphics.setRotation(angle);
    scene.tweens.add({
      targets: graphics,
      alpha: { from: 1, to: 0 },
      scale: reducedMotion ? { from: 1, to: 1.05 } : { from: 0.8, to: 1.18 },
      duration: reducedMotion ? 90 : 160,
      onComplete: () => graphics.destroy(),
    });
  }

  static showTelegraph(
    scene: Phaser.Scene,
    shape: TelegraphShape,
    x: number,
    y: number,
    angle: number,
    range: number,
    width: number,
    color: number,
    label: string,
  ): Phaser.GameObjects.Container {
    const graphics = scene.add.graphics().setDepth(3);
    const text = scene.add
      .text(x, y - range - 22, label, { color: '#f8f9fa', fontSize: '11px', backgroundColor: '#101820' })
      .setOrigin(0.5)
      .setDepth(4);
    if (shape === 'arc') {
      graphics.lineStyle(2, color, 0.85);
      graphics.fillStyle(color, 0.13);
      graphics.slice(0, 0, range, Phaser.Math.DegToRad(-width / 2), Phaser.Math.DegToRad(width / 2), false);
      graphics.fillPath();
      graphics.strokePath();
    } else if (shape === 'line') {
      graphics.fillStyle(color, 0.16);
      graphics.fillRect(0, -width / 2, range, width);
      graphics.lineStyle(2, color, 0.9);
      graphics.strokeRect(0, -width / 2, range, width);
    } else {
      graphics.lineStyle(2, color, 0.85);
      graphics.fillStyle(color, 0.13);
      graphics.fillCircle(0, 0, range);
      graphics.strokeCircle(0, 0, range);
    }
    const container = scene.add.container(x, y, [graphics, text]).setDepth(3);
    container.setRotation(angle);
    return container;
  }

  static showProjectile(scene: Phaser.Scene, x: number, y: number, color: number, radius: number): Phaser.GameObjects.Arc {
    return scene.add.circle(x, y, radius, color, 1).setDepth(6);
  }

  static spawnFloatingDamage(scene: Phaser.Scene, x: number, y: number, amount: number, color = '#f8f9fa'): void {
    const text = scene.add.text(x, y, `${amount}`, { color, fontSize: '15px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(8);
    scene.tweens.add({
      targets: text,
      y: y - 22,
      alpha: { from: 1, to: 0 },
      duration: DAMAGE_NUMBER_LIFETIME_MS,
      onComplete: () => text.destroy(),
    });
  }

  static spawnBloodBurst(scene: Phaser.Scene, x: number, y: number, color = 0xb91c3c): void {
    for (let index = 0; index < 5; index += 1) {
      const dot = scene.add.circle(x, y, Phaser.Math.Between(2, 4), color, 0.9).setDepth(7);
      const angle = Phaser.Math.DegToRad((360 / 5) * index + Phaser.Math.Between(-12, 12));
      scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * Phaser.Math.Between(10, 18),
        y: y + Math.sin(angle) * Phaser.Math.Between(10, 18),
        alpha: { from: 0.9, to: 0 },
        duration: 220,
        onComplete: () => dot.destroy(),
      });
    }
  }

  static flashSprite(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, color: number, player = false): void {
    const existingTimer = sprite.getData('flash-timer') as Phaser.Time.TimerEvent | undefined;
    existingTimer?.remove(false);
    sprite.setTint(color);
    const timer = scene.time.delayedCall(player ? PLAYER_HURT_FLASH_MS : HIT_FLASH_MS, () => {
      if (sprite.active) {
        sprite.clearTint();
      }
    });
    sprite.setData('flash-timer', timer);
  }

  static showAfterimage(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image): void {
    const ghost = scene.add.image(sprite.x, sprite.y, sprite.texture.key).setRotation(sprite.rotation).setAlpha(0.28).setScale(sprite.scaleX, sprite.scaleY).setDepth(2);
    ghost.setTint(0xb91c3c);
    scene.tweens.add({ targets: ghost, alpha: 0, duration: 160, onComplete: () => ghost.destroy() });
  }

  static fadeDeath(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image, shadow: Phaser.GameObjects.Ellipse | null): void {
    scene.tweens.add({
      targets: shadow ? [sprite, shadow] : [sprite],
      alpha: 0,
      duration: DEATH_FADE_MS,
      onComplete: () => {
        sprite.destroy();
        shadow?.destroy();
      },
    });
  }
}
