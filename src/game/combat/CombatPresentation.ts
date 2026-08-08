import Phaser from 'phaser';
import { DAMAGE_NUMBER_LIFETIME_MS, DEATH_FADE_MS, HIT_FLASH_MS, PLAYER_HURT_FLASH_MS } from '../../config/balancing';
import type { TelegraphShape } from './combatTypes';

export interface TargetIndicator {
  ring: Phaser.GameObjects.Graphics;
  marker: Phaser.GameObjects.Graphics;
  destroy(): void;
}

export interface CombatFeedPrompt {
  container: Phaser.GameObjects.Container;
  keyBadge: Phaser.GameObjects.Text;
  instruction: Phaser.GameObjects.Text;
  stepText: Phaser.GameObjects.Text;
  progressFill: Phaser.GameObjects.Rectangle;
  destroy(): void;
}

export interface CombatFeedPromptState {
  phase: 'pounce' | 'first_window' | 'second_window';
  windowOpen: boolean;
  progress: number;
  successfulInputs: number;
  elite: boolean;
  now: number;
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
  private static combatAudioContext: AudioContext | null = null;

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

  static createCombatFeedPrompt(scene: Phaser.Scene): CombatFeedPrompt {
    const panel = scene.add.rectangle(0, 0, 370, 150, 0x07090d, 0.94).setStrokeStyle(2, 0xb91c3c, 0.95);
    const title = scene.add.text(0, -55, 'PREDATORY BITE', { color: '#ffd7df', fontSize: '18px', fontStyle: 'bold' }).setOrigin(0.5);
    const keyBadge = scene.add.text(0, -8, 'F', {
      color: '#ffffff',
      fontSize: '30px',
      fontStyle: 'bold',
      backgroundColor: '#7f1029',
      padding: { x: 15, y: 6 },
    }).setOrigin(0.5);
    const instruction = scene.add.text(0, 30, 'CLOSING IN…', { color: '#f8f9fa', fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5);
    const progressBack = scene.add.rectangle(0, 57, 280, 10, 0x343a40, 1);
    const progressFill = scene.add.rectangle(-140, 57, 280, 10, 0xb91c3c, 1).setOrigin(0, 0.5);
    const stepText = scene.add.text(0, 74, 'READY', { color: '#adb5bd', fontSize: '11px' }).setOrigin(0.5);
    const container = scene.add.container(640, 205, [panel, title, keyBadge, instruction, progressBack, progressFill, stepText])
      .setDepth(50)
      .setScrollFactor(0)
      .setVisible(false);
    return {
      container,
      keyBadge,
      instruction,
      stepText,
      progressFill,
      destroy: () => container.destroy(true),
    };
  }

  static hideCombatFeedPrompt(prompt: CombatFeedPrompt | null): void {
    prompt?.container.setVisible(false);
  }

  static updateCombatFeedPrompt(prompt: CombatFeedPrompt, state: CombatFeedPromptState): void {
    prompt.container.setVisible(true);
    const accent = state.elite ? '#f8e16c' : '#ff758f';
    const fillColor = state.elite ? 0xf8e16c : 0xb91c3c;
    prompt.progressFill.setFillStyle(fillColor, 1);
    if (state.phase === 'pounce') {
      prompt.keyBadge.setAlpha(0.35).setScale(0.9);
      prompt.instruction.setText('LEAPING TO THE TARGET…').setColor('#f8f9fa');
      prompt.stepText.setText(state.elite ? 'ELITE GRAPPLE' : 'CLOSE THE DISTANCE').setColor(accent);
      prompt.progressFill.setDisplaySize(0, 10);
      return;
    }
    const step = state.successfulInputs + 1;
    if (!state.windowOpen) {
      prompt.keyBadge.setAlpha(0.45).setScale(0.9);
      prompt.instruction.setText(step === 2 ? 'HOLD… WAIT FOR THE SECOND OPENING' : 'WAIT FOR THE OPENING').setColor('#ced4da');
      prompt.stepText.setText(`${Math.min(step, 2)}/2`).setColor(accent);
      prompt.progressFill.setDisplaySize(0, 10);
      return;
    }
    const pulse = 1 + Math.sin(state.now / 55) * 0.08;
    prompt.keyBadge.setAlpha(1).setScale(pulse);
    prompt.instruction.setText('BITE NOW').setColor('#ffffff');
    prompt.stepText.setText(`${Math.min(step, 2)}/2 · HIT F`).setColor(accent);
    prompt.progressFill.setDisplaySize(Math.max(2, 280 * (1 - state.progress)), 10);
  }

  static showCombatFeedResult(scene: Phaser.Scene, success: boolean, text: string): void {
    const result = scene.add.text(640, 205, text, {
      color: success ? '#ffd7df' : '#ffffff',
      fontSize: '24px',
      fontStyle: 'bold',
      backgroundColor: success ? '#551021' : '#2b1114',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setDepth(60).setScrollFactor(0).setScale(0.82);
    scene.tweens.add({
      targets: result,
      scale: 1,
      alpha: { from: 1, to: 0 },
      y: 185,
      duration: 520,
      ease: 'Quad.easeOut',
      onComplete: () => result.destroy(),
    });
  }

  static showPredatoryPounce(scene: Phaser.Scene, startX: number, startY: number, endX: number, endY: number, reducedMotion: boolean): void {
    const streak = scene.add.graphics().setDepth(6);
    streak.lineStyle(reducedMotion ? 3 : 7, 0xb91c3c, 0.72);
    streak.lineBetween(startX, startY, endX, endY);
    const impactRing = scene.add.circle(endX, endY, 17, 0x000000, 0).setStrokeStyle(3, 0xff758f, 0.9).setDepth(6);
    scene.tweens.add({ targets: streak, alpha: 0, duration: reducedMotion ? 90 : 190, onComplete: () => streak.destroy() });
    scene.tweens.add({
      targets: impactRing,
      scale: reducedMotion ? 1.15 : 1.85,
      alpha: 0,
      duration: reducedMotion ? 100 : 240,
      onComplete: () => impactRing.destroy(),
    });
    scene.cameras.main.shake(reducedMotion ? 35 : 75, 0.0018, false);
  }

  static showBloodSiphon(scene: Phaser.Scene, fromX: number, fromY: number, toX: number, toY: number, amount = 4): void {
    for (let index = 0; index < amount; index += 1) {
      const orb = scene.add.circle(fromX, fromY, 3 + (index % 2), 0xc1123f, 0.95).setDepth(9);
      scene.tweens.add({
        targets: orb,
        x: toX,
        y: toY,
        alpha: { from: 0.95, to: 0.15 },
        scale: { from: 1, to: 0.55 },
        delay: index * 38,
        duration: 180 + index * 24,
        ease: 'Sine.easeIn',
        onComplete: () => orb.destroy(),
      });
    }
  }

  static playCombatFeedSound(cue: 'pounce' | 'window' | 'success' | 'failure'): void {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;
    const context = CombatPresentation.combatAudioContext ?? new window.AudioContext();
    CombatPresentation.combatAudioContext = context;
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const profile = cue === 'pounce'
      ? { type: 'sawtooth' as OscillatorType, from: 180, to: 72, volume: 0.045, duration: 0.16 }
      : cue === 'window'
        ? { type: 'sine' as OscillatorType, from: 540, to: 760, volume: 0.055, duration: 0.085 }
        : cue === 'success'
          ? { type: 'sawtooth' as OscillatorType, from: 150, to: 48, volume: 0.065, duration: 0.23 }
          : { type: 'square' as OscillatorType, from: 125, to: 62, volume: 0.045, duration: 0.13 };
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.from, now);
    oscillator.frequency.exponentialRampToValueAtTime(profile.to, now + profile.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(profile.volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + profile.duration + 0.02);
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
    const pulse = 1 + ((Math.sin(time / 110) + 1) * 0.5 - 0.5) * 0.18;
    indicator.ring.clear();
    indicator.ring.lineStyle(elite ? 4 : 3, elite ? 0xf8e16c : 0xb91c3c, 0.95);
    indicator.ring.strokeCircle(x, y + 14, radius * pulse);
    indicator.ring.lineStyle(2, 0xf8f9fa, 0.8);
    indicator.ring.strokeCircle(x, y + 14, Math.max(6, radius - 5));
    indicator.marker.clear();
    indicator.marker.fillStyle(elite ? 0xf8e16c : 0xff758f, 1);
    indicator.marker.fillTriangle(x, y - radius - 24, x - 8, y - radius - 10, x + 8, y - radius - 10);
    indicator.marker.lineStyle(2, 0xf8f9fa, 0.9);
    indicator.marker.strokeTriangle(x, y - radius - 24, x - 8, y - radius - 10, x + 8, y - radius - 10);
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
