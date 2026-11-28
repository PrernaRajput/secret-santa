import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import { GenderCategory, ThemeId } from '../../types/secretSanta';
import { AVATARS } from '../../data/avatars';
import { AvatarGraphic } from '../../components/avatars/AvatarGraphic';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { FestiveCharacters, ThemeCardTrim } from '../../components/themes/FestiveCharacters';
import { playPopSound } from '../../utils/sound';

interface AvatarScreenProps {
  theme: ThemeId;
  selectedAvatarId: string;
  genderFilter: GenderCategory;
  onSelectAvatar: (avatarId: string) => void;
  onChangeGenderFilter: (filter: GenderCategory) => void;
  onContinue: () => void;
}

const FILTER_TABS: { id: GenderCategory; label: string }[] = [
  { id: 'all', label: 'All (20)' },
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'neutral', label: 'Neutral' },
];

export const AvatarScreen: React.FC<AvatarScreenProps> = ({
  theme,
  selectedAvatarId,
  genderFilter,
  onSelectAvatar,
  onChangeGenderFilter,
  onContinue,
}) => {
  const cfg = THEME_CONFIGS[theme];

  const visibleAvatars = useMemo(() => {
    if (genderFilter === 'all') return AVATARS;
    return AVATARS.filter((a) => a.category === genderFilter);
  }, [genderFilter]);

  const activeAvatar = AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-3xl mx-auto flex flex-col items-center"
    >
      <FestiveCharacters theme={theme} mood="happy" compact />

      <div className={`w-full rounded-[28px] overflow-hidden -mt-3 ${cfg.cardClass}`}>
        <ThemeCardTrim theme={theme} />

        <div className="p-5 sm:p-8 space-y-5">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <h1 className={`font-display text-3xl sm:text-4xl font-bold ${cfg.cardText}`}>
              Choose your avatar
            </h1>
            <p className={`text-sm ${cfg.mutedText}`}>
              Pick the character that looks most like you · Optional filter below
            </p>
          </div>

          {/* Gender Filter Segmented Control */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {FILTER_TABS.map((tab) => {
              const active = genderFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    playPopSound();
                    onChangeGenderFilter(tab.id);
                  }}
                  className={`min-h-[40px] px-4 py-1.5 rounded-full text-sm font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                    active ? cfg.chipSelectedClass : cfg.chipIdleClass
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* 20-Avatar Responsive Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-3.5">
            {visibleAvatars.map((avatar) => {
              const isSelected = avatar.id === selectedAvatarId;
              return (
                <motion.button
                  key={avatar.id}
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    playPopSound();
                    onSelectAvatar(avatar.id);
                  }}
                  aria-pressed={isSelected}
                  className={`relative rounded-2xl p-2 flex flex-col items-center gap-1.5 border-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                    isSelected
                      ? 'border-rose-500 bg-rose-50/90 shadow-lg shadow-rose-500/20 ring-2 ring-amber-300'
                      : 'border-black/5 bg-white/75 hover:bg-white hover:border-black/15'
                  }`}
                >
                  <AvatarGraphic avatarId={avatar.id} size={74} className="w-16 h-16 sm:w-[74px] sm:h-[74px]" />
                  <span className="text-[11px] font-semibold text-slate-800 leading-tight text-center line-clamp-1">
                    {avatar.name}
                  </span>
                  {isSelected && (
                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md border-2 border-white">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Selected Preview & Continue CTA */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-black/10">
            <div className="flex items-center gap-3">
              <AvatarGraphic avatarId={activeAvatar.id} size={48} className="w-12 h-12 shrink-0" />
              <div className="text-left">
                <p className={`text-xs font-medium ${cfg.mutedText}`}>Selected Character</p>
                <p className={`font-display font-bold text-base ${cfg.cardText}`}>
                  {activeAvatar.name}
                </p>
              </div>
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                playPopSound();
                onContinue();
              }}
              className={`w-full sm:w-auto min-w-[210px] min-h-[52px] px-7 py-3 rounded-full font-display text-lg font-bold inline-flex items-center justify-center gap-2 cursor-pointer ${cfg.primaryBtnClass}`}
            >
              Save avatar
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
