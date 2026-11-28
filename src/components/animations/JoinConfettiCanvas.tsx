import React, { useEffect, useRef } from 'react';
import { ThemeId } from '../../types/secretSanta';
import { THEME_CONFIGS } from '../themes/ThemeConfig';

interface JoinConfettiCanvasProps {
  active: boolean;
  theme: ThemeId;
  onComplete?: () => void;
}

type ConfettiShape = 'rect' | 'ribbon' | 'circle' | 'star';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: ConfettiShape;
  rotation: number;
  rotationSpeed: number;
  tilt: number;
  tiltSpeed: number;
  drag: number;
  gravity: number;
  opacity: number;
  age: number;
  maxAge: number;
}

function drawStar(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    const ox = Math.cos(outerAngle) * radius;
    const oy = Math.sin(outerAngle) * radius;
    const ix = Math.cos(innerAngle) * (radius * 0.45);
    const iy = Math.sin(innerAngle) * (radius * 0.45);
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Full-viewport high-DPI HTML5 Canvas confetti celebration triggered when
 * a participant completes joining on the "You're In!" screen.
 */
export const JoinConfettiCanvas: React.FC<JoinConfettiCanvasProps> = ({
  active,
  theme,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      onCompleteRef.current?.();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = THEME_CONFIGS[theme].confettiColors;
    const shapes: ConfettiShape[] = ['rect', 'ribbon', 'circle', 'star'];

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];

    const spawnBurst = (
      originX: number,
      originY: number,
      count: number,
      angleMinDeg: number,
      angleMaxDeg: number,
      speedMin: number,
      speedMax: number
    ) => {
      for (let i = 0; i < count; i++) {
        const angleRad =
          ((angleMinDeg + Math.random() * (angleMaxDeg - angleMinDeg)) * Math.PI) / 180;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        particles.push({
          x: originX + (Math.random() - 0.5) * 24,
          y: originY + (Math.random() - 0.5) * 18,
          vx: Math.cos(angleRad) * speed,
          vy: Math.sin(angleRad) * speed,
          size: 5 + Math.random() * 7,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.22,
          tilt: Math.random() * Math.PI * 2,
          tiltSpeed: 0.08 + Math.random() * 0.12,
          drag: 0.982 + Math.random() * 0.01,
          gravity: 0.22 + Math.random() * 0.14,
          opacity: 1,
          age: 0,
          maxAge: 145 + Math.floor(Math.random() * 70),
        });
      }
    };

    // Wave 1: Center festive shower
    spawnBurst(width * 0.5, height * 0.42, 75, -155, -25, 6, 15);

    // Wave 2: Dual left & right celebration cannons
    const wave2Timer = window.setTimeout(() => {
      spawnBurst(width * 0.08, height * 0.65, 55, -80, -32, 9, 17);
      spawnBurst(width * 0.92, height * 0.65, 55, -148, -100, 9, 17);
    }, 220);

    // Wave 3: Top gentle celebratory flutter
    const wave3Timer = window.setTimeout(() => {
      spawnBurst(width * 0.35, height * 0.2, 35, -140, -40, 4, 9);
      spawnBurst(width * 0.65, height * 0.2, 35, -140, -40, 4, 9);
    }, 520);

    let rafId = 0;
    let wavesRemaining = 2;
    const markWaveDone = () => {
      wavesRemaining = Math.max(0, wavesRemaining - 1);
    };
    const w2Done = window.setTimeout(markWaveDone, 240);
    const w3Done = window.setTimeout(markWaveDone, 540);

    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += 1;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        // Subtle horizontal flutter
        p.x += p.vx + Math.sin(p.tilt) * 0.85;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.tilt += p.tiltSpeed;

        const lifeRatio = p.age / p.maxAge;
        p.opacity = lifeRatio > 0.72 ? Math.max(0, 1 - (lifeRatio - 0.72) / 0.28) : 1;

        if (p.age >= p.maxAge || p.y > height + 40) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(1, Math.cos(p.tilt));
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        } else if (p.shape === 'ribbon') {
          ctx.fillRect(-p.size * 0.75, -p.size * 0.22, p.size * 1.5, p.size * 0.44);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, p.size * 0.62);
        }

        ctx.restore();
      }

      if (particles.length > 0 || wavesRemaining > 0) {
        rafId = requestAnimationFrame(renderFrame);
      } else {
        ctx.clearRect(0, 0, width, height);
        onCompleteRef.current?.();
      }
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      window.removeEventListener('resize', resize);
      window.clearTimeout(wave2Timer);
      window.clearTimeout(wave3Timer);
      window.clearTimeout(w2Done);
      window.clearTimeout(w3Done);
      cancelAnimationFrame(rafId);
    };
  }, [active, theme]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-40 w-full h-full pointer-events-none"
    />
  );
};
