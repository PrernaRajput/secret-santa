import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Clock, X } from 'lucide-react';
import { AvatarGraphic } from '../avatars/AvatarGraphic';
import { playGoldenSecretFanfare, playPopSound } from '../../utils/sound';

interface GoldenWorldOverlayProps {
  active: boolean;
  participantName: string;
  participantAvatarId: string;
  durationMs?: number;
  onDismiss: () => void;
}

interface GoldFlake {
  x: number;
  y: number;
  r: number;
  speedY: number;
  driftX: number;
  phase: number;
  opacity: number;
  sparkle: boolean;
}

const FourPointStar: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M12 1.5L14.35 9.65L22.5 12L14.35 14.35L12 22.5L9.65 14.35L1.5 12L9.65 9.65L12 1.5Z" />
  </svg>
);

const LaurelSprig: React.FC<{ flip?: boolean; className?: string }> = ({
  flip = false,
  className = 'w-6 h-12',
}) => (
  <svg
    viewBox="0 0 36 72"
    fill="none"
    aria-hidden="true"
    className={`${className} ${flip ? '-scale-x-100' : ''}`}
  >
    <path
      d="M28 66C15 52 12 31 19 8"
      stroke="#f5c85c"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M17 14C10 13 6 9 6 5C11 6 15 9 17 14Z"
      fill="#fbd975"
    />
    <path
      d="M16 26C8 24 4 19 4 14C10 15 14 20 16 26Z"
      fill="#f5c24c"
    />
    <path
      d="M17 39C9 37 5 32 5 26C11 28 15 33 17 39Z"
      fill="#f2b93c"
    />
    <path
      d="M21 52C13 51 9 46 9 41C15 42 19 46 21 52Z"
      fill="#e8a728"
    />
    <path
      d="M19 20C25 18 29 14 30 9C24 10 20 14 19 20Z"
      fill="#fde391"
    />
    <path
      d="M18 33C24 31 28 27 29 22C23 23 19 27 18 33Z"
      fill="#f7ca5a"
    />
    <path
      d="M20 46C26 44 30 40 31 35C25 36 21 40 20 46Z"
      fill="#efb335"
    />
  </svg>
);

const PlaqueLaurel: React.FC<{ flip?: boolean; className?: string }> = ({
  flip = false,
  className = 'w-12 h-10',
}) => (
  <svg
    viewBox="0 0 64 52"
    fill="none"
    aria-hidden="true"
    className={`${className} ${flip ? '-scale-x-100' : ''}`}
  >
    <path
      d="M54 44C34 42 19 28 12 8"
      stroke="#d48b1c"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <path d="M15 15C8 14 4 9 4 4C10 5 14 9 15 15Z" fill="#f7c443" />
    <path d="M21 25C13 24 8 19 7 13C14 14 19 19 21 25Z" fill="#eea927" />
    <path d="M30 34C22 34 16 30 14 24C21 24 27 28 30 34Z" fill="#e59819" />
    <path d="M41 41C33 43 27 40 24 35C31 34 37 36 41 41Z" fill="#d98714" />
    <path d="M18 19C24 15 27 10 27 4C21 7 18 12 18 19Z" fill="#fbd76a" />
    <path d="M26 29C32 25 35 20 35 14C29 17 26 22 26 29Z" fill="#f3b834" />
    <path d="M36 37C42 33 45 28 45 22C39 25 36 30 36 37Z" fill="#e69e1e" />
  </svg>
);

const GoldenCrownIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-5' }) => (
  <svg viewBox="0 0 36 28" fill="none" aria-hidden="true" className={className}>
    <defs>
      <linearGradient id="gw-mini-crown" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff4ad" />
        <stop offset="50%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#c97a06" />
      </linearGradient>
    </defs>
    <path
      d="M5 21L2.5 8.5L11.5 14L18 4.5L24.5 14L33.5 8.5L31 21H5Z"
      fill="url(#gw-mini-crown)"
      stroke="#522408"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <rect
      x="5"
      y="21"
      width="26"
      height="4"
      rx="1.5"
      fill="#eab308"
      stroke="#522408"
      strokeWidth="1.4"
    />
    <circle cx="18" cy="4.2" r="2.2" fill="#fef08a" stroke="#522408" strokeWidth="1.2" />
    <circle cx="2.5" cy="8.2" r="1.8" fill="#fef08a" stroke="#522408" strokeWidth="1.1" />
    <circle cx="33.5" cy="8.2" r="1.8" fill="#fef08a" stroke="#522408" strokeWidth="1.1" />
  </svg>
);

const MagicWandIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
    <path
      d="M5 23L14.5 13.5"
      stroke="#2a1104"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <path
      d="M17.5 4.2L19.4 8.7L24.2 9.1L20.5 12.2L21.7 16.9L17.5 14.3L13.3 16.9L14.5 12.2L10.8 9.1L15.6 8.7L17.5 4.2Z"
      fill="#fef08a"
      stroke="#2a1104"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="9" r="1.2" fill="#2a1104" />
    <circle cx="11" cy="5.5" r="0.9" fill="#2a1104" />
    <circle cx="22.5" cy="19.5" r="1" fill="#2a1104" />
  </svg>
);

const TopBowCrest: React.FC = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute -top-[28px] sm:-top-[32px] inset-x-0 z-20 flex items-start justify-center"
  >
    <svg viewBox="0 0 560 74" fill="none" className="w-full h-[64px] sm:h-[74px] overflow-visible">
      <defs>
        <linearGradient id="gw-snow-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffdf9" />
          <stop offset="70%" stopColor="#f8e8d6" />
          <stop offset="100%" stopColor="#e5c7a7" />
        </linearGradient>
        <linearGradient id="gw-bow-red" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d92d20" />
          <stop offset="52%" stopColor="#9f1212" />
          <stop offset="100%" stopColor="#690808" />
        </linearGradient>
        <linearGradient id="gw-gold-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6be" />
          <stop offset="50%" stopColor="#f6c343" />
          <stop offset="100%" stopColor="#b96d08" />
        </linearGradient>
      </defs>

      {/* Left snowdrift shoulder */}
      <path
        d="M8 54C10 34 26 24 54 24C74 24 85 33 108 32C132 31 146 18 182 18C208 18 228 24 244 30C224 38 192 38 164 36C128 34 94 42 58 46C34 49 18 55 8 54Z"
        fill="url(#gw-snow-cap)"
        stroke="#f5d07a"
        strokeWidth="1.5"
      />

      {/* Right snowdrift shoulder */}
      <path
        d="M552 54C550 34 534 24 506 24C486 24 475 33 452 32C428 31 414 18 378 18C352 18 332 24 316 30C336 38 368 38 396 36C432 34 466 42 502 46C526 49 542 55 552 54Z"
        fill="url(#gw-snow-cap)"
        stroke="#f5d07a"
        strokeWidth="1.5"
      />

      {/* Crimson holiday ribbon tails */}
      <path
        d="M262 34L228 62L244 59L252 68L276 42Z"
        fill="url(#gw-bow-red)"
        stroke="#f5cb66"
        strokeWidth="1"
      />
      <path
        d="M298 34L332 62L316 59L308 68L284 42Z"
        fill="url(#gw-bow-red)"
        stroke="#f5cb66"
        strokeWidth="1"
      />

      {/* Crimson ribbon bow loops */}
      <path
        d="M266 26C254 8 225 4 218 19C212 31 232 45 264 36Z"
        fill="url(#gw-bow-red)"
        stroke="#f8d275"
        strokeWidth="1.3"
      />
      <path
        d="M294 26C306 8 335 4 342 19C348 31 328 45 296 36Z"
        fill="url(#gw-bow-red)"
        stroke="#f8d275"
        strokeWidth="1.3"
      />
      {/* Subtle bow fold sheen */}
      <path d="M230 22C240 20 251 24 259 29" stroke="#ff9a8b" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      <path d="M330 22C320 20 309 24 301 29" stroke="#ff9a8b" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />

      {/* Center golden crown medallion */}
      <circle
        cx="280"
        cy="30"
        r="21"
        fill="#3a1905"
        stroke="url(#gw-gold-rim)"
        strokeWidth="3.5"
      />
      <circle cx="280" cy="30" r="16.5" fill="#5c2808" stroke="#fde68a" strokeOpacity="0.6" strokeWidth="1" />
      <path
        d="M269.5 36L267.5 25L274 29.5L280 21.5L286 29.5L292.5 25L290.5 36H269.5Z"
        fill="url(#gw-gold-rim)"
      />
      <rect x="270" y="36.5" width="20" height="2.6" rx="1.2" fill="#fde68a" />
    </svg>
  </div>
);

const BottomCandyTrim: React.FC = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute -bottom-[15px] inset-x-3 sm:inset-x-5 z-20 flex justify-center"
  >
    <svg viewBox="0 0 520 36" fill="none" className="w-full h-[30px] sm:h-[34px] overflow-visible">
      <defs>
        <pattern
          id="gw-candy-stripe"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <rect width="24" height="24" fill="#b91c1c" />
          <rect width="9" height="24" fill="#fef3c7" />
        </pattern>
        <linearGradient id="gw-finial-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff9cc" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Wavy candy-cane ribbon border */}
      <path
        d="M8 10C48 2 76 22 118 14C158 6 196 22 232 14C246 11 253 16 260 28C267 16 274 11 288 14C324 22 362 6 402 14C444 22 472 2 512 10"
        stroke="url(#gw-candy-stripe)"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 10C48 2 76 22 118 14C158 6 196 22 232 14C246 11 253 16 260 28C267 16 274 11 288 14C324 22 362 6 402 14C444 22 472 2 512 10"
        stroke="#fde68a"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom center golden diamond star finial */}
      <path
        d="M260 4L263.5 14.5L274 18L263.5 21.5L260 32L256.5 21.5L246 18L256.5 14.5L260 4Z"
        fill="url(#gw-finial-gold)"
        stroke="#5c2808"
        strokeWidth="1"
      />
    </svg>
  </div>
);

/**
 * Full-viewport Hidden Golden Christmas World transformation for The 1% Santa Secret.
 * Briefly transforms the entire website into a storybook golden winter realm,
 * reveals Santa's compromised message, and crowns the participant's avatar with
 * the permanent Golden Detective Crown.
 */
export const GoldenWorldOverlay: React.FC<GoldenWorldOverlayProps> = ({
  active,
  participantName,
  participantAvatarId,
  durationMs = 10500,
  onDismiss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationMs / 1000));

  // Auto-dissolve timer & audio/confetti burst on activation
  useEffect(() => {
    if (!active) return;

    playGoldenSecretFanfare();
    setSecondsLeft(Math.ceil(durationMs / 1000));

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion) {
      const goldPalette = ['#fef08a', '#facc15', '#f59e0b', '#d97706', '#ffffff'];
      confetti({
        particleCount: 85,
        spread: 85,
        origin: { y: 0.45 },
        colors: goldPalette,
      });
      const secondWave = window.setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 60,
          spread: 60,
          origin: { x: 0.1, y: 0.6 },
          colors: goldPalette,
        });
        confetti({
          particleCount: 55,
          angle: 120,
          spread: 60,
          origin: { x: 0.9, y: 0.6 },
          colors: goldPalette,
        });
      }, 420);

      const startedAt = Date.now();
      const tick = window.setInterval(() => {
        const remaining = Math.max(0, durationMs - (Date.now() - startedAt));
        setSecondsLeft(Math.ceil(remaining / 1000));
      }, 250);

      const finishTimer = window.setTimeout(() => {
        onDismiss();
      }, durationMs);

      return () => {
        window.clearTimeout(secondWave);
        window.clearInterval(tick);
        window.clearTimeout(finishTimer);
      };
    }

    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const remaining = Math.max(0, durationMs - (Date.now() - startedAt));
      setSecondsLeft(Math.ceil(remaining / 1000));
    }, 250);
    const finishTimer = window.setTimeout(() => {
      onDismiss();
    }, durationMs);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(finishTimer);
    };
  }, [active, durationMs, onDismiss]);

  // Escape key to dismiss cleanly
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onDismiss]);

  // 24K Golden Christmas snowfall & starlight canvas
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(115, Math.max(55, Math.floor(width / 13)));
    const flakes: GoldFlake[] = Array.from({ length: count }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1.4 + Math.random() * 3.2,
      speedY: 0.45 + Math.random() * 1.1,
      driftX: (Math.random() - 0.5) * 0.5,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.35 + Math.random() * 0.65,
      sparkle: idx % 4 === 0,
    }));

    let frame = 0;
    const render = () => {
      frame += 0.025;
      ctx.clearRect(0, 0, width, height);

      for (const f of flakes) {
        if (!reducedMotion) {
          f.y += f.speedY;
          f.x += f.driftX + Math.sin(frame + f.phase) * 0.38;
          if (f.y > height + 12) {
            f.y = -12;
            f.x = Math.random() * width;
          }
          if (f.x < -12) f.x = width + 12;
          if (f.x > width + 12) f.x = -12;
        }

        const twinkle = 0.65 + 0.35 * Math.sin(frame * 2.2 + f.phase);
        ctx.save();
        ctx.globalAlpha = f.opacity * twinkle;

        if (f.sparkle) {
          ctx.translate(f.x, f.y);
          ctx.fillStyle = '#fff9d6';
          const s = f.r * 2.15;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.24, -s * 0.24);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.24, s * 0.24);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.24, s * 0.24);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.24, -s * 0.24);
          ctx.closePath();
          ctx.fill();
        } else {
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 2.2);
          grad.addColorStop(0, '#fef9c3');
          grad.addColorStop(0.55, '#facc15');
          grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="golden-world-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="The 1% Santa Secret — Hidden Golden Christmas World"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center px-3 py-8 sm:p-6 overflow-y-auto"
        >
          {/* Rich Warm Golden Night Sky Base */}
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,#7c470b_0%,#331906_45%,#140902_100%)]"
          />

          {/* Top Celestial Golden Sunbeams */}
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none bg-[conic-gradient(from_180deg_at_50%_-8%,rgba(255,235,150,0.34)_0deg,transparent_22deg,rgba(251,191,36,0.28)_52deg,transparent_80deg,rgba(254,240,138,0.22)_115deg,transparent_245deg,rgba(251,191,36,0.26)_295deg,transparent_330deg,rgba(255,235,150,0.34)_360deg)]"
          />

          {/* Left Illustrated Golden Christmas Village, Signpost & Gifts Wing */}
          <div
            aria-hidden="true"
            className="fixed inset-y-0 left-0 w-[min(26vh,36vw)] pointer-events-none bg-[url('/assets/aistudio/image_212cc854.png')] bg-no-repeat bg-left bg-[length:auto_100%] [mask-image:linear-gradient(to_right,black_0%,black_78%,transparent_100%)]"
          />

          {/* Right Illustrated Golden Castle, Lantern Tree, Reindeer & Gifts Wing */}
          <div
            aria-hidden="true"
            className="fixed inset-y-0 right-0 w-[min(26vh,36vw)] pointer-events-none bg-[url('/assets/aistudio/image_212cc854.png')] bg-no-repeat bg-right bg-[length:auto_100%] [mask-image:linear-gradient(to_left,black_0%,black_78%,transparent_100%)]"
          />

          {/* Luminous Golden Snowdrift Floor Glow */}
          <div
            aria-hidden="true"
            className="fixed inset-x-0 bottom-0 h-24 sm:h-32 pointer-events-none bg-[radial-gradient(ellipse_80%_90%_at_50%_100%,rgba(255,224,148,0.55)_0%,rgba(217,119,6,0.2)_55%,transparent_100%)]"
          />

          {/* Subtle Center Vignette for Crisp Storybook Readability on Narrow Screens */}
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_55%_68%_at_50%_50%,rgba(22,10,3,0.72)_0%,rgba(22,10,3,0.35)_60%,transparent_100%)]"
          />

          {/* Animated 24K Gold Snowfall & Starlight Canvas */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none"
          />

          {/* Ornate Mahogany & Molten-Gold Storybook Frame */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -12 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 my-auto w-full max-w-[560px]"
          >
            {/* Top Snowdrift Shoulders, Crimson Bow & Crown Medallion */}
            <TopBowCrest />

            {/* Main Dark Cocoa-Mahogany Storybook Frame */}
            <div className="relative rounded-[34px] border-[2.5px] border-[#f9d776] bg-[radial-gradient(ellipse_at_50%_18%,#462109_0%,#291205_52%,#170a03_100%)] text-amber-50 shadow-[0_0_0_2px_rgba(254,230,152,0.32),0_0_65px_rgba(251,191,36,0.42),0_30px_90px_rgba(12,5,1,0.88)] ring-1 ring-inset ring-amber-200/30">
              {/* Soft Inner Golden Sunbeam Behind Avatar Medallion */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[32px] overflow-hidden"
              >
                <div className="absolute left-1/2 top-[41%] -translate-x-1/2 -translate-y-1/2 w-[360px] h-[220px] rounded-full bg-[radial-gradient(circle,rgba(254,215,102,0.28)_0%,rgba(245,158,11,0.08)_48%,transparent_72%)]" />
                <div className="absolute left-7 top-[37%] text-[#fef08a]/85">
                  <FourPointStar className="w-3.5 h-3.5" />
                </div>
                <div className="absolute left-14 top-[42%] text-[#fcd34d]/75">
                  <FourPointStar className="w-2.5 h-2.5" />
                </div>
                <div className="absolute right-8 top-[35%] text-[#fef08a]/85">
                  <FourPointStar className="w-3 h-3" />
                </div>
                <div className="absolute right-14 top-[43%] text-[#fde68a]/70">
                  <FourPointStar className="w-2 h-2" />
                </div>
              </div>

              {/* Circular Glowing Golden Close (X) Button */}
              <button
                type="button"
                onClick={() => {
                  playPopSound();
                  onDismiss();
                }}
                aria-label="Return to Workshop"
                className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-30 w-10 h-10 rounded-full bg-[#2a1306]/85 hover:bg-[#49210b] border-2 border-[#f8d474] text-[#fff2c6] flex items-center justify-center shadow-[0_0_16px_rgba(251,191,36,0.35)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.6]" />
              </button>

              {/* Storybook Content */}
              <div className="relative z-10 px-4 sm:px-7 pt-9 sm:pt-10 pb-8 sm:pb-9 text-center">
                {/* Kicker */}
                <div className="inline-flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-[#f6d58e] pr-6 sm:pr-0">
                  <FourPointStar className="w-2.5 h-2.5 text-[#fde68a] shrink-0" />
                  <span>The 1% Santa Secret · Hidden Golden World</span>
                  <FourPointStar className="w-2.5 h-2.5 text-[#fde68a] shrink-0" />
                </div>

                {/* Hero Quote Flanked by Golden Laurel Leaf Sprigs */}
                <div className="mt-3 sm:mt-3.5 flex items-center justify-center gap-1.5 sm:gap-3">
                  <LaurelSprig className="hidden sm:block w-7 h-14 shrink-0 opacity-90" />
                  <h2 className="font-display text-[22px] sm:text-[30px] font-extrabold leading-[1.15] tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#fffbeb] via-[#ffe49e] to-[#f4b426] drop-shadow-[0_3px_8px_rgba(0,0,0,0.65)] [text-wrap:balance] max-w-[430px]">
                    &ldquo;You weren&apos;t supposed to figure that out. Santa has been compromised.&rdquo;
                  </h2>
                  <LaurelSprig flip className="hidden sm:block w-7 h-14 shrink-0 opacity-90" />
                </div>

                {/* Scalloped Cream Parchment Award Plaque with Overlapping Avatar Seal */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.22 }}
                  className="relative mt-14 sm:mt-16"
                >
                  {/* Floating Golden Envelope Trail (Upper Right of Medallion) */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none hidden sm:block absolute -top-[58px] right-[18px] z-20 w-[138px] h-[82px]"
                  >
                    <svg viewBox="0 0 140 84" fill="none" className="w-full h-full overflow-visible">
                      <path
                        d="M8 74C38 66 44 26 88 22"
                        stroke="#fde68a"
                        strokeWidth="1.8"
                        strokeDasharray="3 4"
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                      <circle cx="52" cy="40" r="2" fill="#fff7cc" />
                      <circle cx="66" cy="27" r="1.6" fill="#fde68a" />
                      <circle cx="34" cy="64" r="1.4" fill="#fcd34d" />
                    </svg>
                    <motion.div
                      animate={{ y: [0, -5, 0], rotate: [10, 14, 10] }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute right-0 top-0"
                    >
                      <svg viewBox="0 0 54 38" fill="none" className="w-[46px] h-[34px] drop-shadow-[0_4px_12px_rgba(251,191,36,0.55)]">
                        <defs>
                          <linearGradient id="gw-env-gold" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#fff7d1" />
                            <stop offset="100%" stopColor="#f4c553" />
                          </linearGradient>
                        </defs>
                        <rect
                          x="2"
                          y="2"
                          width="50"
                          height="34"
                          rx="5"
                          fill="url(#gw-env-gold)"
                          stroke="#d98c16"
                          strokeWidth="1.6"
                        />
                        <path
                          d="M4 5L27 22L50 5"
                          stroke="#c87a0e"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                        {/* Crimson heart wax seal */}
                        <path
                          d="M27 25.5C27 25.5 21 21.6 21 17.8C21 15.8 22.6 14.5 24.3 14.5C25.5 14.5 26.5 15.2 27 16.2C27.5 15.2 28.5 14.5 29.7 14.5C31.4 14.5 33 15.8 33 17.8C33 21.6 27 25.5 27 25.5Z"
                          fill="#dc2626"
                        />
                      </svg>
                    </motion.div>
                  </div>

                  {/* Overlapping Radiant Starburst Avatar Medallion */}
                  <div className="relative z-20 -mb-[52px] sm:-mb-[56px] flex flex-col items-center">
                    <div className="relative flex items-center justify-center">
                      {/* Flanking Golden Laurels at Medallion Base */}
                      <PlaqueLaurel className="absolute -left-11 bottom-1 w-12 h-10 pointer-events-none" />
                      <PlaqueLaurel flip className="absolute -right-11 bottom-1 w-12 h-10 pointer-events-none" />

                      {/* Scalloped Molten-Gold Starburst Seal */}
                      <motion.div
                        initial={{ scale: 0.78, y: -12, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.3 }}
                        className="relative flex items-center justify-center"
                      >
                        <svg
                          viewBox="0 0 140 140"
                          aria-hidden="true"
                          className="w-[116px] h-[116px] sm:w-[126px] sm:h-[126px] drop-shadow-[0_0_24px_rgba(251,191,36,0.65)]"
                        >
                          <defs>
                            <linearGradient id="gw-seal-gold" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#fff8c9" />
                              <stop offset="45%" stopColor="#fbbf24" />
                              <stop offset="100%" stopColor="#c57407" />
                            </linearGradient>
                            <radialGradient id="gw-seal-inner" cx="50%" cy="42%" r="55%">
                              <stop offset="0%" stopColor="#fffdf2" />
                              <stop offset="75%" stopColor="#fef0c3" />
                              <stop offset="100%" stopColor="#f3c564" />
                            </radialGradient>
                          </defs>
                          {/* 12-lobe scalloped starburst badge */}
                          <path
                            d="M70 4L81 14L96 10L101 24L116 26L115 41L128 49L122 63L131 76L119 86L122 101L107 105L104 120L89 118L80 130L66 123L53 131L44 119L29 121L26 106L12 101L16 86L5 76L14 63L8 49L21 41L20 26L35 24L40 10L55 14L70 4Z"
                            fill="url(#gw-seal-gold)"
                            stroke="#fff7cc"
                            strokeWidth="1.8"
                          />
                          <circle
                            cx="70"
                            cy="68"
                            r="49"
                            fill="url(#gw-seal-inner)"
                            stroke="#d98912"
                            strokeWidth="3"
                          />
                        </svg>

                        {/* Live Participant Avatar Wearing Golden Detective Crown */}
                        <div className="absolute inset-0 flex items-center justify-center -translate-y-[2px]">
                          <div className="rounded-full overflow-hidden flex items-center justify-center">
                            <AvatarGraphic
                              avatarId={participantAvatarId}
                              size={84}
                              hasGoldenCrown
                            />
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Crimson Ribbon Banner & Mini Crown Crest Anchoring the Seal */}
                    <svg
                      viewBox="0 0 180 42"
                      fill="none"
                      aria-hidden="true"
                      className="-mt-6 w-[148px] sm:w-[158px] h-[36px] relative z-10 drop-shadow-[0_4px_8px_rgba(38,14,4,0.45)]"
                    >
                      <defs>
                        <linearGradient id="gw-ribbon-banner" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#881111" />
                          <stop offset="28%" stopColor="#d92d20" />
                          <stop offset="50%" stopColor="#ef4444" />
                          <stop offset="72%" stopColor="#d92d20" />
                          <stop offset="100%" stopColor="#881111" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M16 14L38 11C58 20 122 20 142 11L164 14L154 24L164 33L138 30C118 37 62 37 42 30L16 33L26 24L16 14Z"
                        fill="url(#gw-ribbon-banner)"
                        stroke="#f8d275"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                      <circle cx="90" cy="23" r="12.5" fill="#461b05" stroke="#fcd34d" strokeWidth="2.4" />
                      <path
                        d="M83 27.5L81.5 19.5L86 22.8L90 17L94 22.8L98.5 19.5L97 27.5H83Z"
                        fill="#fde047"
                      />
                    </svg>
                  </div>

                  {/* Scalloped Cream Parchment Card Body */}
                  <div className="relative pt-[62px] sm:pt-[66px] pb-6 sm:pb-7 px-5 sm:px-8">
                    {/* Scalloped Baroque Parchment SVG Frame */}
                    <svg
                      viewBox="0 0 500 190"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 w-full h-full drop-shadow-[0_10px_28px_rgba(10,4,1,0.55)]"
                    >
                      <defs>
                        <linearGradient id="gw-parchment-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fef2dc" />
                          <stop offset="55%" stopColor="#f9e0b8" />
                          <stop offset="100%" stopColor="#f2cb92" />
                        </linearGradient>
                        <linearGradient id="gw-parchment-edge" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#fff5c9" />
                          <stop offset="50%" stopColor="#eab342" />
                          <stop offset="100%" stopColor="#c7831e" />
                        </linearGradient>
                      </defs>
                      {/* Outer scalloped cream scroll */}
                      <path
                        d="M42 8 C125 8, 175 14, 250 14 C325 14, 375 8, 458 8 C462 24, 476 34, 492 38 C492 72, 488 85, 496 95 C488 105, 492 118, 492 152 C476 156, 462 166, 458 182 C375 182, 325 176, 250 176 C175 176, 125 182, 42 182 C38 166, 24 156, 8 152 C8 118, 12 105, 4 95 C12 85, 8 72, 8 38 C24 34, 38 24, 42 8 Z"
                        fill="url(#gw-parchment-fill)"
                        stroke="url(#gw-parchment-edge)"
                        strokeWidth="3"
                      />
                      {/* Inner dashed filigree border */}
                      <path
                        d="M50 18 C130 18, 178 24, 250 24 C322 24, 370 18, 450 18 C454 32, 466 40, 481 44 C481 74, 478 86, 485 95 C478 104, 481 116, 481 146 C466 150, 454 158, 450 172 C370 172, 322 166, 250 166 C178 166, 130 172, 50 172 C46 158, 34 150, 19 146 C19 116, 22 104, 15 95 C22 86, 19 74, 19 44 C34 40, 46 32, 50 18 Z"
                        fill="none"
                        stroke="#cc8f36"
                        strokeOpacity="0.65"
                        strokeWidth="1.2"
                        strokeDasharray="4 4"
                      />
                    </svg>

                    {/* Parchment Text Content */}
                    <div className="relative z-10 space-y-1.5">
                      <p className="font-display text-[17px] sm:text-[21px] font-extrabold text-[#3c1908] inline-flex items-center justify-center gap-2 leading-tight">
                        <GoldenCrownIcon className="w-6 h-5 shrink-0" />
                        <span>Golden Detective Crown Unlocked</span>
                      </p>

                      <p className="text-[12px] sm:text-[13px] text-[#592b12] font-medium leading-snug">
                        Awarded to{' '}
                        <strong className="font-bold text-[#2f1205]">{participantName}</strong> ·
                        Permanent rare avatar cosmetic for this event
                      </p>

                      {/* Delicate Golden Diamond-Star Divider */}
                      <div
                        aria-hidden="true"
                        className="pt-1.5 flex items-center justify-center gap-2 text-[#d48b1c]"
                      >
                        <span className="h-[1px] w-10 bg-gradient-to-r from-transparent to-[#d48b1c]/70" />
                        <span className="w-1 h-1 rounded-full bg-[#d48b1c]/80" />
                        <FourPointStar className="w-3.5 h-3.5 text-[#d98714]" />
                        <span className="w-1 h-1 rounded-full bg-[#d48b1c]/80" />
                        <span className="h-[1px] w-10 bg-gradient-to-l from-transparent to-[#d48b1c]/70" />
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Glossy Molten-Gold CTA & Live Countdown */}
                <div className="mt-5 sm:mt-6 flex flex-col items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      onDismiss();
                    }}
                    className="group relative min-h-[50px] px-8 sm:px-10 py-3 rounded-full border-2 border-[#fff6c7]/95 bg-gradient-to-b from-[#fff2ab] via-[#fbbf24] to-[#df8a07] hover:from-[#fff7c4] hover:via-[#fcd34d] hover:to-[#ea980c] text-[#281104] font-display font-extrabold text-[15px] sm:text-[17px] inline-flex items-center justify-center gap-2.5 shadow-[0_0_28px_rgba(251,191,36,0.58),0_8px_20px_rgba(12,5,1,0.55),inset_0_2px_2px_rgba(255,255,255,0.8)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer whitespace-nowrap"
                  >
                    <MagicWandIcon className="w-6 h-6 shrink-0 transition-transform group-hover:-rotate-6" />
                    <span>Wear Crown &amp; Return</span>
                  </button>

                  <p className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium tabular-nums text-[#f5d79c]/90">
                    <Clock className="w-3.5 h-3.5 text-[#f7cf6c] shrink-0" />
                    <span>Returning to normal world in {secondsLeft}s</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Candy-Cane Scalloped Trim & Golden Starburst Finial */}
            <BottomCandyTrim />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
