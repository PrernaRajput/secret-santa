import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { ThemeId } from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { FestiveCharacters, ThemeCardTrim } from '../../components/themes/FestiveCharacters';
import { RUNAWAY_NO_MESSAGES } from '../../data/hobbies';
import { playBoingSound, playChimeSound } from '../../utils/sound';

interface JoinQuestionScreenProps {
  theme: ThemeId;
  onJoinYes: () => void;
  onLeave: () => void;
}

interface Coord {
  x: number; // percentage 14..86
  y: number; // percentage 22..82
}

const SAFE_SPOTS: Coord[] = [
  { x: 76, y: 50 },
  { x: 22, y: 30 },
  { x: 80, y: 26 },
  { x: 24, y: 76 },
  { x: 78, y: 78 },
  { x: 50, y: 26 },
  { x: 52, y: 78 },
  { x: 18, y: 54 },
  { x: 82, y: 52 },
];

export const JoinQuestionScreen: React.FC<JoinQuestionScreenProps> = ({
  theme,
  onJoinYes,
  onLeave,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const lastDodgeAtRef = useRef(0);

  const [noPos, setNoPos] = useState<Coord>({ x: 50, y: 55 });
  const [dodgeCount, setDodgeCount] = useState(0);
  const [joining, setJoining] = useState(false);

  const dodgeAwayFrom = useCallback(
    (pointerXPct?: number, pointerYPct?: number) => {
      const now = performance.now();
      if (now - lastDodgeAtRef.current < 160) return;
      lastDodgeAtRef.current = now;

      playBoingSound();
      setDodgeCount((c) => c + 1);

      setNoPos((current) => {
        // Pick a safe spot that is far from BOTH the current position AND the cursor
        const candidates = SAFE_SPOTS.filter((spot) => {
          const distFromCurrent = Math.hypot(spot.x - current.x, spot.y - current.y);
          if (distFromCurrent < 25) return false;
          if (pointerXPct !== undefined && pointerYPct !== undefined) {
            const distFromPointer = Math.hypot(spot.x - pointerXPct, spot.y - pointerYPct);
            return distFromPointer > 32;
          }
          return true;
        });

        const pool = candidates.length > 0 ? candidates : SAFE_SPOTS;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        return pick;
      });
    },
    []
  );

  /**
   * Desktop Web Proximity Radar:
   * Moves the NO button out of the cursor's reach BEFORE the cursor can ever hover it!
   */
  const handleArenaPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return; // Mobile uses touch/click dodge
    const arena = arenaRef.current;
    if (!arena) return;
    const rect = arena.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    const btnCenterX = (noPos.x / 100) * rect.width;
    const btnCenterY = (noPos.y / 100) * rect.height;
    const distancePx = Math.hypot(pointerX - btnCenterX, pointerY - btnCenterY);

    // Trigger dodge at 105px radius so the cursor can never land on the No button
    if (distancePx < 105) {
      const pctX = (pointerX / rect.width) * 100;
      const pctY = (pointerY / rect.height) * 100;
      dodgeAwayFrom(pctX, pctY);
    }
  };

  const handleYes = () => {
    if (joining) return;
    setJoining(true);
    playChimeSound();
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.62 },
      colors: cfg.confettiColors,
    });
    window.setTimeout(() => {
      onJoinYes();
    }, 680);
  };

  const activeMessage =
    dodgeCount > 0
      ? RUNAWAY_NO_MESSAGES[(dodgeCount - 1) % RUNAWAY_NO_MESSAGES.length]
      : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-2xl mx-auto flex flex-col items-center"
    >
      <FestiveCharacters
        theme={theme}
        mood={joining ? 'celebrating' : dodgeCount > 0 ? 'laughing' : 'happy'}
      />

      <div className={`w-full rounded-[28px] overflow-hidden -mt-4 ${cfg.cardClass}`}>
        <ThemeCardTrim theme={theme} />

        <div className="p-6 sm:p-8 text-center space-y-5">
          <div className="space-y-2">
            <h1 className={`font-display text-3xl sm:text-4xl font-bold text-balance ${cfg.cardText}`}>
              {theme === 'funny'
                ? 'Desi Secret Santa join karoge? 🥁🎁'
                : 'Ready to join Secret Santa? 🎁'}
            </h1>
            <p className={`text-sm sm:text-base font-medium ${cfg.mutedText}`}>
              {theme === 'funny'
                ? 'Chai thandi ho rahi hai, jaldi YES dabao! Santa Ji dekh rahe hain! 👀☕'
                : "There's only one correct answer. Santa is watching! 👀"}
            </p>
          </div>

          {/* Primary Glossy Green YES Button */}
          <div className="pt-1">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleYes}
              disabled={joining}
              className="w-full sm:w-auto sm:min-w-[300px] min-h-[58px] px-8 py-3.5 rounded-full btn-3d-green text-white font-display text-xl sm:text-2xl font-bold cursor-pointer inline-flex items-center justify-center gap-2"
            >
              {joining
                ? theme === 'funny'
                  ? 'Balle Balle! Swagat hai ji! 🎉'
                  : 'Yay! Welcome to Secret Santa! 🎉'
                : theme === 'funny'
                  ? 'YES — Balle Balle, Join Now! 🥁'
                  : 'YES — Join the magic! 🎅'}
            </motion.button>
          </div>

          {/* Funny Cartoon Speech Bubble reacting to NO attempts */}
          <div className="min-h-[46px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {activeMessage ? (
                <motion.div
                  key={dodgeCount}
                  initial={{ opacity: 0, scale: 0.82, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -4 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-amber-100 border-2 border-amber-300 text-amber-950 font-display font-bold text-sm sm:text-base shadow-sm"
                >
                  <span>{activeMessage}</span>
                </motion.div>
              ) : (
                <p className={`text-xs ${cfg.mutedText}`}>
                  {theme === 'funny'
                    ? 'Himmat hai toh "No" daba ke dikhao 😏🛺'
                    : 'Go ahead... try tapping “No” if you dare 😏'}
                </p>
              )}
            </AnimatePresence>
          </div>

          {/* Dedicated Runaway NO Playground Arena (seamless with card background, never overlaps YES) */}
          <div
            ref={arenaRef}
            onPointerMove={handleArenaPointerMove}
            className="relative w-full h-44 sm:h-48 bg-transparent border-0 overflow-hidden touch-none select-none"
          >
            {/* Subtle centered hint */}
            <div
              className={`pointer-events-none absolute inset-0 flex items-center justify-center opacity-30 text-xs font-display font-semibold tracking-wider ${cfg.mutedText}`}
            >
              {dodgeCount >= 3
                ? `No button dodges: ${dodgeCount} 💨`
                : theme === 'funny'
                  ? 'Pakad ke dikhao bhai! 🏃‍♂️'
                  : 'Catch me if you can!'}
            </div>

            {/* Runaway NO Button — impossible to hover on web, jumps on tap/click on mobile */}
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              animate={{
                left: `${noPos.x}%`,
                top: `${noPos.y}%`,
                x: '-50%',
                y: '-50%',
                rotate: dodgeCount % 2 === 0 ? -4 : 4,
              }}
              transition={{ type: 'spring', stiffness: 520, damping: 24 }}
              onPointerEnter={(e) => {
                if (e.pointerType !== 'touch') {
                  dodgeAwayFrom();
                }
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                dodgeAwayFrom();
              }}
              onClick={(e) => {
                e.preventDefault();
                dodgeAwayFrom();
              }}
              className="absolute min-h-[46px] px-6 py-2.5 rounded-full bg-gradient-to-b from-rose-400 to-rose-600 text-white font-display font-bold text-base shadow-[0_5px_0_#9f1239,0_8px_16px_rgba(159,18,57,0.3)] border border-rose-300/60 cursor-not-allowed whitespace-nowrap select-none"
            >
              No! 🏃‍♂️
            </motion.button>
          </div>

          {/* Explicit accessible opt-out link for keyboard/screen-reader consent */}
          <div className="pt-1">
            <button
              type="button"
              onClick={onLeave}
              className={`text-xs underline underline-offset-4 opacity-70 hover:opacity-100 transition-opacity cursor-pointer ${cfg.mutedText}`}
            >
              Not participating right now? Return to invitation
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
