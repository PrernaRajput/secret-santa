import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, AlertCircle, KeyRound, LifeBuoy } from 'lucide-react';
import { playChimeSound, playPopSound } from '../../utils/sound';
import { SessionRecoveryModal } from '../workshop/SessionRecoveryModal';

interface InvitationScreenProps {
  eventId: string;
  eventName: string;
  isLiveFirestoreEvent: boolean;
  inviteLabel?: string;
  inviteError?: string | null;
  hasPersonalToken: boolean;
  onUnwrapComplete: () => void;
  onRedeemManualToken: (token: string) => Promise<void>;
  onOpenAdmin: () => void;
}

const DOTS = Array.from({ length: 8 }, (_, i) => i);

export const InvitationScreen: React.FC<InvitationScreenProps> = ({
  eventId,
  eventName,
  isLiveFirestoreEvent,
  inviteLabel,
  inviteError,
  hasPersonalToken,
  onUnwrapComplete,
  onRedeemManualToken,
  onOpenAdmin,
}) => {
  const [phase, setPhase] = useState<'idle' | 'pop' | 'open' | 'letter'>('idle');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const handleUnwrap = () => {
    if (phase !== 'idle') return;
    playPopSound();
    setPhase('pop');

    window.setTimeout(() => {
      setPhase('open');
      playChimeSound();
    }, 320);

    window.setTimeout(() => {
      setPhase('letter');
    }, 820);

    window.setTimeout(() => {
      onUnwrapComplete();
    }, 1550);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setRedeeming(true);
    try {
      // Extract token query parameter if user pasted a full URL
      let extracted = manualToken.trim();
      try {
        if (extracted.includes('token=')) {
          const parsedUrl = new URL(extracted);
          extracted = parsedUrl.searchParams.get('token') || extracted;
        }
      } catch {
        const match = extracted.match(/token=([a-f0-9]+)/i);
        if (match) extracted = match[1];
      }
      await onRedeemManualToken(extracted);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070709] text-white flex flex-col justify-between px-4 py-6 sm:py-10 relative overflow-hidden">
      {/* Subtle top-right Admin access */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between text-xs text-stone-400">
        <span className="font-medium tracking-wide text-stone-500">{eventName}</span>
        <button
          type="button"
          onClick={onOpenAdmin}
          className="px-3 py-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
        >
          Admin Console
        </button>
      </div>

      {/* Main Warm-Cream Invitation Card matching design reference */}
      <main className="w-full max-w-2xl mx-auto my-auto py-6 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full rounded-[32px] bg-[#f6ead7] text-[#5e3824] px-6 sm:px-10 py-8 sm:py-10 shadow-[0_30px_80px_rgba(0,0,0,0.65)] relative overflow-hidden"
        >
          {/* Top Golden Dots */}
          <div className="flex items-center justify-between px-2 mb-8" aria-hidden="true">
            {DOTS.map((d) => (
              <span key={`top-${d}`} className="w-2.5 h-2.5 rounded-full bg-[#b98d62]" />
            ))}
          </div>

          {/* Animated 3D Red Envelope with Heart Wax Seal */}
          <div className="relative h-48 sm:h-56 flex items-center justify-center my-2">
            {/* Sparkles on Open */}
            <AnimatePresence>
              {(phase === 'open' || phase === 'letter') && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1.25 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <Sparkles className="w-40 h-40 text-amber-400/90" />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              animate={
                phase === 'idle'
                  ? { y: [0, -8, 0] }
                  : phase === 'pop'
                    ? { scale: 1.07, y: -4 }
                    : { scale: 1.04, y: 12 }
              }
              transition={
                phase === 'idle'
                  ? { repeat: Infinity, duration: 3.2, ease: 'easeInOut' }
                  : { duration: 0.35 }
              }
              className="relative w-56 sm:w-64 h-36 sm:h-40"
              style={{ perspective: 900 }}
            >
              {/* Rising Secret Letter */}
              <motion.div
                initial={{ y: 12, opacity: 0, scale: 0.92 }}
                animate={
                  phase === 'letter'
                    ? { y: -76, opacity: 1, scale: 1.05 }
                    : phase === 'open'
                      ? { y: -36, opacity: 1, scale: 0.98 }
                      : { y: 12, opacity: 0, scale: 0.92 }
                }
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-4 top-2 h-32 rounded-xl bg-[#fffdf8] border border-amber-300 shadow-lg flex flex-col items-center justify-center p-3 text-center z-10"
              >
                <span className="text-xl mb-1" aria-hidden="true">🎄</span>
                <p className="font-display font-bold text-sm text-[#7f1d1d]">
                  Top Secret Mission
                </p>
                <p className="text-[11px] text-[#78350f] mt-0.5">
                  {inviteLabel ? `For ${inviteLabel}` : 'Santa chose you!'}
                </p>
              </motion.div>

              {/* Envelope Body */}
              <div className="relative w-full h-full rounded-xl bg-[#ad323a] shadow-[0_14px_28px_rgba(94,56,36,0.28)] overflow-hidden z-20">
                {/* Envelope Fold Lines */}
                <svg
                  viewBox="0 0 260 164"
                  className="absolute inset-0 w-full h-full"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <polygon points="0,164 130,82 260,164" fill="#9a2a31" />
                  <line x1="0" y1="164" x2="130" y2="82" stroke="#f6ead7" strokeWidth="3.5" />
                  <line x1="260" y1="164" x2="130" y2="82" stroke="#f6ead7" strokeWidth="3.5" />
                </svg>

                {/* Top Envelope Flap with 3D Open Transform */}
                <motion.div
                  animate={{
                    rotateX: phase === 'open' || phase === 'letter' ? 168 : 0,
                  }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: 'top center', transformStyle: 'preserve-3d' }}
                  className="absolute inset-x-0 top-0 h-[56%] z-30"
                >
                  <svg viewBox="0 0 260 92" className="w-full h-full" preserveAspectRatio="none">
                    <polygon points="0,0 260,0 130,90" fill="#bd3d44" />
                    <polyline
                      points="0,0 130,90 260,0"
                      fill="none"
                      stroke="#f6ead7"
                      strokeWidth="3.5"
                    />
                  </svg>
                </motion.div>

                {/* Golden Heart Wax Seal */}
                <motion.div
                  animate={
                    phase === 'pop'
                      ? { scale: 1.32, rotate: -10 }
                      : phase === 'open' || phase === 'letter'
                        ? { scale: 0, opacity: 0 }
                        : { scale: 1, opacity: 1 }
                  }
                  transition={{ duration: 0.28 }}
                  className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-[#dfae56] shadow-md flex items-center justify-center z-40"
                >
                  <svg viewBox="0 0 32 32" className="w-8 h-8 fill-[#8c272e]" aria-hidden="true">
                    <path d="M16 27.5 C16 27.5 4 19.6 4 11.4 C4 7.4 7.1 4.5 10.8 4.5 C13.1 4.5 15 5.8 16 7.5 C17 5.8 18.9 4.5 21.2 4.5 C24.9 4.5 28 7.4 28 11.4 C28 19.6 16 27.5 16 27.5 Z" />
                  </svg>
                </motion.div>
              </div>
            </motion.div>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold text-center tracking-tight text-[#5e3824] mt-3">
            You&apos;ve been secretly invited!
          </h1>

          {inviteLabel && (
            <p className="text-center text-sm font-semibold text-[#8c272e] mt-1">
              Personal invite for {inviteLabel}
            </p>
          )}

          {/* Bottom Golden Dots */}
          <div className="flex items-center justify-between px-2 mt-8" aria-hidden="true">
            {DOTS.map((d) => (
              <span key={`bot-${d}`} className="w-2.5 h-2.5 rounded-full bg-[#b98d62]" />
            ))}
          </div>
        </motion.div>

        {/* Secondary Headline & Subtitle on Dark Canvas */}
        <div className="text-center mt-8 space-y-2.5 max-w-lg">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Psst... Santa needs you!
          </h2>
          <p className="text-sm sm:text-base text-stone-300 leading-relaxed">
            A little mystery. A little mischief. A whole lot of Christmas magic.
          </p>
        </div>

        {inviteError && (
          <div className="mt-5 w-full rounded-2xl bg-rose-950/80 border border-rose-500/40 px-4 py-3 text-sm text-rose-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <p>{inviteError}</p>
          </div>
        )}

        {/* Primary Muted Christmas-Red CTA */}
        <div className="w-full mt-7 space-y-4">
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            disabled={phase !== 'idle'}
            onClick={handleUnwrap}
            className="w-full min-h-[56px] rounded-2xl bg-[#a9333a] hover:bg-[#bc3941] text-white font-semibold text-base sm:text-lg shadow-[0_12px_30px_rgba(169,51,58,0.45)] transition-colors cursor-pointer disabled:opacity-80 flex items-center justify-center gap-2"
          >
            {phase === 'idle' ? 'Unwrap my invitation 🎁' : 'Opening your secret letter...'}
          </motion.button>

          {!hasPersonalToken && (
            <div className="text-center space-y-2.5">
              {!showTokenInput ? (
                <button
                  type="button"
                  onClick={() => setShowTokenInput(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Have a personal invitation link or token?
                </button>
              ) : (
                <form
                  onSubmit={handleManualSubmit}
                  className="mt-2 flex flex-col sm:flex-row gap-2 bg-white/5 border border-white/10 rounded-2xl p-2"
                >
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Paste your invitation link or 64-char token..."
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-stone-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={redeeming}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {redeeming ? 'Checking...' : 'Redeem'}
                  </button>
                </form>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setShowRecoveryModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-300/85 hover:text-amber-200 transition-colors cursor-pointer"
                >
                  <LifeBuoy className="w-3.5 h-3.5" />
                  Lost your invitation or switched devices?
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-stone-500 py-2">
        Made by Dheeraj and Prerna Pvt LTD
      </footer>

      <SessionRecoveryModal
        open={showRecoveryModal}
        eventId={eventId}
        liveMode={isLiveFirestoreEvent}
        onClose={() => setShowRecoveryModal(false)}
      />
    </div>
  );
};
