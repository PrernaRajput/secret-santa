import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Crown, Sparkles, X } from 'lucide-react';
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

/**
 * Full-viewport Hidden Golden Christmas World transformation for The 1% Santa Secret.
 * Briefly transforms the entire website into a shimmering golden winter realm,
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

    const count = Math.min(110, Math.max(55, Math.floor(width / 14)));
    const flakes: GoldFlake[] = Array.from({ length: count }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1.4 + Math.random() * 3.4,
      speedY: 0.45 + Math.random() * 1.15,
      driftX: (Math.random() - 0.5) * 0.55,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.35 + Math.random() * 0.65,
      sparkle: idx % 5 === 0,
    }));

    let frame = 0;
    const render = () => {
      frame += 0.025;
      ctx.clearRect(0, 0, width, height);

      for (const f of flakes) {
        if (!reducedMotion) {
          f.y += f.speedY;
          f.x += f.driftX + Math.sin(frame + f.phase) * 0.4;
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
          // 4-point golden Christmas star
          ctx.translate(f.x, f.y);
          ctx.fillStyle = '#fef9c3';
          const s = f.r * 2.1;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.25, -s * 0.25);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.25, s * 0.25);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.25, s * 0.25);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.25, -s * 0.25);
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
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        >
          {/* Full-Website Hidden Golden Christmas World Backdrop */}
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,#5c3a06_0%,#241504_48%,#0b0702_100%)]"
          />

          {/* Warm Gilded Aurora Rays */}
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none bg-[conic-gradient(from_180deg_at_50%_0%,rgba(253,224,71,0.16)_0deg,transparent_55deg,rgba(245,158,11,0.2)_130deg,transparent_215deg,rgba(254,240,138,0.16)_300deg,transparent_360deg)]"
          />

          {/* Golden Winter Pine Horizon Silhouette */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1440 240"
            preserveAspectRatio="none"
            className="fixed bottom-0 inset-x-0 w-full h-36 sm:h-48 pointer-events-none opacity-65"
          >
            <defs>
              <linearGradient id="gw-horizon" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d97706" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0b0702" stopOpacity="0.98" />
              </linearGradient>
            </defs>
            <path
              d="M0 240 L0 185 L45 110 L85 170 L135 88 L190 175 L250 125 L295 182 L365 95 L425 176 L495 132 L545 186 L620 118 L685 182 L760 105 L825 180 L905 128 L965 184 L1040 92 L1110 176 L1185 122 L1245 180 L1315 86 L1385 174 L1440 135 L1440 240 Z"
              fill="url(#gw-horizon)"
            />
          </svg>

          {/* Animated 24k Gold Snowfall & Starlight Canvas */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none"
          />

          {/* Classified Golden Transmission Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -12 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl rounded-[28px] border border-amber-300/60 bg-[#120c04]/90 backdrop-blur-xl text-amber-50 shadow-[0_30px_90px_rgba(245,158,11,0.35)] overflow-hidden"
          >
            {/* Top metallic gold hairline accent */}
            <div
              aria-hidden="true"
              className="h-1 w-full bg-gradient-to-r from-amber-600 via-yellow-200 to-amber-600"
            />

            <button
              type="button"
              onClick={() => {
                playPopSound();
                onDismiss();
              }}
              aria-label="Return to Workshop"
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-amber-400/15 hover:bg-amber-400/25 border border-amber-300/35 text-amber-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 sm:p-9 text-center space-y-6">
              <div className="space-y-2.5">
                <p className="text-xs font-semibold tracking-widest uppercase text-amber-300">
                  The 1% Santa Secret · Hidden Golden World
                </p>

                <h2 className="font-display text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-200 to-amber-400 leading-tight [text-wrap:balance]">
                  &ldquo;You weren&apos;t supposed to figure that out. Santa has been compromised.&rdquo;
                </h2>
              </div>

              {/* Permanent Rare Cosmetic Award Pedestal */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.28 }}
                className="rounded-2xl border border-amber-300/40 bg-gradient-to-b from-amber-400/12 to-amber-950/35 px-5 py-5 flex flex-col items-center gap-3"
              >
                <div className="relative">
                  <motion.div
                    initial={{ scale: 0.82, y: -12, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.36 }}
                    className="rounded-3xl p-1.5 bg-gradient-to-br from-yellow-200/40 via-amber-400/20 to-amber-700/40 shadow-[0_0_40px_rgba(250,204,21,0.35)]"
                  >
                    <AvatarGraphic
                      avatarId={participantAvatarId}
                      size={96}
                      hasGoldenCrown
                    />
                  </motion.div>
                </div>

                <div className="space-y-1">
                  <p className="font-display text-lg sm:text-xl font-bold text-amber-100 inline-flex items-center justify-center gap-2">
                    <Crown className="w-5 h-5 text-amber-300 shrink-0" />
                    Golden Detective Crown Unlocked
                  </p>
                  <p className="text-xs sm:text-sm text-amber-200/80">
                    Awarded to <strong className="text-amber-50">{participantName}</strong> · Permanent rare avatar cosmetic for this event
                  </p>
                </div>
              </motion.div>

              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    onDismiss();
                  }}
                  className="min-h-[46px] px-7 py-2.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 hover:from-amber-200 hover:to-yellow-300 text-[#1b1305] font-display font-bold text-sm sm:text-base inline-flex items-center gap-2 shadow-[0_12px_32px_rgba(250,204,21,0.35)] transition-transform active:scale-[0.98] cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  Wear Crown &amp; Return
                </button>

                <p className="text-[11px] font-mono tabular-nums text-amber-200/65">
                  Returning to normal world in {secondsLeft}s
                </p>
              </div>
            </div>

            {/* Smooth countdown progress hairline */}
            <div aria-hidden="true" className="h-1 w-full bg-amber-950/80">
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: durationMs / 1000, ease: 'linear' }}
                style={{ transformOrigin: 'left center' }}
                className="h-full w-full bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
