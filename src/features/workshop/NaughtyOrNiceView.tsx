import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Check, Copy, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import {
  NaughtyNiceQuizResult,
  ParticipantProfile,
  SecretSantaEvent,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { AvatarGraphic } from '../../components/avatars/AvatarGraphic';
import { NAUGHTY_NICE_QUESTIONS } from '../../data/workshopContent';
import {
  fetchQuizResult,
  saveQuizResult,
} from '../../services/workshopService';
import {
  buildSafeQuizShareText,
  scoreNaughtyOrNiceQuiz,
} from '../../utils/workshopLogic';
import { playChimeSound, playPopSound } from '../../utils/sound';

interface NaughtyOrNiceViewProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  participant: ParticipantProfile;
  liveMode: boolean;
}

export const NaughtyOrNiceView: React.FC<NaughtyOrNiceViewProps> = ({
  theme,
  event,
  participant,
  liveMode,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [savedResult, setSavedResult] = useState<NaughtyNiceQuizResult | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [scanning, setScanning] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchQuizResult(participant.id, liveMode).then((res) => {
      if (active && res) setSavedResult(res);
    });
    return () => {
      active = false;
    };
  }, [participant.id, liveMode]);

  const handleSelectOption = (optionIdx: number) => {
    if (scanning) return;
    playPopSound();
    setSaveNotice(null);

    const nextAnswers = [...answers.slice(0, stepIdx), optionIdx];
    setAnswers(nextAnswers);

    if (stepIdx + 1 < NAUGHTY_NICE_QUESTIONS.length) {
      setStepIdx((i) => i + 1);
      return;
    }

    // Run festive scanner animation over avatar
    setScanning(true);
    const scored = scoreNaughtyOrNiceQuiz(nextAnswers);

    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
    }

    scanTimerRef.current = window.setTimeout(async () => {
      try {
        const saved = await saveQuizResult(
          {
            eventId: event.id,
            participantKey: participant.id,
            ...scored,
          },
          liveMode
        );
        if (!mountedRef.current) return;
        setSavedResult(saved);
        setRetaking(false);
        playChimeSound();
      } catch {
        if (!mountedRef.current) return;
        // Never leave the user stuck on the scanner — show their computed verdict locally
        setSavedResult({
          eventId: event.id,
          participantKey: participant.id,
          ...scored,
          completedAt: new Date(),
        });
        setRetaking(false);
        setSaveNotice(
          'Your verdict is ready! Cloud sync is currently unavailable (retakes may be locked by the organizer).'
        );
        playChimeSound();
      } finally {
        if (mountedRef.current) {
          setScanning(false);
        }
      }
    }, 1500);
  };

  const handleCopyShareCard = async () => {
    if (!savedResult) return;
    const safeText = buildSafeQuizShareText(participant.name, savedResult);
    try {
      await navigator.clipboard.writeText(safeText);
      setCopiedShare(true);
      playPopSound();
      window.setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      setCopiedShare(false);
    }
  };

  if (!event.quizEnabled) {
    return (
      <div className="rounded-3xl bg-white/90 border border-black/10 p-6 text-center space-y-2">
        <h2 className={`font-display text-2xl font-bold ${cfg.cardText}`}>
          Santa&apos;s Naughty or Nice Meter 🎅
        </h2>
        <p className="text-sm text-slate-600">
          This mini-game is currently paused by the event organizer.
        </p>
      </div>
    );
  }

  const showResult = Boolean(savedResult && !retaking && !scanning);
  // Left = 100% Nice (0% Mischief, -90deg), Top = 50/50 (0deg), Right = 100% Naughty (+90deg)
  const mischiefRatio = savedResult
    ? Math.max(0.02, Math.min(0.98, savedResult.naughtyPercent / 100))
    : 0.5;
  const needleAngle = -90 + mischiefRatio * 180;
  // Semicircle path radius = 88 -> exact arc length = PI * 88
  const gaugeArcLength = Math.PI * 88;
  const targetDashOffset = gaugeArcLength * (1 - mischiefRatio);

  const verdictTier = savedResult
    ? savedResult.nicePercent >= 68
      ? 'nice'
      : savedResult.nicePercent >= 45
        ? 'mixed'
        : 'naughty'
    : 'nice';

  const stampStyleClass =
    verdictTier === 'nice'
      ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
      : verdictTier === 'mixed'
        ? 'border-amber-600 text-amber-800 bg-amber-50'
        : 'border-rose-600 text-rose-700 bg-rose-50';

  const scoreTextClass =
    verdictTier === 'nice'
      ? 'text-emerald-700'
      : verdictTier === 'mixed'
        ? 'text-amber-700'
        : 'text-rose-600';

  const currentQuestion =
    NAUGHTY_NICE_QUESTIONS[Math.min(stepIdx, NAUGHTY_NICE_QUESTIONS.length - 1)];

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-700 inline-flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          Entertainment Only · North Pole Compliance Scanner
        </p>
        <h2 className={`font-display text-2xl sm:text-3xl font-bold ${cfg.cardText}`}>
          Santa&apos;s Naughty or Nice Meter 🎅
        </h2>
      </div>

      {scanning ? (
        <div className="rounded-3xl bg-slate-950 text-white p-8 text-center space-y-5 relative overflow-hidden">
          <div className="relative w-32 h-32 mx-auto rounded-3xl bg-white/10 p-2 overflow-hidden border-2 border-emerald-400/70">
            <AvatarGraphic
              avatarId={participant.avatarId}
              size={112}
              hasGoldenCrown={Boolean(participant.hasGoldenDetectiveCrown)}
            />
            {/* Animated Laser Scanner Bar */}
            <motion.div
              animate={{ top: ['0%', '92%', '0%'] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
              className="absolute inset-x-0 h-1.5 bg-emerald-400 shadow-[0_0_14px_#34d399]"
            />
          </div>
          <div className="space-y-1">
            <p className="font-display text-xl font-bold text-emerald-300">
              Scanning Holiday Aura...
            </p>
            <p className="text-xs text-slate-300">
              Consulting Rudolph&apos;s clipboard &amp; cookie theft records...
            </p>
          </div>
        </div>
      ) : showResult && savedResult ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-gradient-to-b from-white to-amber-50/90 border-2 border-amber-300 p-5 sm:p-6 space-y-5 text-center shadow-lg relative overflow-hidden"
        >
          {/* Official Stamp */}
          <motion.div
            initial={{ scale: 2, rotate: -18, opacity: 0 }}
            animate={{ scale: 1, rotate: -8, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`inline-block px-4 py-1 rounded-xl border-2 font-display font-extrabold text-xs tracking-widest uppercase ${stampStyleClass}`}
          >
            {savedResult.stampLabel}
          </motion.div>

          {/* Animated Semi-Circle Gauge: Nice (Green, Left) -> Naughty (Red, Right), filled up to indicator */}
          <div className="mx-auto w-64 space-y-1">
            <div className="relative w-64 h-32 mx-auto overflow-hidden">
              <svg viewBox="0 0 220 120" className="w-full h-full" aria-hidden="true">
                <defs>
                  <linearGradient id="niceToNaughtyGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="48%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>

                {/* Neutral Background Track */}
                <path
                  d="M 22 108 A 88 88 0 0 1 198 108"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="16"
                  strokeLinecap="round"
                />

                {/* Active Colored Arc Filled Strictly Up To Needle Indicator */}
                <motion.path
                  d="M 22 108 A 88 88 0 0 1 198 108"
                  fill="none"
                  stroke="url(#niceToNaughtyGrad)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={gaugeArcLength}
                  initial={{ strokeDashoffset: gaugeArcLength }}
                  animate={{ strokeDashoffset: targetDashOffset }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16 }}
                />

                {/* Subtle tick marks */}
                <line x1="110" y1="8" x2="110" y2="16" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="48" y1="36" x2="54" y2="42" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                <line x1="172" y1="36" x2="166" y2="42" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
              </svg>

              {/* Dedicated HTML/CSS Pivot Needle centered exactly on (50%, 108/120 = 90%) */}
              <motion.div
                initial={{ rotate: -90 }}
                animate={{ rotate: needleAngle }}
                transition={{ type: 'spring', stiffness: 120, damping: 16 }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: '10%',
                  width: 6,
                  height: 78,
                  marginLeft: -3,
                  transformOrigin: '50% 100%',
                }}
                className="rounded-full bg-slate-900 shadow-sm pointer-events-none"
                aria-hidden="true"
              />
              {/* Center Hub Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: '10%',
                  width: 18,
                  height: 18,
                  marginLeft: -9,
                  marginBottom: -9,
                }}
                className="rounded-full bg-slate-900 border-2 border-amber-300 shadow pointer-events-none"
                aria-hidden="true"
              />
            </div>

            <div className="flex items-center justify-between px-3 text-xs font-extrabold uppercase tracking-wide">
              <span className="text-emerald-700">😇 Nice</span>
              <span className="text-rose-600">Naughty 😈</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className={`font-mono-tabular text-sm font-extrabold ${scoreTextClass}`}>
              {savedResult.nicePercent}% Nice · {savedResult.naughtyPercent}% Mischief
            </p>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              {savedResult.verdictTitle}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {savedResult.verdictSubtitle}
            </p>
          </div>

          {saveNotice && (
            <div className="rounded-2xl bg-amber-100/80 border border-amber-300 px-3.5 py-2 text-xs text-amber-950 inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
              <span>{saveNotice}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => void handleCopyShareCard()}
              className={`min-h-[44px] px-5 py-2 rounded-full font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ${cfg.primaryBtnClass}`}
            >
              {copiedShare ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedShare ? 'Safe Result Copied!' : 'Copy Shareable Result'}
            </button>

            {event.quizAllowRetake && (
              <button
                type="button"
                onClick={() => {
                  playPopSound();
                  setSaveNotice(null);
                  setStepIdx(0);
                  setAnswers([]);
                  setRetaking(true);
                }}
                className={`min-h-[44px] px-5 py-2 rounded-full font-semibold text-sm inline-flex items-center gap-2 cursor-pointer ${cfg.secondaryBtnClass}`}
              >
                <RefreshCw className="w-4 h-4" />
                Retake Quiz
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 inline-flex items-center gap-1 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Purely for festive fun — never affects Secret Santa matching &amp; shares zero private info.
          </p>
        </motion.div>
      ) : (
        <div className="rounded-3xl bg-white/90 border border-black/10 p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              Question {stepIdx + 1} of {NAUGHTY_NICE_QUESTIONS.length}
            </span>
            <span className="font-mono-tabular">
              {Math.round(((stepIdx + 1) / NAUGHTY_NICE_QUESTIONS.length) * 100)}%
            </span>
          </div>

          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-300"
              style={{ width: `${((stepIdx + 1) / NAUGHTY_NICE_QUESTIONS.length) * 100}%` }}
            />
          </div>

          <h3 className={`font-display text-xl sm:text-2xl font-bold ${cfg.cardText}`}>
            {currentQuestion.question}
          </h3>

          <div className="grid grid-cols-1 gap-2.5">
            {currentQuestion.options.map((opt, idx) => (
              <motion.button
                key={opt.label}
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={scanning}
                onClick={() => handleSelectOption(idx)}
                className="min-h-[48px] px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-400 text-left text-sm font-semibold text-slate-800 transition-colors cursor-pointer disabled:opacity-60"
              >
                {opt.label}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
