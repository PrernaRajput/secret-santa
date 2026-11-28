import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Loader2,
  Music,
  Shuffle,
  Sparkles,
  Trash2,
  VolumeX,
  Wind,
} from 'lucide-react';
import {
  SecretSantaEvent,
  SnowGlobePlacedOrnament,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import {
  fetchSnowGlobeConfig,
  saveSnowGlobeConfig,
} from '../../services/workshopService';
import { WORKSHOP_DATA_RESET_EVENT } from '../../services/adminTestingResetService';
import {
  getSoundMuted,
  pauseSnowGlobeMusic,
  playChimeSound,
  playMagicSparkleSound,
  playPopSound,
  startSnowGlobeMusic,
  stopSnowGlobeMusic,
  subscribeSoundMuted,
} from '../../utils/sound';

export interface CollectibleOrnamentOption {
  collectibleId: string;
  label: string;
  emoji: string;
  source: string;
}

interface InteractiveSnowGlobeProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  participantKey: string;
  countdownLabel: string;
  revealReady: boolean;
  unlockedCollectibles: CollectibleOrnamentOption[];
  liveMode: boolean;
  onTriggerGrandReveal?: () => void;
}

const STARTER_ORNAMENTS: CollectibleOrnamentOption[] = [
  { collectibleId: 'starter-star', label: 'Tree Topper Star', emoji: '⭐', source: 'Starter' },
  { collectibleId: 'starter-gift', label: 'Mini Parcel', emoji: '🎁', source: 'Starter' },
  { collectibleId: 'starter-candy', label: 'Sugar Cane', emoji: '🍬', source: 'Starter' },
];

/**
 * 16 well-spaced coordinates inside the upper/middle circular glass dome
 * so newly placed ornaments never stack on top of each other or the snowy cabin below.
 */
const ORNAMENT_SLOTS: { x: number; y: number }[] = [
  { x: 50, y: 22 },
  { x: 30, y: 30 },
  { x: 70, y: 30 },
  { x: 20, y: 46 },
  { x: 80, y: 46 },
  { x: 40, y: 38 },
  { x: 60, y: 38 },
  { x: 28, y: 58 },
  { x: 72, y: 58 },
  { x: 50, y: 48 },
  { x: 36, y: 20 },
  { x: 64, y: 20 },
  { x: 22, y: 36 },
  { x: 78, y: 36 },
  { x: 42, y: 60 },
  { x: 58, y: 60 },
];

/**
 * Clamp a dragged ornament's percentage (x, y) safely inside the circular glass dome
 * and above the snowy bottom edge, matching Firestore persistence bounds.
 */
function clampInsideDome(rawX: number, rawY: number): { x: number; y: number } {
  const xClamped = Math.max(15, Math.min(85, rawX));
  const yClamped = Math.max(20, Math.min(72, rawY));
  const dx = xClamped - 50;
  const dy = yClamped - 50;
  const dist = Math.hypot(dx, dy);
  const maxRadius = 38;
  if (dist > maxRadius) {
    const scale = maxRadius / dist;
    return {
      x: Math.round(50 + dx * scale),
      y: Math.round(50 + dy * scale),
    };
  }
  return { x: Math.round(xClamped), y: Math.round(yClamped) };
}

function pickOpenSlot(existing: SnowGlobePlacedOrnament[]): { x: number; y: number } {
  for (const slot of ORNAMENT_SLOTS) {
    const taken = existing.some((p) => Math.hypot(p.x - slot.x, p.y - slot.y) < 10);
    if (!taken) return slot;
  }
  return ORNAMENT_SLOTS[existing.length % ORNAMENT_SLOTS.length];
}

const PERSISTENT_FLAKES = Array.from({ length: 34 }, (_, i) => ({
  id: i,
  left: ((i * 29 + 11) % 86) + 7,
  startY: ((i * 37) % 220) - 20,
  delay: (i % 9) * 0.28,
  size: 2.5 + (i % 4),
  duration: 2.8 + (i % 5) * 0.55,
  drift: (i % 2 === 0 ? 1 : -1) * (6 + (i % 5) * 2),
}));

const BURST_FLURRY_PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const radius = 58 + (i % 3) * 26;
  return {
    id: i,
    dx: Math.round(Math.cos(angle) * radius),
    dy: Math.round(Math.sin(angle) * radius),
    size: 4 + (i % 3) * 2,
    isSparkle: i % 3 === 0,
  };
});

export const InteractiveSnowGlobe: React.FC<InteractiveSnowGlobeProps> = ({
  theme,
  event,
  participantKey,
  countdownLabel,
  revealReady,
  unlockedCollectibles,
  liveMode,
  onTriggerGrandReveal,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const sphereRef = useRef<HTMLDivElement | null>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const crackTimerRef = useRef<number | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const didDragMoveRef = useRef(false);
  const placedRef = useRef<SnowGlobePlacedOrnament[]>([]);

  const [placed, setPlaced] = useState<SnowGlobePlacedOrnament[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [cracking, setCracking] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [globalMuted, setGlobalMuted] = useState(() => getSoundMuted());
  const musicEnabledRef = useRef(true);

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  useEffect(() => {
    placedRef.current = placed;
  }, [placed]);

  // Clear timers cleanly on unmount
  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
      if (crackTimerRef.current !== null) window.clearTimeout(crackTimerRef.current);
    };
  }, []);

  // Play the Christmas music box melody while inside the Magical Snow Globe and stop on leave
  useEffect(() => {
    let active = true;
    const unsubMute = subscribeSoundMuted((muted) => {
      if (!active) return;
      setGlobalMuted(muted);
      if (muted) {
        setMusicPlaying(false);
      } else if (musicEnabledRef.current) {
        void startSnowGlobeMusic().then((ok) => {
          if (active) setMusicPlaying(ok);
        });
      }
    });

    if (!getSoundMuted()) {
      void startSnowGlobeMusic().then((ok) => {
        if (active) setMusicPlaying(ok);
      });
    }

    return () => {
      active = false;
      unsubMute();
      stopSnowGlobeMusic();
    };
  }, []);

  const ensureMusicStartedIfWanted = useCallback(() => {
    if (musicEnabled && !musicPlaying && !globalMuted) {
      void startSnowGlobeMusic().then((ok) => {
        setMusicPlaying(ok);
      });
    }
  }, [globalMuted, musicEnabled, musicPlaying]);

  const handleToggleMusic = () => {
    if (globalMuted) return;
    if (musicEnabled && musicPlaying) {
      setMusicEnabled(false);
      setMusicPlaying(false);
      pauseSnowGlobeMusic();
    } else {
      setMusicEnabled(true);
      void startSnowGlobeMusic().then((ok) => {
        setMusicPlaying(ok);
      });
    }
  };

  // Load saved snow globe ornaments and re-hydrate on admin testing resets
  const hydrateConfig = useCallback(async () => {
    setLoadingConfig(true);
    setSaveError(null);
    try {
      const rec = await fetchSnowGlobeConfig(participantKey, event.id, liveMode);
      setPlaced(rec.decorations);
    } finally {
      setLoadingConfig(false);
    }
  }, [event.id, liveMode, participantKey]);

  useEffect(() => {
    void hydrateConfig();
  }, [hydrateConfig]);

  useEffect(() => {
    const onReset = () => {
      void hydrateConfig();
    };
    window.addEventListener(WORKSHOP_DATA_RESET_EVENT, onReset);
    return () => window.removeEventListener(WORKSHOP_DATA_RESET_EVENT, onReset);
  }, [hydrateConfig]);

  // Include starters, newly unlocked collectibles, AND any previously placed ornaments
  const allOrnaments = useMemo(() => {
    const map = new Map<string, CollectibleOrnamentOption>();
    STARTER_ORNAMENTS.forEach((o) => map.set(o.collectibleId, o));
    unlockedCollectibles.forEach((o) => map.set(o.collectibleId, o));
    placed.forEach((p) => {
      if (!map.has(p.collectibleId)) {
        map.set(p.collectibleId, {
          collectibleId: p.collectibleId,
          label: p.label,
          emoji: p.emoji,
          source: 'Saved',
        });
      }
    });
    return Array.from(map.values());
  }, [placed, unlockedCollectibles]);

  const persistDecorations = useCallback(
    async (next: SnowGlobePlacedOrnament[], previous: SnowGlobePlacedOrnament[]) => {
      setSaving(true);
      setSaveError(null);
      try {
        await saveSnowGlobeConfig(event.id, participantKey, next, liveMode);
      } catch {
        setPlaced(previous);
        setSaveError('Could not save your snow globe ornaments right now. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [event.id, liveMode, participantKey]
  );

  const handleShake = () => {
    ensureMusicStartedIfWanted();
    playMagicSparkleSound();
    setShaking(true);
    setBurstKey((k) => k + 1);
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
    }
    shakeTimerRef.current = window.setTimeout(() => {
      setShaking(false);
      shakeTimerRef.current = null;
    }, 1250);
  };

  const handleToggleOrnament = async (opt: CollectibleOrnamentOption) => {
    if (loadingConfig || saving) return;
    ensureMusicStartedIfWanted();
    playPopSound();
    const prev = placedRef.current;
    const exists = prev.some((p) => p.collectibleId === opt.collectibleId);
    let next: SnowGlobePlacedOrnament[];
    if (exists) {
      next = prev.filter((p) => p.collectibleId !== opt.collectibleId);
    } else {
      if (prev.length >= 16) return;
      const slot = pickOpenSlot(prev);
      next = [
        ...prev,
        {
          id: `sg_${Date.now()}_${prev.length}`,
          collectibleId: opt.collectibleId,
          label: opt.label,
          emoji: opt.emoji,
          x: slot.x,
          y: slot.y,
        },
      ];
    }
    setPlaced(next);
    await persistDecorations(next, prev);
  };

  const handleShuffleOrnaments = async () => {
    if (loadingConfig || saving || placedRef.current.length < 2) return;
    ensureMusicStartedIfWanted();
    playMagicSparkleSound();
    const prev = placedRef.current;
    const shuffledSlots = [...ORNAMENT_SLOTS].sort(() => Math.random() - 0.5);
    const next = prev.map((orn, idx) => ({
      ...orn,
      x: shuffledSlots[idx % shuffledSlots.length].x,
      y: shuffledSlots[idx % shuffledSlots.length].y,
    }));
    setPlaced(next);
    await persistDecorations(next, prev);
  };

  const handleClearOrnaments = async () => {
    if (loadingConfig || saving || placedRef.current.length === 0) return;
    playPopSound();
    const prev = placedRef.current;
    setPlaced([]);
    await persistDecorations([], prev);
  };

  const handleOrnamentPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    ornamentId: string
  ) => {
    e.stopPropagation();
    if (loadingConfig || saving) return;
    ensureMusicStartedIfWanted();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingIdRef.current = ornamentId;
    didDragMoveRef.current = false;
    setDraggingId(ornamentId);
  };

  const handleOrnamentPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const id = draggingIdRef.current;
    if (!id || !sphereRef.current) return;
    e.stopPropagation();
    const rect = sphereRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const clamped = clampInsideDome(rawX, rawY);
    didDragMoveRef.current = true;
    setPlaced((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x: clamped.x, y: clamped.y } : o))
    );
  };

  const handleOrnamentPointerUp = async (e: React.PointerEvent<HTMLButtonElement>) => {
    const id = draggingIdRef.current;
    if (!id) return;
    e.stopPropagation();
    draggingIdRef.current = null;
    setDraggingId(null);
    if (didDragMoveRef.current) {
      playPopSound();
      const latest = placedRef.current;
      await persistDecorations(latest, latest);
    }
  };

  const handleCrackReveal = () => {
    if (!revealReady || cracking) return;
    ensureMusicStartedIfWanted();
    setCracking(true);
    playChimeSound();
    confetti({
      particleCount: 110,
      spread: 95,
      origin: { y: 0.5 },
      colors: cfg.confettiColors,
    });
    if (crackTimerRef.current !== null) {
      window.clearTimeout(crackTimerRef.current);
    }
    crackTimerRef.current = window.setTimeout(() => {
      setCracking(false);
      crackTimerRef.current = null;
      onTriggerGrandReveal?.();
    }, 850);
  };

  const plaqueMainText =
    revealReady && (!countdownLabel || countdownLabel.startsWith('0d 0h 0m'))
      ? 'Tap Shatter Globe Below!'
      : countdownLabel || 'Counting down...';

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-700 inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Shake, Tilt &amp; Drag Ornaments Inside Your Globe
        </p>
        <h2 className={`font-display text-2xl sm:text-3xl font-bold ${cfg.cardText}`}>
          Interactive Magical Snow Globe 🔮
        </h2>
      </div>

      {/* 2.5D Parallax Glass Snow Globe */}
      <div className="flex flex-col items-center">
        <motion.div
          animate={
            shaking
              ? { rotate: [-7, 7, -6, 6, -3, 3, 0], scale: [1, 1.04, 0.99, 1.02, 1] }
              : cracking
                ? { scale: [1, 1.08, 0.96, 1.12] }
                : { rotate: 0, scale: 1 }
          }
          transition={{ duration: 0.95 }}
          onPointerMove={(e) => {
            if (draggingIdRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 14;
            const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 10;
            setTilt({ x: nx, y: ny });
          }}
          onPointerLeave={() => setTilt({ x: 0, y: 0 })}
          onClick={handleShake}
          className="relative w-72 sm:w-80 flex flex-col items-center cursor-pointer select-none"
        >
          {/* Glass Sphere */}
          <div
            ref={sphereRef}
            className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-white/75 bg-gradient-to-b from-[#0b1f44] via-[#1d4ed8]/85 to-[#bae6fd] shadow-[0_24px_60px_-10px_rgba(14,165,233,0.45),inset_0_0_40px_rgba(255,255,255,0.45)]"
          >
            {/* Aurora Shimmer */}
            <div
              className="absolute inset-0 opacity-50 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 30% 20%, rgba(254,240,138,0.48), transparent 52%), radial-gradient(circle at 75% 30%, rgba(56,189,248,0.52), transparent 55%)',
              }}
            />

            {/* Continuous Swirling Snow Particles (never unmounted on shake) */}
            {PERSISTENT_FLAKES.map((f) => (
              <motion.span
                key={f.id}
                initial={{ y: f.startY, opacity: 0.9 }}
                animate={{
                  y: shaking ? [f.startY, f.startY - 40, 275] : [-15, 275],
                  x: shaking ? [0, f.drift * 2.4, -f.drift * 2, f.drift] : [0, f.drift, -f.drift, 0],
                  opacity: [0.25, 0.98, 0.9, 0.2],
                }}
                transition={{
                  repeat: Infinity,
                  duration: shaking ? Math.max(1.1, f.duration * 0.45) : f.duration,
                  delay: shaking ? 0 : f.delay,
                  ease: 'easeInOut',
                }}
                style={{
                  left: `${f.left}%`,
                  width: f.size,
                  height: f.size,
                }}
                className="absolute top-0 rounded-full bg-white shadow-[0_0_6px_#ffffff] pointer-events-none"
              />
            ))}

            {/* Extra Blizzard Burst Particles when Shaken */}
            <AnimatePresence>
              {shaking && (
                <div
                  key={`burst-${burstKey}`}
                  className="absolute inset-0 pointer-events-none z-10"
                  aria-hidden="true"
                >
                  {BURST_FLURRY_PARTICLES.map((p) => (
                    <motion.span
                      key={p.id}
                      initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                      animate={{
                        x: [0, p.dx, p.dx * 1.25],
                        y: [0, p.dy - 18, p.dy + 34],
                        scale: [0.5, 1.25, 0.2],
                        opacity: [1, 0.95, 0],
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.15, ease: 'easeOut' }}
                      style={{
                        left: '50%',
                        top: '52%',
                        width: p.size,
                        height: p.size,
                      }}
                      className={`absolute rounded-full ${
                        p.isSparkle
                          ? 'bg-amber-200 shadow-[0_0_8px_#fde047]'
                          : 'bg-white shadow-[0_0_8px_#ffffff]'
                      }`}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* 2.5D Parallax Village & Glowing Pine Tree */}
            <motion.div
              animate={{ x: tilt.x, y: tilt.y }}
              transition={{ type: 'spring', stiffness: 160, damping: 20 }}
              className="absolute inset-0 flex flex-col items-center justify-end pb-7 pointer-events-none"
            >
              {/* Snowy Hills */}
              <div className="absolute bottom-0 inset-x-0 h-20 rounded-t-[50%] bg-gradient-to-t from-sky-100 to-white shadow-inner" />

              {/* Glowing Pine Tree + Cozy Cabin + Mini Santa */}
              <div className="relative z-10 flex items-end gap-2">
                <span className="text-3xl drop-shadow" aria-hidden="true">🏠</span>
                <span
                  className="text-6xl drop-shadow-[0_0_14px_rgba(251,191,36,0.8)]"
                  aria-hidden="true"
                >
                  🎄
                </span>
                <span className="text-3xl drop-shadow" aria-hidden="true">🎅</span>
              </div>
            </motion.div>

            {/* Draggable Collectible Ornaments Floating Inside Globe */}
            {placed.map((orn) => {
              const isDragging = draggingId === orn.id;
              return (
                <motion.button
                  key={orn.id}
                  type="button"
                  animate={isDragging ? { y: 0, scale: 1.25 } : { y: [0, -4, 0], scale: 1 }}
                  transition={
                    isDragging
                      ? { duration: 0.1 }
                      : { y: { repeat: Infinity, duration: 2.6, ease: 'easeInOut' } }
                  }
                  onPointerDown={(e) => handleOrnamentPointerDown(e, orn.id)}
                  onPointerMove={handleOrnamentPointerMove}
                  onPointerUp={(e) => void handleOrnamentPointerUp(e)}
                  onPointerCancel={(e) => void handleOrnamentPointerUp(e)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ left: `${orn.x}%`, top: `${orn.y}%` }}
                  aria-label={`Drag ${orn.label} ornament inside snow globe`}
                  title={`${orn.label} — drag to reposition`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)] z-20 cursor-grab active:cursor-grabbing touch-none select-none p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {orn.emoji}
                </motion.button>
              );
            })}

            {/* Dramatic Glass Crack Overlay on Grand Reveal Trigger */}
            {cracking && (
              <svg
                viewBox="0 0 200 200"
                className="absolute inset-0 w-full h-full z-30 pointer-events-none"
                aria-hidden="true"
              >
                <path
                  d="M100 100 L60 40 M100 100 L150 55 M100 100 L145 155 M100 100 L45 130"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            )}

            {/* Glass Specular Reflection */}
            <div className="absolute top-4 left-7 w-16 h-24 rounded-full bg-white/30 rotate-[-28deg] blur-[2px] pointer-events-none" />
          </div>

          {/* Wooden Engraved Snow Globe Base with Live Countdown Plaque */}
          <div className="-mt-4 relative z-20 w-56 sm:w-64 rounded-t-2xl rounded-b-3xl bg-gradient-to-b from-[#78350f] via-[#5c2d0c] to-[#3b1a06] border-2 border-amber-400/60 px-4 py-3 text-center shadow-2xl">
            <div className="rounded-xl bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 border border-amber-500 px-3 py-1.5 shadow-inner">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-900">
                {revealReady ? '✨ Reveal Day Has Arrived!' : 'Reveal Countdown'}
              </p>
              <p className="font-mono-tabular text-xs sm:text-sm font-extrabold text-amber-950 truncate">
                {plaqueMainText}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
          <button
            type="button"
            onClick={handleShake}
            className={`min-h-[44px] px-5 py-2 rounded-full font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ${cfg.secondaryBtnClass}`}
          >
            <Wind className="w-4 h-4" />
            Shake Snow Globe ❄️
          </button>

          <button
            type="button"
            disabled={globalMuted}
            onClick={handleToggleMusic}
            aria-pressed={musicPlaying && !globalMuted}
            className={`min-h-[44px] px-4 py-2 rounded-full font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${cfg.secondaryBtnClass}`}
          >
            {globalMuted ? (
              <>
                <VolumeX className="w-4 h-4" />
                Sound Muted
              </>
            ) : musicPlaying ? (
              <>
                <Music className="w-4 h-4 text-rose-600" />
                Music Box On
              </>
            ) : (
              <>
                <Music className="w-4 h-4" />
                Play Music Box
              </>
            )}
          </button>

          {revealReady && onTriggerGrandReveal && (
            <button
              type="button"
              onClick={handleCrackReveal}
              className={`min-h-[44px] px-6 py-2 rounded-full font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ${cfg.primaryBtnClass}`}
            >
              <Sparkles className="w-4 h-4" />
              Shatter Globe &amp; Open Reveal! 🎁
            </button>
          )}
        </div>
      </div>

      {/* Earned Ornament Shelf */}
      <div className="rounded-3xl bg-white/88 border border-black/10 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className={`font-display font-bold text-base ${cfg.cardText} inline-flex items-center gap-2`}>
              <span>Your Collectible Ornaments ({placed.length}/16 placed)</span>
              {(loadingConfig || saving) && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" aria-hidden="true" />
              )}
            </h3>
            <p className={`text-xs ${cfg.mutedText}`}>
              Tap ornaments to add or remove them, then drag any ornament right inside the glass dome to arrange it!
            </p>
          </div>
          {placed.length > 0 && (
            <div className="flex items-center gap-3">
              {placed.length >= 2 && (
                <button
                  type="button"
                  disabled={loadingConfig || saving}
                  onClick={() => void handleShuffleOrnaments()}
                  className="text-xs font-bold text-sky-700 hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Shuffle
                </button>
              )}
              <button
                type="button"
                disabled={loadingConfig || saving}
                onClick={() => void handleClearOrnaments()}
                className="text-xs font-bold text-rose-700 hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          )}
        </div>

        {saveError && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-800"
          >
            {saveError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {allOrnaments.map((opt) => {
            const isPlaced = placed.some((p) => p.collectibleId === opt.collectibleId);
            return (
              <button
                key={opt.collectibleId}
                type="button"
                disabled={loadingConfig || saving || (!isPlaced && placed.length >= 16)}
                onClick={() => void handleToggleOrnament(opt)}
                className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                  isPlaced
                    ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-sky-50'
                }`}
              >
                <span className="text-base">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
