import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ThemeId } from '../../types/secretSanta';
import { THEME_CONFIGS } from './ThemeConfig';

interface ThemeBackdropProps {
  theme: ThemeId;
}

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: `${(i * 41) % 100}%`,
  size: 5 + (i % 5) * 2.5,
  delay: `${(i % 8) * 0.65}s`,
  duration: `${6.5 + (i % 6) * 1.5}s`,
  opacity: 0.4 + (i % 4) * 0.15,
  desiPetalColor: ['#f97316', '#facc15', '#ec4899', '#fbbf24', '#2dd4bf'][i % 5],
}));

export const ThemeBackdrop: React.FC<ThemeBackdropProps> = ({ theme }) => {
  const cfg = THEME_CONFIGS[theme];

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* Smooth Cross-Fading 3D Backdrop Scene */}
      <AnimatePresence mode="sync">
        <motion.div
          key={theme}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
          style={{ background: cfg.backdropFallback }}
          className="absolute inset-0"
        >
          <img
            src={cfg.backdropImage}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />
          <div className={`absolute inset-0 ${cfg.scrimClass}`} />
        </motion.div>
      </AnimatePresence>

      {/* Theme-Aware Animated Falling Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {PARTICLES.map((p) => {
          if (theme === 'chocolate') {
            return (
              <span
                key={`choco-${p.id}`}
                style={{
                  left: p.left,
                  width: p.size,
                  height: p.size,
                  opacity: p.opacity,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                }}
                className="snowflake-particle absolute -top-6 rounded-full bg-amber-100/90 shadow-[0_0_8px_rgba(251,191,36,0.75)]"
              />
            );
          }

          if (theme === 'funny') {
            return (
              <span
                key={`desi-petal-${p.id}`}
                style={{
                  left: p.left,
                  width: p.size + 4,
                  height: p.size * 0.85,
                  backgroundColor: p.desiPetalColor,
                  opacity: p.opacity + 0.18,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                  borderRadius: '65% 35% 65% 35% / 55% 45% 55% 45%',
                }}
                className="snowflake-particle absolute -top-6 shadow-[0_0_10px_rgba(250,204,21,0.55)]"
              />
            );
          }

          return (
            <span
              key={`snow-${p.id}`}
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
              className="snowflake-particle absolute -top-6 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)]"
            />
          );
        })}
      </div>
    </div>
  );
};
