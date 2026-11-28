import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface DesiSantaLoaderProps {
  onComplete: () => void;
}

const SNOWFLAKES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 37) % 100}%`,
  size: 4 + (i % 6) * 2,
  delay: `${(i % 9) * 0.45}s`,
  duration: `${5.5 + (i % 5) * 1.4}s`,
  opacity: 0.45 + (i % 4) * 0.15,
}));

const GOLDEN_SPARKLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 19) % 52)}%`,
  top: `${28 + ((i * 23) % 48)}%`,
  delay: `${(i % 6) * 0.35}s`,
  size: 4 + (i % 4) * 2,
}));

export const DesiSantaLoader: React.FC<DesiSantaLoaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const durationMs = 3100;
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const ratio = Math.min(1, elapsed / durationMs);
      // Smooth cinematic ease with brief realistic pause around 68%
      const eased =
        ratio < 0.7
          ? Math.round((ratio / 0.7) * 68)
          : Math.round(68 + ((ratio - 0.7) / 0.3) * 32);
      setProgress(eased);
      if (ratio < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        window.setTimeout(onComplete, 260);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45 } }}
      className="fixed inset-0 z-50 overflow-hidden bg-[#060d24] text-[#fef3c7] select-none"
      role="status"
      aria-live="polite"
      aria-label={`Secret Santa loading ${progress}%`}
    >
      {/* Desktop 16:9 Scene (md and up) */}
      <div className="hidden md:block absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ x: 80, scale: 1.07, opacity: 0.6 }}
          animate={{ x: 0, scale: 1.02, opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <img
            src="/src/assets/images/desi_santa_buffalo_desktop_1795638737527.jpg"
            alt="Desi Santa Claus riding a decorated black Indian water buffalo in a snowy midnight village"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-left animate-gallop"
          />
        </motion.div>
        {/* Right-side cinematic readability gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#060d24]/35 to-[#060d24]/95" />
      </div>

      {/* Mobile 9:16 Dedicated Portrait Scene */}
      <div className="block md:hidden absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ x: 55, scale: 1.06, opacity: 0.7 }}
          animate={{ x: 0, scale: 1.02, opacity: 1 }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <img
            src="/src/assets/images/desi_santa_buffalo_mobile_1795638738554.jpg"
            alt="Desi Santa Claus riding a decorated black Indian water buffalo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-top animate-gallop"
          />
        </motion.div>
        {/* Lower-third readability gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060d24]/25 to-[#060d24]/95" />
      </div>

      {/* Magical Golden Particle Trail */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {GOLDEN_SPARKLES.map((sp) => (
          <span
            key={sp.id}
            style={{
              left: sp.left,
              top: sp.top,
              width: sp.size,
              height: sp.size,
              animationDelay: sp.delay,
            }}
            className="absolute rounded-full bg-amber-300 shadow-[0_0_12px_4px_rgba(251,191,36,0.75)] animate-sparkle"
          />
        ))}
      </div>

      {/* Falling Snow Layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {SNOWFLAKES.map((f) => (
          <span
            key={f.id}
            style={{
              left: f.left,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              animationDelay: f.delay,
              animationDuration: f.duration,
            }}
            className="snowflake-particle absolute -top-4 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)]"
          />
        ))}
      </div>

      {/* Responsive UI Overlay: Desktop Right Half / Mobile Lower Safe Area */}
      <div className="relative z-10 h-full w-full flex flex-col justify-end md:justify-center md:items-end px-6 pb-12 md:pb-0 md:pr-16 lg:pr-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="w-full max-w-md text-center space-y-5"
        >
          {/* Golden Festive Crest */}
          <div className="flex items-center justify-center gap-3 text-amber-300/90">
            <span className="h-[1px] w-12 bg-gradient-to-r from-transparent to-amber-300/80" />
            <span className="text-xl" aria-hidden="true">🎁</span>
            <span className="h-[1px] w-12 bg-gradient-to-l from-transparent to-amber-300/80" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#fffbeb] via-[#fde68a] to-[#f59e0b] drop-shadow-[0_4px_20px_rgba(245,158,11,0.45)]">
              Secret Santa
            </h1>
            <p className="text-sm sm:text-base text-amber-100/90 font-medium tracking-wide">
              Santa is preparing something magical...
            </p>
          </div>

          {/* Glowing Red-and-White Candy-Cane Progress Bar */}
          <div className="space-y-2.5 pt-1">
            <div className="relative h-5 w-full rounded-full p-1 bg-[#0b1536]/90 border border-amber-300/60 shadow-[0_0_24px_rgba(251,191,36,0.3)] overflow-hidden">
              <div
                style={{ width: `${Math.max(6, progress)}%` }}
                className="h-full rounded-full candy-cane-bar transition-[width] duration-150 ease-out shadow-[0_0_16px_rgba(239,68,68,0.8)]"
              />
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm text-amber-200/90 font-mono-tabular px-1">
              <span>Loading... {progress}%</span>
              <button
                type="button"
                onClick={onComplete}
                className="text-amber-200/75 hover:text-amber-100 underline underline-offset-4 transition-colors cursor-pointer font-sans"
              >
                Skip intro
              </button>
            </div>
          </div>

          <p className="pt-2 text-xs text-amber-100/60 tracking-wide">
            Made by Dheeraj and Prerna Pvt LTD
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};
