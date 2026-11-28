import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Compass,
  Loader2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ElfDiscoveryRecord,
  ElfHidingSpotId,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { ELF_HIDING_SPOTS } from '../../data/workshopContent';
import { getDailyElfChallenge } from '../../utils/workshopLogic';
import {
  playBoingSound,
  playChimeSound,
  playMagicSparkleSound,
  playPopSound,
} from '../../utils/sound';

const DECOY_MESSAGES: Record<ElfHidingSpotId, string> = {
  tree: 'Just twinkling ornaments and pine needles here — no elf yet!',
  mailbox: 'Only a stack of North Pole letters inside — keep peeking!',
  giftbox: 'Empty satin ribbon and tissue paper — the elf slipped away!',
  calendar: 'Just a sneaky chocolate crumb behind the door — try another spot!',
  footer: 'Only festive garland bells jingling down here — look elsewhere!',
  snowsign: 'Nothing but powdery snow on the signpost — keep searching!',
};

type PeekingPosition = 'banner' | 'tile' | 'footer';

const PEEKING_POSITION_CLASSES: Record<PeekingPosition, string> = {
  banner: 'absolute top-3 right-3 z-20',
  tile: 'absolute -top-2.5 right-3 z-20',
  footer: 'absolute bottom-3 right-4 z-20',
};

interface PeekingElfWidgetProps {
  spotId: ElfHidingSpotId;
  activeSpotId: ElfHidingSpotId;
  alreadyFound: boolean;
  position?: PeekingPosition;
  onFoundElf: () => void;
}

/**
 * Peeking elf placed cleanly with absolute positioning on a non-blocking corner of today's hiding spot.
 */
export const PeekingElfWidget: React.FC<PeekingElfWidgetProps> = ({
  spotId,
  activeSpotId,
  alreadyFound,
  position = 'tile',
  onFoundElf,
}) => {
  if (alreadyFound || spotId !== activeSpotId) return null;

  return (
    <motion.button
      type="button"
      initial={{ y: 8, scale: 0.85, opacity: 0 }}
      animate={{ y: [0, -3, 0], scale: 1, opacity: 1 }}
      transition={{
        y: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' },
        opacity: { duration: 0.25 },
        scale: { duration: 0.25 },
      }}
      onClick={(e) => {
        e.stopPropagation();
        onFoundElf();
      }}
      aria-label="You spotted the Hidden Elf! Tap to catch the mischievous elf"
      title="Psst... you found me! Tap to catch!"
      className={`${PEEKING_POSITION_CLASSES[position]} group inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-[0_6px_18px_rgba(5,150,105,0.45)] border-2 border-amber-300 cursor-pointer transition-colors`}
    >
      <motion.span
        animate={{ rotate: [-10, 10, -10] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="text-base leading-none"
        aria-hidden="true"
      >
        🧝
      </motion.span>
      <span className="text-[11px] leading-none" aria-hidden="true">
        👀
      </span>
    </motion.button>
  );
};

interface HiddenElfHuntViewProps {
  theme: ThemeId;
  challenge: ReturnType<typeof getDailyElfChallenge>;
  discovery: ElfDiscoveryRecord | null;
  loading?: boolean;
  onCatchElf: () => Promise<void>;
  onGoToWorkshopSpot?: () => void;
  onOpenSnowGlobe?: () => void;
}

/**
 * Interactive & keyboard/screen-reader-accessible "Find the Hidden Elf" scavenger hunt.
 * Players read today's clue and search the 6 Workshop hiding spots (or hunt the live peeking elf in the Workshop).
 */
export const HiddenElfHuntView: React.FC<HiddenElfHuntViewProps> = ({
  theme,
  challenge,
  discovery,
  loading = false,
  onCatchElf,
  onGoToWorkshopSpot,
  onOpenSnowGlobe,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [catching, setCatching] = useState(false);
  const [checkedSpots, setCheckedSpots] = useState<ElfHidingSpotId[]>([]);
  const [wigglingSpot, setWigglingSpot] = useState<ElfHidingSpotId | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInspectSpot = async (spotId: ElfHidingSpotId) => {
    if (catching || discovery || loading) return;
    setErrorMsg(null);

    if (spotId !== challenge.spotId) {
      playBoingSound();
      setWigglingSpot(spotId);
      setCheckedSpots((prev) => (prev.includes(spotId) ? prev : [...prev, spotId]));
      setStatusFeedback(DECOY_MESSAGES[spotId]);
      window.setTimeout(() => {
        setWigglingSpot((curr) => (curr === spotId ? null : curr));
      }, 450);
      return;
    }

    setCatching(true);
    setStatusFeedback(null);
    try {
      await onCatchElf();
      playMagicSparkleSound();
      playChimeSound();
      confetti({
        particleCount: 80,
        spread: 75,
        origin: { y: 0.55 },
        colors: cfg.confettiColors,
      });
    } catch {
      setErrorMsg('Could not save your elf catch right now. Please tap the hiding spot again!');
    } finally {
      setCatching(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white p-5 sm:p-6 shadow-xl border border-emerald-400/30">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <motion.div
            animate={{ rotate: [-6, 6, -6] }}
            transition={{ repeat: Infinity, duration: 2.2 }}
            className="w-20 h-20 rounded-3xl bg-white/15 border-2 border-amber-300 flex items-center justify-center text-5xl shrink-0"
            aria-hidden="true"
          >
            🧝
          </motion.div>
          <div className="text-center sm:text-left space-y-1 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Daily Workshop Scavenger Hunt
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Find the Hidden Elf 🧝
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90">
              One sneaky elf hides somewhere in Santa&apos;s Workshop each day! Read today&apos;s clue and peek behind the hiding spots below to unlock a free Snow Globe ornament.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white/90 border border-black/10 p-8 flex flex-col items-center justify-center gap-2 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <p className="text-sm font-medium text-slate-600">
            Checking Santa&apos;s Workshop for today&apos;s sneaky elf...
          </p>
        </div>
      ) : discovery ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-emerald-50 border-2 border-emerald-300 p-6 text-center space-y-4"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white border border-emerald-200 flex items-center justify-center text-4xl shadow-sm">
            {discovery.rewardEmoji}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 inline-flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Today&apos;s Elf Caught! ({discovery.dateKey})
            </p>
            <p className="text-xs font-semibold text-emerald-800/80">
              Found at: {challenge.spotEmoji} {challenge.spotLabel}
            </p>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            &ldquo;{challenge.reward.joke}&rdquo;
          </h3>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-emerald-200 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-900 shadow-xs">
            <span>🎁</span>
            <span>Unlocked: {discovery.rewardTitle}</span>
          </div>
          {onOpenSnowGlobe && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  playPopSound();
                  onOpenSnowGlobe();
                }}
                className={`min-h-[44px] px-5 py-2 rounded-full font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ${cfg.primaryBtnClass}`}
              >
                <Sparkles className="w-4 h-4" />
                Place Ornament in Snow Globe 🔮
              </button>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="rounded-3xl bg-white/92 border border-black/10 p-5 space-y-4">
          {/* Today's Riddle Clue */}
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 inline-flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Today&apos;s Hiding Clue
              </p>
              <span className="text-[11px] font-mono-tabular font-bold text-amber-800/80">
                {checkedSpots.length}/{ELF_HIDING_SPOTS.length} spots checked
              </span>
            </div>
            <p className="text-sm sm:text-base font-semibold text-amber-950">
              &ldquo;{challenge.spotHint}&rdquo;
            </p>
          </div>

          {/* Interactive 6-Spot Scavenger Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Workshop hiding spots">
            {ELF_HIDING_SPOTS.map((spot) => {
              const wasChecked = checkedSpots.includes(spot.id);
              const isWiggling = wigglingSpot === spot.id;
              return (
                <motion.button
                  key={spot.id}
                  type="button"
                  disabled={catching || wasChecked}
                  animate={isWiggling ? { x: [-6, 6, -5, 5, 0] } : { x: 0 }}
                  transition={{ duration: 0.35 }}
                  onClick={() => void handleInspectSpot(spot.id)}
                  aria-label={`Search ${spot.label}${wasChecked ? ' (already checked, empty)' : ''}`}
                  className={`min-h-[68px] text-left rounded-2xl border p-3.5 flex items-center gap-3 transition-all ${
                    wasChecked
                      ? 'bg-slate-100/80 border-slate-200 opacity-60 cursor-default'
                      : 'bg-white hover:bg-emerald-50/70 border-slate-200 hover:border-emerald-400 hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${
                      wasChecked
                        ? 'bg-slate-200/70 border-slate-300/70 grayscale'
                        : 'bg-gradient-to-br from-emerald-50 to-amber-50 border-emerald-200'
                    }`}
                    aria-hidden="true"
                  >
                    {spot.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold text-sm sm:text-base text-slate-900 leading-tight">
                      {spot.label}
                    </p>
                    <p className="text-xs font-medium text-slate-600 mt-0.5">
                      {wasChecked
                        ? 'Checked — empty!'
                        : catching && spot.id === challenge.spotId
                          ? 'Catching the elf...'
                          : 'Tap to peek behind here'}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Decoy Feedback or Error */}
          <AnimatePresence mode="wait">
            {errorMsg ? (
              <motion.p
                key="elf-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs sm:text-sm font-semibold text-rose-800"
              >
                {errorMsg}
              </motion.p>
            ) : statusFeedback ? (
              <motion.p
                key={statusFeedback}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="status"
                className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-2.5 text-xs sm:text-sm font-semibold text-indigo-900"
              >
                🔍 {statusFeedback}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {/* Optional jump back to spot the live Peeking Elf in Workshop */}
          {onGoToWorkshopSpot && (
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-black/10">
              <p className="text-xs text-slate-600">
                Prefer spotting the live peeking elf (🧝👀) around Santa&apos;s Workshop?
              </p>
              <button
                type="button"
                onClick={() => {
                  playPopSound();
                  onGoToWorkshopSpot();
                }}
                className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${cfg.secondaryBtnClass}`}
              >
                <Compass className="w-3.5 h-3.5" />
                Hunt Live in Workshop
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ElfRewardModalProps {
  open: boolean;
  rewardTitle: string;
  rewardEmoji: string;
  joke: string;
  onClose: () => void;
  onOpenSnowGlobe?: () => void;
}

export const ElfRewardModal: React.FC<ElfRewardModalProps> = ({
  open,
  rewardTitle,
  rewardEmoji,
  joke,
  onClose,
  onOpenSnowGlobe,
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Hidden Elf Caught"
      >
        <motion.div
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm rounded-3xl bg-[#fffdf7] border-4 border-emerald-400 p-6 text-center space-y-4 shadow-2xl relative"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reward popup"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-5xl" aria-hidden="true">🧝 {rewardEmoji}</div>
          <h3 className="font-display text-2xl font-bold text-emerald-900">
            You Found the Hidden Elf!
          </h3>
          <p className="text-sm font-medium text-slate-700">&ldquo;{joke}&rdquo;</p>
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-bold text-emerald-900">
            🎁 Unlocked: {rewardTitle}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onOpenSnowGlobe && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSnowGlobe();
                }}
                className="min-h-[42px] px-5 py-2 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-display font-bold text-sm cursor-pointer"
              >
                Open Snow Globe 🔮
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-sm cursor-pointer"
            >
              Yay! Keep Exploring ✨
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
