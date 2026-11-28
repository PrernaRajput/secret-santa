import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Crown, Eye, Sparkles } from 'lucide-react';
import { AvatarGraphic } from '../avatars/AvatarGraphic';
import { playPopSound } from '../../utils/sound';

interface GoldenSecretEnvelopeProps {
  participantName: string;
  participantAvatarId: string;
  alreadyOpened: boolean;
  compact?: boolean;
  onOpenEnvelope: () => void;
}

/**
 * The 1% Santa Secret — Mysterious Golden Envelope.
 * Unlocked exclusively when a participant correctly guesses their Secret Santa.
 * Breaking the wax seal briefly transforms the entire website into a hidden
 * golden Christmas world and permanently awards the Golden Detective Crown.
 */
export const GoldenSecretEnvelope: React.FC<GoldenSecretEnvelopeProps> = ({
  participantName,
  participantAvatarId,
  alreadyOpened,
  compact = false,
  onOpenEnvelope,
}) => {
  const [unsealing, setUnsealing] = useState(false);

  const handleTrigger = () => {
    if (unsealing) return;
    playPopSound();
    setUnsealing(true);
    window.setTimeout(() => {
      onOpenEnvelope();
      setUnsealing(false);
    }, alreadyOpened ? 160 : 420);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl border border-amber-400/60 bg-gradient-to-br from-[#1b1305] via-[#120c03] to-[#261905] text-amber-50 shadow-[0_20px_50px_rgba(180,120,10,0.28)]"
    >
      {/* Subtle brushed-gold ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-48 rounded-full bg-amber-400/18 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(253,224,71,0.12),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(245,158,11,0.14),transparent_48%)]"
      />

      <div
        className={`relative z-10 flex flex-col sm:flex-row items-center gap-5 ${
          compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
        }`}
      >
        {/* Interactive 3D Golden Envelope or Crowned Avatar Showcase */}
        <button
          type="button"
          onClick={handleTrigger}
          aria-label={
            alreadyOpened
              ? 'Replay the hidden golden Christmas world'
              : 'Open the mysterious golden envelope'
          }
          className="group relative shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 rounded-2xl"
        >
          {alreadyOpened ? (
            <div className="relative p-1.5 rounded-3xl bg-gradient-to-br from-amber-300/30 via-yellow-500/15 to-amber-700/30 border border-amber-300/50 transition-transform duration-200 group-hover:scale-105">
              <AvatarGraphic
                avatarId={participantAvatarId}
                size={compact ? 72 : 84}
                hasGoldenCrown
              />
            </div>
          ) : (
            <motion.div
              animate={
                unsealing
                  ? { scale: [1, 1.08, 1.02], rotate: [0, -2, 2, 0] }
                  : { y: [0, -3, 0] }
              }
              transition={
                unsealing
                  ? { duration: 0.42 }
                  : { repeat: Infinity, duration: 3.2, ease: 'easeInOut' }
              }
              className="relative w-32 h-24 sm:w-36 sm:h-26 flex items-center justify-center"
            >
              <svg
                viewBox="0 0 180 126"
                className="w-full h-full drop-shadow-[0_12px_24px_rgba(250,204,21,0.32)]"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="gse-body" x1="0" y1="0" x2="180" y2="126" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="35%" stopColor="#eab308" />
                    <stop offset="75%" stopColor="#ca8a04" />
                    <stop offset="100%" stopColor="#854d0e" />
                  </linearGradient>
                  <linearGradient id="gse-flap" x1="90" y1="8" x2="90" y2="80" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fef9c3" />
                    <stop offset="55%" stopColor="#facc15" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                  <linearGradient id="gse-inner" x1="90" y1="14" x2="90" y2="84" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#451a03" />
                    <stop offset="100%" stopColor="#78350f" />
                  </linearGradient>
                  <radialGradient id="gse-seal" cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="45%" stopColor="#d97706" />
                    <stop offset="100%" stopColor="#7c2d12" />
                  </radialGradient>
                </defs>

                {/* Envelope main card */}
                <rect
                  x="10"
                  y="14"
                  width="160"
                  height="102"
                  rx="14"
                  fill="url(#gse-body)"
                  stroke="#fef9c3"
                  strokeWidth="2"
                />

                {/* Inner shadow pocket */}
                <path d="M16 20 L90 74 L164 20 Z" fill="url(#gse-inner)" opacity="0.65" />

                {/* Side & bottom diagonal folds */}
                <path
                  d="M12 112 L72 64 M168 112 L108 64"
                  stroke="#92400e"
                  strokeOpacity="0.45"
                  strokeWidth="1.6"
                />
                <path
                  d="M14 114 L90 60 L166 114 Z"
                  fill="#a16207"
                  fillOpacity="0.22"
                />

                {/* Top metallic flap (lifts smoothly when unsealing) */}
                <motion.g
                  style={{ transformOrigin: '90px 16px' }}
                  animate={unsealing ? { scaleY: -0.75, opacity: 0.9 } : { scaleY: 1, opacity: 1 }}
                  transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                >
                  <path
                    d="M12 18 C12 15 15 14 18 14 L162 14 C165 14 168 15 168 18 L90 76 Z"
                    fill="url(#gse-flap)"
                    stroke="#fef9c3"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </motion.g>

                {/* Embossed Golden Detective Wax Seal */}
                <motion.g
                  animate={unsealing ? { scale: 1.35, opacity: 0 } : { scale: 1, opacity: 1 }}
                  transition={{ duration: 0.28 }}
                  style={{ transformOrigin: '90px 68px' }}
                >
                  <circle
                    cx="90"
                    cy="68"
                    r="18"
                    fill="url(#gse-seal)"
                    stroke="#fef08a"
                    strokeWidth="2"
                  />
                  <circle
                    cx="90"
                    cy="68"
                    r="13.5"
                    fill="none"
                    stroke="#fef9c3"
                    strokeOpacity="0.55"
                    strokeWidth="1"
                    strokeDasharray="2.5 2"
                  />
                  {/* Miniature crown mark inside wax seal */}
                  <path
                    d="M82 72 L81 64 L86 67 L90 61 L94 67 L99 64 L98 72 Z"
                    fill="#fef9c3"
                  />
                </motion.g>

                {/* Subtle starlight glints */}
                <path d="M26 30 L28 24 L30 30 L36 32 L30 34 L28 40 L26 34 L20 32 Z" fill="#fef9c3" />
                <path d="M150 28 L151.5 24 L153 28 L157 29.5 L153 31 L151.5 35 L150 31 L146 29.5 Z" fill="#fef08a" />
              </svg>
            </motion.div>
          )}
        </button>

        {/* Editorial Copy & Primary Action */}
        <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] font-semibold tracking-wider text-amber-300/90">
            <span>The 1% Santa Secret</span>
            <span aria-hidden="true">·</span>
            <span>{alreadyOpened ? 'Golden Detective Crown Equipped' : 'Classified Dispatch'}</span>
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-bold text-amber-50 leading-snug [text-wrap:balance]">
            {alreadyOpened
              ? `${participantName} Compromised the North Pole`
              : 'You Unlocked a Mysterious Golden Envelope'}
          </h3>

          <p className="text-xs sm:text-sm text-amber-100/80 leading-relaxed max-w-xl">
            {alreadyOpened
              ? 'Your permanent Golden Detective Crown is now equipped on your avatar for this event. You can revisit the hidden golden Christmas world anytime.'
              : 'You correctly guessed your Secret Santa. Break the golden wax seal to read Santa’s classified message and claim your permanent Golden Detective Crown.'}
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <button
              type="button"
              disabled={unsealing}
              onClick={handleTrigger}
              className="min-h-[44px] px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 hover:from-amber-200 hover:to-yellow-300 text-[#1b1305] font-display font-bold text-sm inline-flex items-center gap-2 shadow-[0_10px_28px_rgba(250,204,21,0.35)] transition-transform active:scale-[0.98] cursor-pointer whitespace-nowrap disabled:opacity-70"
            >
              {alreadyOpened ? (
                <>
                  <Eye className="w-4 h-4 shrink-0" />
                  Revisit Golden World
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  {unsealing ? 'Breaking Wax Seal...' : 'Open Golden Envelope'}
                </>
              )}
            </button>

            {alreadyOpened && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <Crown className="w-4 h-4 shrink-0" />
                Permanent Rare Event Cosmetic
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
