import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  FileSearch,
  HelpCircle,
  Lock,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  PublicRosterEntry,
  SantaGuessItem,
  SantaIdentityReveal,
  SecretSantaEvent,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { AvatarGraphic } from '../../components/avatars/AvatarGraphic';
import {
  fetchMySantaGuesses,
  submitSantaGuess,
} from '../../services/workshopService';
import { isSenderIdentityRevealAuthorized } from '../../utils/workshopLogic';
import { playChimeSound, playPopSound } from '../../utils/sound';

interface GuessYourSantaViewProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  participantKey: string;
  selfPublicId: string;
  roster: PublicRosterEntry[];
  santaReveal: SantaIdentityReveal | null;
  serverNow: Date;
  liveMode: boolean;
}

export const GuessYourSantaView: React.FC<GuessYourSantaViewProps> = ({
  theme,
  event,
  participantKey,
  selfPublicId,
  roster,
  santaReveal,
  serverNow,
  liveMode,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [guesses, setGuesses] = useState<SantaGuessItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [latestReaction, setLatestReaction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const maxGuesses = Math.max(1, Math.min(10, event.maxGuesses || 3));
  const eligibleSuspects = roster.filter((entry) => entry.publicId !== selfPublicId);
  const revealAuthorized = isSenderIdentityRevealAuthorized(event, serverNow) && Boolean(santaReveal);

  useEffect(() => {
    let active = true;
    fetchMySantaGuesses(participantKey, event.id, liveMode).then((rec) => {
      if (active && rec) {
        setGuesses(rec.guesses);
      }
    });
    return () => {
      active = false;
    };
  }, [participantKey, event.id, liveMode]);

  const handleLockGuess = async () => {
    const candidate = eligibleSuspects.find((s) => s.publicId === selectedId);
    if (!candidate || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await submitSantaGuess({
        event,
        participantKey,
        selfPublicId,
        candidate,
        roster,
        existingGuesses: guesses,
        liveMode,
      });
      if (!res.ok || !res.record) {
        setError(res.error || 'Could not record your guess.');
        return;
      }
      playPopSound();
      setGuesses(res.record.guesses);
      setLatestReaction(res.reaction || 'Evidence filed! Mystery remains! 🕵️');
      setSelectedId('');
    } finally {
      setSubmitting(false);
    }
  };

  const guessedCorrectlyAfterReveal =
    revealAuthorized &&
    santaReveal &&
    guesses.some(
      (g) =>
        (santaReveal.santaPublicId && g.guessedPublicId === santaReveal.santaPublicId) ||
        g.guessedName.toLowerCase() === santaReveal.santaName.toLowerCase()
    );

  const guessesLeft = Math.max(0, maxGuesses - guesses.length);

  return (
    <div className="space-y-5">
      {/* Detective Board Header with Rudolph & Magnifying Glass */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/80 border-2 border-amber-300/80 p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Detective Rudolph SVG */}
          <motion.div
            animate={{ rotate: selectedId ? [0, -5, 5, 0] : [0, -2, 2, 0] }}
            transition={{ repeat: Infinity, duration: 3.4 }}
            className="w-24 h-24 shrink-0 rounded-2xl bg-amber-900/10 border border-amber-400/40 flex items-center justify-center relative"
          >
            <svg viewBox="0 0 100 100" className="w-20 h-20" aria-hidden="true">
              {/* Antlers */}
              <path d="M32 30 L20 12 M26 20 L16 22 M68 30 L80 12 M74 20 L84 22" stroke="#78350f" strokeWidth="4.5" strokeLinecap="round" />
              {/* Detective Cap */}
              <ellipse cx="50" cy="30" rx="22" ry="9" fill="#475569" />
              <path d="M32 29 Q50 14 68 29 Z" fill="#334155" />
              {/* Rudolph Head */}
              <ellipse cx="50" cy="54" rx="22" ry="20" fill="#a16207" />
              <circle cx="42" cy="49" r="3.5" fill="#1e293b" />
              <circle cx="58" cy="49" r="3.5" fill="#1e293b" />
              {/* Glowing Red Nose */}
              <circle cx="50" cy="59" r="6" fill="#dc2626" />
              <circle cx="48" cy="57" r="2" fill="#fca5a5" />
              {/* Magnifying Glass */}
              <motion.g
                animate={{ x: selectedId ? 6 : 0, y: selectedId ? -4 : 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              >
                <circle cx="72" cy="64" r="11" fill="#e0f2fe" fillOpacity="0.65" stroke="#0f172a" strokeWidth="3.5" />
                <line x1="80" y1="72" x2="90" y2="84" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
              </motion.g>
            </svg>
            <span className="absolute -top-1 -right-1 text-lg font-display font-bold text-amber-800">?</span>
          </motion.div>

          <div className="text-center sm:text-left space-y-1 flex-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
              <FileSearch className="w-3.5 h-3.5" />
              North Pole Detective Board
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-amber-950">
              Guess Your Secret Santa 🕵️
            </h2>
            <p className="text-xs sm:text-sm text-amber-900/80">
              You get <strong className="font-bold">{maxGuesses} detective guesses</strong> before Reveal Day.
              Rudolph keeps a poker face — zero hints on whether you&apos;re right until the Grand Identity Reveal!
            </p>
          </div>

          <div className="rounded-2xl bg-white/90 border border-amber-300 px-4 py-2.5 text-center shrink-0">
            <p className="font-mono-tabular text-2xl font-extrabold text-amber-900">
              {guessesLeft}/{maxGuesses}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Guesses Left
            </p>
          </div>
        </div>
      </div>

      {/* Post-Reveal Official Detective Verdict (ONLY after santaIdentityRevealAt!) */}
      {revealAuthorized && santaReveal && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          onAnimationComplete={() => playChimeSound()}
          className="rounded-3xl bg-gradient-to-r from-emerald-50 via-amber-50 to-purple-50 border-2 border-emerald-400 p-5 text-center space-y-3"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            Official Case Closed · Identity Reveal Unlocked
          </p>
          <h3 className="font-display text-2xl font-bold text-slate-900">
            {guessedCorrectlyAfterReveal
              ? `Master Detective! You nailed it — ${santaReveal.santaName} was your Santa! 🏆`
              : `Plot Twist! Your Secret Santa was ${santaReveal.santaName}! 🎅`}
          </h3>
          <div className="inline-flex items-center gap-3 bg-white rounded-2xl px-4 py-2.5 border border-emerald-200 shadow-sm">
            <AvatarGraphic avatarId={santaReveal.santaAvatarId} size={46} />
            <div className="text-left">
              <p className="font-display font-bold text-base text-slate-900">{santaReveal.santaName}</p>
              <p className="text-xs text-slate-600">Official Secret Santa</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Funny Neutral Detective Reaction Toast (strictly non-revealing!) */}
      <AnimatePresence>
        {latestReaction && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
            className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm font-semibold text-indigo-950 flex items-center gap-2.5"
          >
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{latestReaction}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submitted Case Files (Always Neutral Styling before reveal!) */}
      {guesses.length > 0 && (
        <div className="space-y-2">
          <h3 className={`font-display text-base font-bold ${cfg.cardText}`}>
            Your Sealed Detective Guesses
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {guesses.map((g, idx) => {
              const isMatchAfterReveal =
                revealAuthorized &&
                santaReveal &&
                ((santaReveal.santaPublicId && g.guessedPublicId === santaReveal.santaPublicId) ||
                  g.guessedName.toLowerCase() === santaReveal.santaName.toLowerCase());

              return (
                <div
                  key={`${g.guessedPublicId}-${idx}`}
                  className={`rounded-2xl border p-3 flex items-center gap-3 ${
                    isMatchAfterReveal
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-white/90 border-amber-200'
                  }`}
                >
                  <AvatarGraphic avatarId={g.guessedAvatarId} size={42} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                      Case #{idx + 1}
                    </p>
                    <p className="font-display font-bold text-sm text-slate-900 truncate">
                      {g.guessedName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {revealAuthorized
                        ? isMatchAfterReveal
                          ? 'Matched! 🎉'
                          : 'Red herring 🕵️'
                        : 'Sealed until Reveal Day 🔒'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suspect Selection Grid */}
      {!revealAuthorized && guessesLeft > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={`font-display text-base font-bold ${cfg.cardText}`}>
              Pick a Suspect from the Event Roster
            </h3>
            <span className={`text-xs font-medium ${cfg.mutedText}`}>
              {eligibleSuspects.length} suspects
            </span>
          </div>

          {eligibleSuspects.length === 0 ? (
            <div className="rounded-2xl bg-white/80 border border-black/10 p-5 text-center text-sm text-slate-600">
              Suspect roster will populate automatically as soon as participants are matched!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {eligibleSuspects.map((person) => {
                const alreadyGuessed =
                  !event.allowDuplicateGuesses &&
                  guesses.some((g) => g.guessedPublicId === person.publicId);
                const selected = selectedId === person.publicId;

                return (
                  <button
                    key={person.publicId}
                    type="button"
                    disabled={alreadyGuessed}
                    onClick={() => {
                      playPopSound();
                      setSelectedId(person.publicId);
                      setError(null);
                    }}
                    className={`rounded-2xl border p-3 flex items-center gap-2.5 text-left transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      selected
                        ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400/60 shadow-md -translate-y-0.5'
                        : 'bg-white/85 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <AvatarGraphic avatarId={person.avatarId} size={40} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                        {person.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {alreadyGuessed ? 'Already suspected' : selected ? 'Under magnifying glass' : 'Tap to inspect'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Guesses are final and reveal zero accuracy clues until Reveal Day.
            </p>
            <button
              type="button"
              disabled={!selectedId || submitting}
              onClick={() => void handleLockGuess()}
              className={`min-h-[44px] px-6 py-2 rounded-full font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-45 ${cfg.primaryBtnClass}`}
            >
              <Search className="w-4 h-4" />
              {submitting ? 'Filing Case...' : 'Stamp Detective Guess'}
            </button>
          </div>
        </div>
      )}

      {!revealAuthorized && guessesLeft === 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm font-semibold text-amber-950 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0 text-amber-700" />
          <span>
            All {maxGuesses} guesses are sealed in Rudolph&apos;s vault! Check back on Secret Santa Identity Reveal Day for your detective score!
          </span>
        </div>
      )}

      {revealAuthorized && !santaReveal && (
        <div className="rounded-2xl bg-slate-100 border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Waiting for the organizer to publish live match reveals.</span>
        </div>
      )}
    </div>
  );
};
