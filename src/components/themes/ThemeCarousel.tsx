import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeId } from '../../types/secretSanta';
import { THEME_CONFIGS, THEME_ORDER } from './ThemeConfig';
import { playPopSound } from '../../utils/sound';

interface ThemeCarouselProps {
  theme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
  minimalDark?: boolean;
}

export const ThemeCarousel: React.FC<ThemeCarouselProps> = ({
  theme,
  onSelectTheme,
  minimalDark = false,
}) => {
  const activeIdx = THEME_ORDER.indexOf(theme);
  const cfg = THEME_CONFIGS[theme];

  const handleStep = (delta: number) => {
    playPopSound();
    const nextIdx = (activeIdx + delta + THEME_ORDER.length) % THEME_ORDER.length;
    onSelectTheme(THEME_ORDER[nextIdx]);
  };

  if (minimalDark) {
    return (
      <footer className="relative z-20 w-full py-4 text-center">
        <p className="text-xs font-medium tracking-wide text-stone-400">
          Made by Dheeraj and Prerna Pvt LTD
        </p>
      </footer>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex flex-col items-center">
      {/* Compact Floating Semicircular Theme Carousel */}
      <div
        role="radiogroup"
        aria-label="Choose festive theme"
        className={`pointer-events-auto relative flex items-end justify-center gap-2 sm:gap-3 px-4 pt-2.5 pb-1.5 rounded-t-[999px] ${cfg.carouselDockClass}`}
      >
        <button
          type="button"
          onClick={() => handleStep(-1)}
          aria-label="Previous theme"
          className={`w-9 h-9 mb-1 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            theme === 'santa'
              ? 'text-indigo-900 hover:bg-indigo-100'
              : 'text-amber-100 hover:bg-white/15'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {THEME_ORDER.map((id, idx) => {
          const item = THEME_CONFIGS[id];
          const isSelected = id === theme;
          // Arc height: middle/selected icon floats slightly higher along the semicircle
          const arcLift = isSelected ? -10 : idx === 1 ? -4 : 0;

          return (
            <motion.button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={item.name}
              title={item.name}
              onClick={() => {
                playPopSound();
                onSelectTheme(id);
              }}
              animate={{
                y: arcLift,
                scale: isSelected ? 1.16 : 0.92,
              }}
              whileHover={{ scale: isSelected ? 1.2 : 1.02 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center cursor-pointer transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isSelected
                  ? id === 'chocolate'
                    ? 'bg-gradient-to-b from-amber-300 to-amber-500 ring-2 ring-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.75)]'
                    : id === 'funny'
                      ? 'bg-gradient-to-b from-amber-300 via-orange-400 to-pink-600 ring-2 ring-yellow-200 shadow-[0_0_22px_rgba(249,115,22,0.85)]'
                      : 'bg-gradient-to-b from-rose-400 to-rose-600 ring-2 ring-white shadow-[0_0_20px_rgba(244,63,94,0.7)]'
                  : theme === 'santa'
                    ? 'bg-indigo-100/90 hover:bg-white border border-indigo-200'
                    : 'bg-white/15 hover:bg-white/25 border border-white/25'
              }`}
            >
              <span className="text-2xl sm:text-[26px] leading-none" aria-hidden="true">
                {item.emoji}
              </span>
              {isSelected && (
                <motion.span
                  layoutId="active-theme-bar"
                  className="absolute -bottom-1.5 w-6 h-1 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
                />
              )}
            </motion.button>
          );
        })}

        <button
          type="button"
          onClick={() => handleStep(1)}
          aria-label="Next theme"
          className={`w-9 h-9 mb-1 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            theme === 'santa'
              ? 'text-indigo-900 hover:bg-indigo-100'
              : 'text-amber-100 hover:bg-white/15'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Persistent Required Footer */}
      <footer className="pointer-events-auto w-full text-center py-1.5 pb-safe bg-black/35 backdrop-blur-md border-t border-white/10">
        <p className={`text-[11px] sm:text-xs font-semibold tracking-wide ${cfg.footerClass}`}>
          {theme === 'funny' ? '🥁 ' : ''}
          Made by Dheeraj and Prerna Pvt LTD
          {theme === 'chocolate' ? ' 🤎' : theme === 'funny' ? ' 🥁' : ''}
        </p>
      </footer>
    </div>
  );
};
