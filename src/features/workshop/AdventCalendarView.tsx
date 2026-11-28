import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Calendar, Lock, Sparkles, X } from 'lucide-react';
import {
  AdventDaySurprise,
  AdventUnlockRecord,
  SecretSantaEvent,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { ADVENT_SURPRISES } from '../../data/workshopContent';
import {
  fetchAdventUnlocks,
  unlockAdventDoor,
} from '../../services/workshopService';
import { getAdventDayStatus } from '../../utils/workshopLogic';
import { playChimeSound, playMagicSparkleSound, playPopSound } from '../../utils/sound';

interface AdventCalendarViewProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  participantKey: string;
  serverNow: Date;
  liveMode: boolean;
  onUnlockChanged?: (unlocks: AdventUnlockRecord[]) => void;
}

export const AdventCalendarView: React.FC<AdventCalendarViewProps> = ({
  theme,
  event,
  participantKey,
  serverNow,
  liveMode,
  onUnlockChanged,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [unlocks, setUnlocks] = useState<AdventUnlockRecord[]>([]);
  const [openingDay, setOpeningDay] = useState<number | null>(null);
  const [activeSurprise, setActiveSurprise] = useState<AdventDaySurprise | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdventUnlocks(participantKey, liveMode).then((list) => {
      if (active) {
        setUnlocks(list);
        onUnlockChanged?.(list);
      }
    });
    return () => {
      active = false;
    };
  }, [participantKey, liveMode, onUnlockChanged]);

  const unlockedDays = useMemo(() => new Set(unlocks.map((u) => u.day)), [unlocks]);

  const handleDoorClick = async (surprise: AdventDaySurprise) => {
    setErrorMsg(null);
    const status = getAdventDayStatus(surprise.day, event, serverNow, unlockedDays);

    if (status === 'unlocked') {
      playPopSound();
      setActiveSurprise(surprise);
      return;
    }

    if (status === 'locked') {
      playPopSound();
      const unlockDate = new Date(
        event.adventStartAt.getTime() + (surprise.day - 1) * 86_400_000
      );
      setErrorMsg(
        `Door #${surprise.day} is sealed by Santa's calendar until ${unlockDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        })}!`
      );
      return;
    }

    if (status === 'missed') {
      setErrorMsg(`Door #${surprise.day} closed when that day passed.`);
      return;
    }

    setOpeningDay(surprise.day);
    try {
      const res = await unlockAdventDoor({
        event,
        participantKey,
        day: surprise.day,
        serverNow,
        existingUnlockedDays: unlockedDays,
        liveMode,
      });
      if (!res.ok || !res.record) {
        setErrorMsg(res.error || 'Could not open this door right now.');
        return;
      }
      playMagicSparkleSound();
      playChimeSound();
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.55 },
        colors: cfg.confettiColors,
      });
      const updated = [...unlocks, res.record].sort((a, b) => a.day - b.day);
      setUnlocks(updated);
      onUnlockChanged?.(updated);
      setActiveSurprise(surprise);
    } finally {
      setOpeningDay(null);
    }
  };

  const earnedOrnaments = unlocks.filter((u) => Boolean(u.collectibleId));

  return (
    <div className="space-y-5">
      {/* Wooden Cottage Roof Header */}
      <div className="rounded-3xl bg-gradient-to-br from-[#5c2d0c] via-[#7c3f16] to-[#451a03] text-amber-50 p-5 border-2 border-amber-300/60 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300 inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              North Pole Advent Cottage
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Daily Advent Surprises 🎄
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/85">
              Tap unlocked wooden cottage doors to reveal jokes, trivia, fortunes &amp; Snow Globe ornaments!
            </p>
          </div>

          <div className="rounded-2xl bg-black/30 border border-amber-300/40 px-4 py-2 text-center">
            <p className="font-mono-tabular text-2xl font-extrabold text-amber-300">
              {unlocks.length}/25
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-100">
              Doors Opened
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-2.5 text-xs font-semibold text-amber-950 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 25 Swinging Wooden Cottage Doors Grid */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3" style={{ perspective: 900 }}>
        {ADVENT_SURPRISES.map((surprise) => {
          const status = getAdventDayStatus(surprise.day, event, serverNow, unlockedDays);
          const isOpen = status === 'unlocked';
          const isAvailable = status === 'available';
          const isOpening = openingDay === surprise.day;

          return (
            <button
              key={surprise.day}
              type="button"
              disabled={isOpening}
              onClick={() => void handleDoorClick(surprise)}
              aria-label={`Advent Door ${surprise.day}: ${
                isOpen
                  ? `Opened - ${surprise.title}`
                  : isAvailable
                    ? 'Available to open'
                    : 'Locked'
              }`}
              className={`relative aspect-square rounded-2xl border-2 overflow-hidden transition-transform active:scale-95 cursor-pointer flex flex-col items-center justify-center p-1.5 ${
                isOpen
                  ? 'bg-gradient-to-b from-amber-100 to-yellow-50 border-amber-400 shadow-inner'
                  : isAvailable
                    ? 'bg-gradient-to-b from-[#9a3412] to-[#7c2d12] border-amber-300 shadow-lg hover:-translate-y-0.5 ring-2 ring-amber-300/60'
                    : 'bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600/80 opacity-75'
              }`}
            >
              {/* Inner golden glow when opened */}
              {isOpen ? (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center text-center"
                >
                  <span className="text-xl sm:text-2xl leading-none" aria-hidden="true">
                    {surprise.emoji}
                  </span>
                  <span className="text-[10px] font-bold text-amber-950 mt-1">
                    Day {surprise.day}
                  </span>
                </motion.div>
              ) : (
                <>
                  {/* Snow cap */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-2 bg-white/80 rounded-b-full"
                  />
                  <span className="font-display text-lg sm:text-2xl font-extrabold text-amber-100 drop-shadow">
                    {surprise.day}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200/90 mt-0.5">
                    {isAvailable ? 'Tap ✨' : '🔒'}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Earned Snow Globe Ornaments Tray */}
      {earnedOrnaments.length > 0 && (
        <div className="rounded-2xl bg-white/85 border border-amber-200 p-4 space-y-2">
          <p className="font-display font-bold text-sm text-amber-950 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Collected Ornaments ({earnedOrnaments.length} ready for your Snow Globe!)
          </p>
          <div className="flex flex-wrap gap-2">
            {earnedOrnaments.map((o) => (
              <span
                key={o.id}
                className="px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-xs font-bold text-amber-950 inline-flex items-center gap-1.5"
              >
                <span>{o.collectibleEmoji}</span>
                <span>{o.collectibleName}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Surprise Reveal Popover Modal */}
      <AnimatePresence>
        {activeSurprise && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Advent Day ${activeSurprise.day} Surprise`}
          >
            <motion.div
              initial={{ scale: 0.85, rotateY: -25 }}
              animate={{ scale: 1, rotateY: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-gradient-to-b from-[#fffdf7] to-amber-50 border-4 border-amber-300 p-6 text-center space-y-4 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setActiveSurprise(null)}
                aria-label="Close surprise"
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-amber-200/70 hover:bg-amber-300 flex items-center justify-center text-amber-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-300 via-yellow-200 to-rose-200 flex items-center justify-center text-5xl shadow-lg">
                {activeSurprise.emoji}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-600">
                  Advent Day {activeSurprise.day} · {activeSurprise.kind}
                </p>
                <h3 className="font-display text-2xl font-bold text-slate-900">
                  {activeSurprise.title}
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed pt-1">
                  {activeSurprise.message}
                </p>
              </div>

              {activeSurprise.collectibleName && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-bold text-emerald-900">
                  🎁 Added &ldquo;{activeSurprise.collectibleName}&rdquo; to your Snow Globe ornament shelf!
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveSurprise(null)}
                className={`min-h-[44px] px-6 py-2 rounded-full font-display font-bold text-sm cursor-pointer ${cfg.primaryBtnClass}`}
              >
                Awesome! ✨
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
