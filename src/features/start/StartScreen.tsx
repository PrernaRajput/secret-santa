import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, MapPin, Palette, Sparkles } from 'lucide-react';
import { ThemeId } from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { FestiveCharacters, ThemeCardTrim } from '../../components/themes/FestiveCharacters';
import { playPopSound } from '../../utils/sound';

interface StartScreenProps {
  theme: ThemeId;
  eventName: string;
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  theme,
  eventName,
  onStart,
}) => {
  const cfg = THEME_CONFIGS[theme];

  const highlights = [
    {
      icon: MapPin,
      emoji: '🏠',
      title: 'Add name + address',
      desc: 'Quick import from Blinkit, Amazon, Zomato or Flipkart',
      tint:
        theme === 'chocolate'
          ? 'bg-[#fae8ce] border-[#d8b48a]'
          : theme === 'funny'
            ? 'bg-amber-50 border-amber-300'
            : 'bg-rose-50/90 border-rose-200/80',
    },
    {
      icon: Palette,
      emoji: '🎮',
      title: 'Pick up to 5 hobbies',
      desc: 'Drop fun gift clues so Santa never gifts you a toaster',
      tint:
        theme === 'chocolate'
          ? 'bg-[#f6dfc0] border-[#cfa375]'
          : theme === 'funny'
            ? 'bg-fuchsia-50 border-fuchsia-300'
            : 'bg-purple-50/90 border-purple-200/80',
    },
    {
      icon: Sparkles,
      emoji: '✨',
      title: 'Scratch & shake reveal',
      desc: 'Unlock your match on reveal day with a dramatic FAAAAH!',
      tint:
        theme === 'chocolate'
          ? 'bg-[#f9e7ca] border-[#d8b48a]'
          : theme === 'funny'
            ? 'bg-cyan-50 border-cyan-300'
            : 'bg-emerald-50/90 border-emerald-200/80',
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-2xl mx-auto flex flex-col items-center"
    >
      {/* Animated 3D Santa & Reindeers */}
      <FestiveCharacters theme={theme} mood="happy" />

      {/* Main Hero Card */}
      <div className={`w-full rounded-[28px] overflow-hidden -mt-4 ${cfg.cardClass}`}>
        <ThemeCardTrim theme={theme} />

        <div className="p-6 sm:p-8 text-center space-y-6">
          {/* Bold 3D Cartoon Secret Santa Ribbon Header */}
          <div className="space-y-2">
            <div
              className={`inline-block px-5 py-1.5 rounded-2xl shadow-lg border-2 border-amber-200/80 ${
                theme === 'funny'
                  ? 'bg-gradient-to-b from-pink-600 via-rose-600 to-orange-600 shadow-pink-900/35'
                  : 'bg-gradient-to-b from-rose-500 to-rose-700 shadow-rose-900/30'
              }`}
            >
              <span className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-300">
                {theme === 'funny' ? 'Desi Santa' : 'Secret Santa'}
              </span>
            </div>
            <p className={`text-xs font-semibold tracking-wide ${cfg.mutedText}`}>
              {eventName} · {cfg.name}
            </p>
            <h1 className={`font-display text-xl sm:text-2xl font-bold pt-1 text-balance ${cfg.cardText}`}>
              {theme === 'funny'
                ? 'Ho Ho Ho? Nahi bhai, Balle Balle Christmas! Auto-rickshaw gifts se loaded hai! 🛺🥁'
                : 'Add your details, get matched, then scratch to reveal your giftee!'}
            </h1>
          </div>

          {/* 3 Feature Highlight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left sm:text-center">
            {highlights.map((h) => (
              <div
                key={h.title}
                className={`rounded-2xl border p-4 flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-2 transition-transform hover:-translate-y-0.5 ${h.tint}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/90 shadow-sm flex items-center justify-center text-2xl shrink-0">
                  <span aria-hidden="true">{h.emoji}</span>
                </div>
                <div>
                  <h2 className={`font-display font-bold text-sm sm:text-base leading-snug ${cfg.cardText}`}>
                    {h.title}
                  </h2>
                  <p className={`text-xs mt-1 leading-relaxed ${cfg.mutedText}`}>
                    {h.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Primary Glossy 3D Start CTA */}
          <div className="pt-1">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                playPopSound();
                onStart();
              }}
              className={`w-full sm:w-auto sm:min-w-[280px] min-h-[56px] px-8 py-3.5 rounded-full font-display text-xl font-bold inline-flex items-center justify-center gap-2.5 cursor-pointer transition-transform ${cfg.primaryBtnClass}`}
            >
              Start
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
