import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Check,
  Copy,
  Gift,
  Lightbulb,
  Mail,
  MapPin,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Truck,
  Volume2,
  Wallet,
} from 'lucide-react';
import {
  GiftDislikesShareable,
  ParticipantAddress,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { AvatarGraphic } from '../../components/avatars/AvatarGraphic';
import { formatFullAddress } from '../../utils/addressParser';
import { getGiftIdeasForHobbies } from '../../data/hobbies';
import { playPopSound, playRevealSound } from '../../utils/sound';

interface ScratchRevealCardProps {
  theme: ThemeId;
  mode: 'giftee' | 'secret-santa';
  personName: string;
  personAvatarId: string;
  personHobbies: string[];
  personAddress?: ParticipantAddress;
  budgetText?: string;
  budgetAnnouncement?: string;
  recipientDislikes?: GiftDislikesShareable | null;
  alreadyRevealed?: boolean;
  onRevealed?: () => void;
  onOpenMailbox?: () => void;
  onOpenDelivery?: () => void;
}

export const ScratchRevealCard: React.FC<ScratchRevealCardProps> = ({
  theme,
  mode,
  personName,
  personAvatarId,
  personHobbies,
  personAddress,
  budgetText,
  budgetAnnouncement,
  recipientDislikes,
  alreadyRevealed = false,
  onRevealed,
  onOpenMailbox,
  onOpenDelivery,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logicalSizeRef = useRef<{ width: number; height: number }>({ width: 320, height: 240 });
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastEvalTimeRef = useRef(0);
  const revealTimersRef = useRef<number[]>([]);
  const revealedRef = useRef(alreadyRevealed);

  const [stage, setStage] = useState<'scratch' | 'shaking-box' | 'revealed'>(
    alreadyRevealed ? 'revealed' : 'scratch'
  );
  const [scratchPct, setScratchPct] = useState(0);
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [shakeStatus, setShakeStatus] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [showGiftIdeas, setShowGiftIdeas] = useState(false);
  const [showAddress, setShowAddress] = useState(true);

  // Keep internal reveal stage cleanly in sync when switching modes, people, or resetting preview
  const prevIdentityRef = useRef({ mode, personName, alreadyRevealed });
  useEffect(() => {
    const prev = prevIdentityRef.current;
    const identityChanged = prev.mode !== mode || prev.personName !== personName;
    const resetRequested = prev.alreadyRevealed && !alreadyRevealed;
    prevIdentityRef.current = { mode, personName, alreadyRevealed };

    if (identityChanged || resetRequested) {
      revealTimersRef.current.forEach((id) => window.clearTimeout(id));
      revealTimersRef.current = [];
      revealedRef.current = alreadyRevealed;
      setStage(alreadyRevealed ? 'revealed' : 'scratch');
      setScratchPct(0);
      setShakeStatus(null);
    } else if (alreadyRevealed && !revealedRef.current) {
      revealedRef.current = true;
      setStage('revealed');
    }
  }, [alreadyRevealed, mode, personName]);

  useEffect(() => {
    return () => {
      revealTimersRef.current.forEach((id) => window.clearTimeout(id));
      revealTimersRef.current = [];
    };
  }, []);

  const triggerDramaticReveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setStage('shaking-box');
    playPopSound();

    // Pause briefly while the 3D gift box shakes (or hiccups in Chaos theme!)
    const t1 = window.setTimeout(() => {
      setStage('revealed');
      playRevealSound(theme);
      confetti({
        particleCount: 110,
        spread: 85,
        origin: { y: 0.55 },
        colors: cfg.confettiColors,
      });
      const t2 = window.setTimeout(() => {
        confetti({
          particleCount: 65,
          angle: 60,
          spread: 55,
          origin: { x: 0.1, y: 0.65 },
          colors: cfg.confettiColors,
        });
        confetti({
          particleCount: 65,
          angle: 120,
          spread: 55,
          origin: { x: 0.9, y: 0.65 },
          colors: cfg.confettiColors,
        });
      }, 280);
      revealTimersRef.current.push(t2);
      onRevealed?.();
    }, theme === 'funny' ? 1200 : 850);
    revealTimersRef.current.push(t1);
  }, [cfg.confettiColors, onRevealed, theme]);

  // Paint the high-DPI foil scratch canvas whenever theme, mode, or stage changes
  useEffect(() => {
    if (stage !== 'scratch') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Use clientWidth/clientHeight so motion scale-in animations never skew logical dimensions
    const width = Math.max(260, Math.floor(canvas.clientWidth || canvas.offsetWidth || 360));
    const height = Math.max(200, Math.floor(canvas.clientHeight || canvas.offsetHeight || 240));
    logicalSizeRef.current = { width, height };

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = 'source-over';

    // Metallic / Chocolate / Chaos Foil Gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, cfg.scratchPrimary);
    grad.addColorStop(0.5, cfg.scratchSecondary);
    grad.addColorStop(1, cfg.scratchPrimary);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle festive diagonal sheen stripes
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 14;
    for (let x = -height; x < width + height; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();
    }
    ctx.restore();

    // Inner decorative border
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    // Center Gift Prompt Typography
    ctx.fillStyle = cfg.scratchTextColor;
    ctx.textAlign = 'center';
    ctx.font = '700 34px Fredoka, sans-serif';
    ctx.fillText('🎁', width / 2, height / 2 - 22);
    ctx.font = '700 18px Fredoka, sans-serif';
    ctx.fillText(cfg.scratchLabel, width / 2, height / 2 + 16);
    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.globalAlpha = 0.85;
    ctx.fillText('Rub with finger or mouse · or shake phone', width / 2, height / 2 + 40);
    ctx.globalAlpha = 1;
  }, [stage, mode, personName, cfg.scratchPrimary, cfg.scratchSecondary, cfg.scratchTextColor, cfg.scratchLabel]);

  // DeviceMotion shake listener
  useEffect(() => {
    if (stage !== 'scratch' || !shakeEnabled) return;
    let lastShakeCheck = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.hypot(acc.x || 0, acc.y || 0, acc.z || 0);
      const now = performance.now();
      if (magnitude > 24 && now - lastShakeCheck > 450) {
        lastShakeCheck = now;
        triggerDramaticReveal();
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [stage, shakeEnabled, triggerDramaticReveal]);

  const requestShakePermission = async () => {
    setShakeStatus(null);
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      setShakeStatus('Shake sensor unavailable on this device — scratch the card or tap Reveal Now!');
      return;
    }
    const DM = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DM.requestPermission === 'function') {
      try {
        const res = await DM.requestPermission();
        if (res === 'granted') {
          setShakeEnabled(true);
          setShakeStatus('Shake active! Give your phone a crisp shake now!');
        } else {
          setShakeStatus('Motion permission declined — you can still scratch or tap Reveal Now.');
        }
      } catch {
        setShakeStatus('Unable to access motion sensor — scratch or tap Reveal Now.');
      }
    } else {
      setShakeEnabled(true);
      setShakeStatus('Shake listener active! Shake your phone to reveal!');
    }
  };

  const evaluateScratchProgress = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height).data;
    let transparentPixels = 0;
    let sampledPixels = 0;

    // Sample every 16th pixel for crisp 60fps mobile performance
    for (let i = 3; i < imageData.length; i += 64) {
      sampledPixels++;
      if (imageData[i] < 128) transparentPixels++;
    }

    const pct = sampledPixels > 0 ? Math.round((transparentPixels / sampledPixels) * 100) : 0;
    setScratchPct(pct);

    if (pct >= 45) {
      triggerDramaticReveal();
    }
  };

  const eraseAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const scaleX = logicalSizeRef.current.width / rect.width;
    const scaleY = logicalSizeRef.current.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 48;

    ctx.beginPath();
    if (lastPointRef.current) {
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    } else {
      ctx.moveTo(x - 1, y - 1);
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    lastPointRef.current = { x, y };
  };

  const handleCopyAddress = async () => {
    if (!personAddress) return;
    const formatted = `${personName}\n${formatFullAddress(personAddress)}`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedAddr(true);
      playPopSound();
      window.setTimeout(() => setCopiedAddr(false), 2500);
    } catch {
      setCopiedAddr(false);
    }
  };

  const giftIdeas = getGiftIdeasForHobbies(personHobbies);

  return (
    <div className="w-full space-y-5">
      <AnimatePresence mode="wait">
        {stage === 'scratch' && (
          <motion.div
            key="scratch-stage"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            className="space-y-4"
          >
            {/* Interactive Scratch Card Frame */}
            <div
              className={`relative mx-auto w-full max-w-md h-60 sm:h-64 rounded-3xl overflow-hidden shadow-2xl border-4 select-none touch-none ${
                theme === 'chocolate'
                  ? 'border-[#5c2d0c] bg-[#fff8ec]'
                  : theme === 'funny'
                    ? 'border-amber-400 bg-yellow-50'
                    : 'border-amber-300 bg-rose-50'
              }`}
            >
              {/* Hidden Recipient Glimpse Underneath */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                <AvatarGraphic avatarId={personAvatarId} size={86} className="mb-2" />
                <p className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  {mode === 'giftee' ? 'Your Giftee Is...' : 'Your Secret Santa Was...'}
                </p>
                <p className="font-display text-3xl font-bold text-slate-900 mt-0.5">
                  {personName}
                </p>
              </div>

              {/* Scratchable Foil Canvas */}
              <canvas
                ref={canvasRef}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  isDrawingRef.current = true;
                  lastPointRef.current = null;
                  eraseAt(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (!isDrawingRef.current) return;
                  eraseAt(e.clientX, e.clientY);
                  const now = performance.now();
                  if (now - lastEvalTimeRef.current > 120) {
                    lastEvalTimeRef.current = now;
                    evaluateScratchProgress();
                  }
                }}
                onPointerUp={() => {
                  isDrawingRef.current = false;
                  lastPointRef.current = null;
                  evaluateScratchProgress();
                }}
                onPointerCancel={() => {
                  isDrawingRef.current = false;
                  lastPointRef.current = null;
                }}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                aria-label="Scratch off festive foil to reveal your Secret Santa match"
              />
            </div>

            {/* Progress & Shake Controls */}
            <div className="flex flex-col items-center gap-3">
              <p className={`text-xs font-mono-tabular font-semibold ${cfg.mutedText}`}>
                Scratched: {scratchPct}% · Unlocks automatically at 45%
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={requestShakePermission}
                  className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2 cursor-pointer ${cfg.secondaryBtnClass}`}
                >
                  <Smartphone className="w-4 h-4" />
                  {shakeEnabled ? 'Shake Active — Shake Phone!' : 'Enable Phone Shake'}
                </button>

                <button
                  type="button"
                  onClick={triggerDramaticReveal}
                  className={`min-h-[44px] px-6 py-2 rounded-full font-display font-bold text-base inline-flex items-center gap-2 cursor-pointer ${cfg.primaryBtnClass}`}
                >
                  <Sparkles className="w-4 h-4" />
                  Reveal Now
                </button>
              </div>

              {shakeStatus && (
                <p className={`text-xs font-medium text-center max-w-sm ${cfg.mutedText}`}>
                  {shakeStatus}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {stage === 'shaking-box' && (
          <motion.div
            key="box-stage"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.35 }}
            className="py-12 flex flex-col items-center justify-center text-center space-y-4"
          >
            <motion.div
              animate={
                theme === 'funny'
                  ? {
                      scale: [1, 1.25, 0.85, 1.32, 0.9, 1.4],
                      rotate: [-16, 16, -22, 22, -12, 0],
                    }
                  : {
                      scale: [1, 1.12, 0.96, 1.18, 1.25],
                      rotate: [-10, 10, -14, 14, 0],
                    }
              }
              transition={{ duration: theme === 'funny' ? 1.15 : 0.8 }}
              className="text-8xl drop-shadow-[0_14px_24px_rgba(0,0,0,0.3)]"
            >
              🎁
            </motion.div>
            <p className={`font-display text-2xl font-bold ${cfg.cardText}`}>
              {theme === 'funny'
                ? 'Dhol bajao! Gift box bhangra kar raha hai! 🥁🤪'
                : 'Opening your surprise...'}
            </p>
          </motion.div>
        )}

        {stage === 'revealed' && (
          <motion.div
            key="revealed-stage"
            initial={{ opacity: 0, scale: 0.85, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="space-y-5"
          >
            {/* FAAAAH! Comic Reveal Banner */}
            <div className="flex flex-col items-center text-center space-y-3">
              <motion.div
                initial={{ rotate: -10, scale: 0.5 }}
                animate={{ rotate: [-6, 4, -3], scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-5 py-1.5 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 border-2 border-rose-600 shadow-lg"
              >
                <span className="font-display text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-wide">
                  {theme === 'funny'
                    ? 'BALLE BALLE! FAAAAH! 🥁'
                    : theme === 'santa'
                      ? 'JINGLE BELLS! 🔔'
                      : 'TRUFFLE POP! 🍫'}
                </span>
                <button
                  type="button"
                  onClick={() => playRevealSound(theme)}
                  aria-label={
                    theme === 'santa'
                      ? 'Replay Jingle Bells reveal sound'
                      : theme === 'chocolate'
                        ? 'Replay Chocolate Truffle Pop reveal sound'
                        : 'Replay FAAAAH reveal sound'
                  }
                  title={
                    theme === 'santa'
                      ? 'Replay Jingle Bells sound'
                      : theme === 'chocolate'
                        ? 'Replay Chocolate Truffle Pop sound'
                        : 'Replay FAAAAH sound'
                  }
                  className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </motion.div>

              <p className={`text-sm font-semibold ${cfg.mutedText}`}>
                {mode === 'giftee'
                  ? "You're the Secret Santa for..."
                  : 'Drumroll! Your Secret Santa was...'}
              </p>

              {/* Revealed Avatar & Name Spotlight */}
              <div className="relative flex flex-col items-center">
                <div className="p-2 rounded-[32px] bg-gradient-to-tr from-amber-300 via-rose-400 to-amber-200 shadow-xl">
                  <div className="rounded-[26px] bg-white p-1.5">
                    <AvatarGraphic avatarId={personAvatarId} size={112} />
                  </div>
                </div>
                <h2 className={`font-display text-3xl sm:text-4xl font-bold mt-3 ${cfg.cardText}`}>
                  {personName}
                </h2>
                <p className={`text-sm mt-1 ${cfg.mutedText}`}>
                  {mode === 'giftee'
                    ? "You've got a very important Christmas mission! 🎁"
                    : 'Now you know who sent the holiday magic! 🎅'}
                </p>
              </div>
            </div>

            {/* Hobbies / Gift Preferences */}
            <div
              className={`rounded-2xl border p-4 space-y-2.5 ${
                theme === 'chocolate'
                  ? 'bg-[#fffaf2] border-[#d8b48a]'
                  : 'bg-white/80 border-black/10'
              }`}
            >
              <div className="flex items-center gap-2 font-display font-bold text-sm text-slate-900">
                <Gift className="w-4 h-4 text-rose-600" />
                <span>
                  {mode === 'giftee' ? `${personName}'s Gift Clues & Hobbies` : `${personName}'s Hobbies`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {personHobbies.map((hobby) => (
                  <span
                    key={hobby}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${cfg.chipIdleClass}`}
                  >
                    ✨ {hobby}
                  </span>
                ))}
              </div>
            </div>

            {/* Feature 9: Gift Budget Guide on Giftee Reveal Card */}
            {mode === 'giftee' && budgetText && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 text-left flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm text-amber-950">
                    Gift Budget Guide: {budgetText}
                  </p>
                  {budgetAnnouncement && (
                    <p className="text-xs text-amber-900/85 mt-0.5">{budgetAnnouncement}</p>
                  )}
                </div>
              </div>
            )}

            {/* Feature 10: Things Santa Should Avoid (Dislikes & Opt-in Restrictions) */}
            {mode === 'giftee' &&
              recipientDislikes &&
              (recipientDislikes.dislikedCategories.length > 0 ||
                recipientDislikes.dietaryRestrictions.length > 0 ||
                recipientDislikes.dislikedColors.length > 0 ||
                recipientDislikes.alreadyOwned.length > 0 ||
                recipientDislikes.nonFoodNotes ||
                recipientDislikes.generalNotes) && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/85 p-4 text-left space-y-2.5">
                  <div className="flex items-center gap-2 font-display font-bold text-sm text-rose-900">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Things {personName} Would Rather Avoid</span>
                  </div>

                  {recipientDislikes.dislikedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recipientDislikes.dislikedCategories.map((item) => (
                        <span
                          key={`cat-${item}`}
                          className="px-2.5 py-0.5 rounded-full bg-white border border-rose-200 text-rose-800 text-xs font-semibold"
                        >
                          🚫 {item}
                        </span>
                      ))}
                    </div>
                  )}

                  {recipientDislikes.dietaryRestrictions.length > 0 && (
                    <p className="text-xs text-rose-900">
                      <span className="font-bold">Dietary / Allergies:</span>{' '}
                      {recipientDislikes.dietaryRestrictions.join(', ')}
                    </p>
                  )}

                  {recipientDislikes.dislikedColors.length > 0 && (
                    <p className="text-xs text-rose-900">
                      <span className="font-bold">Colors to skip:</span>{' '}
                      {recipientDislikes.dislikedColors.join(', ')}
                    </p>
                  )}

                  {recipientDislikes.alreadyOwned.length > 0 && (
                    <p className="text-xs text-rose-900">
                      <span className="font-bold">Already owns:</span>{' '}
                      {recipientDislikes.alreadyOwned.join(', ')}
                    </p>
                  )}

                  {(recipientDislikes.nonFoodNotes || recipientDislikes.generalNotes) && (
                    <p className="text-xs text-rose-900/90 italic">
                      {[recipientDislikes.nonFoodNotes, recipientDislikes.generalNotes]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              )}

            {/* Quick-Jump Actions to Anonymous Mailbox & Delivery Express */}
            {mode === 'giftee' && (onOpenMailbox || onOpenDelivery) && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {onOpenMailbox && (
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      onOpenMailbox();
                    }}
                    className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer ${cfg.secondaryBtnClass}`}
                  >
                    <Mail className="w-4 h-4" />
                    Message {personName} Anonymously
                  </button>
                )}
                {onOpenDelivery && (
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      onOpenDelivery();
                    }}
                    className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer ${cfg.secondaryBtnClass}`}
                  >
                    <Truck className="w-4 h-4" />
                    Update Delivery Sleigh
                  </button>
                )}
              </div>
            )}

            {/* Giftee Delivery Address & Gift Ideas */}
            {mode === 'giftee' && personAddress && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setShowAddress((v) => !v);
                    }}
                    className={`min-h-[42px] px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer ${cfg.secondaryBtnClass}`}
                  >
                    <MapPin className="w-4 h-4" />
                    {showAddress ? 'Hide Address' : 'View Delivery Address'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className={`min-h-[42px] px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer ${cfg.primaryBtnClass}`}
                  >
                    {copiedAddr ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedAddr ? 'Address Copied!' : 'Copy Address'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setShowGiftIdeas((v) => !v);
                    }}
                    className={`min-h-[42px] px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer ${cfg.secondaryBtnClass}`}
                  >
                    <Lightbulb className="w-4 h-4" />
                    Gift Ideas
                  </button>
                </div>

                {showAddress && (
                  <div
                    className={`rounded-2xl border p-4 text-left space-y-1 text-sm ${
                      theme === 'chocolate'
                        ? 'bg-[#fffaf2] border-[#d8b48a] text-[#3d1c06]'
                        : 'bg-white/85 border-black/10 text-slate-800'
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider opacity-65">
                      Delivery Address
                    </p>
                    <p className="font-semibold">{personName}</p>
                    <p className="whitespace-pre-line leading-relaxed">
                      {formatFullAddress(personAddress)}
                    </p>
                  </div>
                )}

                {showGiftIdeas && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-left space-y-2"
                  >
                    <p className="font-display font-bold text-sm text-amber-950 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      Gift Ideas Inspired by {personName}&apos;s Hobbies
                    </p>
                    <ul className="space-y-1.5 text-sm text-amber-900 list-disc pl-5">
                      {giftIdeas.map((idea) => (
                        <li key={idea}>{idea}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
