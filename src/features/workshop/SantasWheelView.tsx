import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Award, Clock, RotateCw, Sparkles } from 'lucide-react';
import {
  DailyWheelSpinRecord,
  SecretSantaEvent,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { WHEEL_PRIZES } from '../../data/workshopContent';
import {
  fetchRecentWheelSpins,
  fetchTodayWheelSpin,
  spinSantasWheel,
} from '../../services/workshopService';
import { playChimeSound, playWheelTickSound } from '../../utils/sound';

interface SantasWheelViewProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  participantKey: string;
  serverNow: Date;
  dateKey: string;
  liveMode: boolean;
  onSpinComplete?: (spins: DailyWheelSpinRecord[]) => void;
}

export const SantasWheelView: React.FC<SantasWheelViewProps> = ({
  theme,
  event,
  participantKey,
  serverNow,
  dateKey,
  liveMode,
  onSpinComplete,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [todaySpin, setTodaySpin] = useState<DailyWheelSpinRecord | null>(null);
  const [history, setHistory] = useState<DailyWheelSpinRecord[]>([]);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchTodayWheelSpin(participantKey, dateKey, liveMode),
      fetchRecentWheelSpins(participantKey, serverNow, event.timezone, liveMode),
    ]).then(([today, recent]) => {
      if (!active) return;
      setTodaySpin(today);
      setHistory(recent);
      onSpinComplete?.(recent);
    });
    return () => {
      active = false;
    };
  }, [participantKey, dateKey, serverNow, event.timezone, liveMode, onSpinComplete]);

  const segmentAngle = 360 / WHEEL_PRIZES.length;

  const handleSpin = async () => {
    if (spinning || todaySpin) return;
    setError(null);
    setSpinning(true);

    // Subtle tick ticks while spinning
    const tickInterval = window.setInterval(() => playWheelTickSound(), 170);

    try {
      const res = await spinSantasWheel({
        event,
        participantKey,
        dateKey,
        liveMode,
      });

      if (!res.ok || !res.record) {
        window.clearInterval(tickInterval);
        setSpinning(false);
        setError(res.error || 'Could not spin right now.');
        return;
      }

      const targetSlot = res.record.slotIndex;
      // Pointer sits at 12 o'clock (-90deg in SVG coordinates; segment 0 centered at segmentAngle/2)
      const slotCenterDeg = targetSlot * segmentAngle + segmentAngle / 2;
      const finalDeg = 360 * 5 + (360 - slotCenterDeg);
      setRotationDeg(finalDeg);

      window.setTimeout(() => {
        window.clearInterval(tickInterval);
        setSpinning(false);
        setTodaySpin(res.record!);
        const nextHistory = [res.record!, ...history.filter((h) => h.id !== res.record!.id)];
        setHistory(nextHistory);
        onSpinComplete?.(nextHistory);
        playChimeSound();
        confetti({
          particleCount: 75,
          spread: 75,
          origin: { y: 0.55 },
          colors: cfg.confettiColors,
        });
      }, 3600);
    } catch {
      window.clearInterval(tickInterval);
      setSpinning(false);
      setError('Wheel spin interrupted. Please try again.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-rose-600 inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          1 Free Festive Spin Per Day · Fun Cosmetics Only
        </p>
        <h2 className={`font-display text-2xl sm:text-3xl font-bold ${cfg.cardText}`}>
          Spin Santa&apos;s Wheel 🎡
        </h2>
        <p className={`text-xs sm:text-sm ${cfg.mutedText}`}>
          Win holiday fortunes, goofy titles, Snow Globe ornaments, and festive badges!
        </p>
      </div>

      {/* Interactive 3D-Shaded Prize Wheel */}
      <div className="relative mx-auto w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
        {/* Top Golden Pointer Triangle */}
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 drop-shadow-md"
          aria-hidden="true"
        >
          <svg width="32" height="32" viewBox="0 0 32 32">
            <polygon points="16,30 4,4 28,4" fill="#fbbf24" stroke="#78350f" strokeWidth="3" />
          </svg>
        </div>

        {/* Outer Bulb Rim */}
        <div className="w-full h-full rounded-full p-2.5 bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 shadow-2xl">
          <motion.svg
            viewBox="0 0 200 200"
            className="w-full h-full rounded-full"
            animate={{ rotate: rotationDeg }}
            transition={{ duration: 3.5, ease: [0.16, 1, 0.25, 1] }}
          >
            {WHEEL_PRIZES.map((prize, idx) => {
              const startRad = ((idx * segmentAngle - 90) * Math.PI) / 180;
              const endRad = (((idx + 1) * segmentAngle - 90) * Math.PI) / 180;
              const x1 = 100 + 98 * Math.cos(startRad);
              const y1 = 100 + 98 * Math.sin(startRad);
              const x2 = 100 + 98 * Math.cos(endRad);
              const y2 = 100 + 98 * Math.sin(endRad);
              const midAngle = idx * segmentAngle + segmentAngle / 2;

              return (
                <g key={prize.id}>
                  <path
                    d={`M 100 100 L ${x1} ${y1} A 98 98 0 0 1 ${x2} ${y2} Z`}
                    fill={prize.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <g transform={`rotate(${midAngle}, 100, 100)`}>
                    <text
                      x="100"
                      y="32"
                      textAnchor="middle"
                      fontSize="16"
                    >
                      {prize.emoji}
                    </text>
                    <text
                      x="100"
                      y="49"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="7.5"
                      fontWeight="700"
                    >
                      {prize.shortLabel.replace(/\s[^\w]+$/, '')}
                    </text>
                  </g>
                </g>
              );
            })}
            {/* Center Hub */}
            <circle cx="100" cy="100" r="22" fill="#fffdf7" stroke="#b45309" strokeWidth="4" />
            <text x="100" y="106" textAnchor="middle" fontSize="16">
              🎅
            </text>
          </motion.svg>
        </div>
      </div>

      {/* Spin Action Button */}
      <div className="text-center space-y-2.5">
        <motion.button
          type="button"
          whileHover={!todaySpin && !spinning ? { scale: 1.03 } : undefined}
          whileTap={!todaySpin && !spinning ? { scale: 0.96 } : undefined}
          disabled={spinning || Boolean(todaySpin)}
          onClick={() => void handleSpin()}
          className={`min-h-[50px] px-8 py-3 rounded-full font-display text-lg font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${cfg.primaryBtnClass}`}
        >
          <RotateCw className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`} />
          {spinning
            ? "Spinning Santa's Wheel..."
            : todaySpin
              ? 'Daily Spin Claimed! Come Back Tomorrow'
              : "Spin Santa's Wheel! 🎡"}
        </motion.button>

        {todaySpin && (
          <p className={`text-xs font-semibold inline-flex items-center gap-1.5 ${cfg.mutedText}`}>
            <Clock className="w-3.5 h-3.5" />
            Next free spin resets at midnight ({event.timezone})
          </p>
        )}
      </div>

      {error && (
        <p className="text-center text-xs font-semibold text-rose-700">{error}</p>
      )}

      {/* Today's Result Card */}
      {todaySpin && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="rounded-3xl bg-gradient-to-r from-amber-50 via-yellow-50 to-rose-50 border-2 border-amber-300 p-5 text-center space-y-2 shadow-sm"
        >
          <span className="text-4xl block" aria-hidden="true">{todaySpin.prizeEmoji}</span>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Today&apos;s Wheel Result ({todaySpin.dateKey})
          </p>
          <h3 className="font-display text-2xl font-bold text-slate-900">
            {todaySpin.prizeLabel}
          </h3>
          <p className="text-sm text-slate-700 max-w-md mx-auto">
            {todaySpin.prizeMessage}
          </p>
          {todaySpin.collectibleName && (
            <p className="text-xs font-bold text-emerald-700 pt-1">
              🏅 Unlocked collectible: {todaySpin.collectibleName}
            </p>
          )}
        </motion.div>
      )}

      {/* Recent Wheel Badge Shelf */}
      {history.length > 0 && (
        <div className="rounded-2xl bg-white/85 border border-black/10 p-4 space-y-2">
          <p className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-600" />
            Your Recent Wheel Wins
          </p>
          <div className="flex flex-wrap gap-2">
            {history.map((item) => (
              <span
                key={item.id}
                className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-950"
              >
                {item.prizeEmoji} {item.prizeLabel} ({item.dateKey})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
