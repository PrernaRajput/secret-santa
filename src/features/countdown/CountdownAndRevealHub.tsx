import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  PackageCheck,
  RefreshCw,
  Sparkles,
  Gift,
  Eye,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  DeliveryAcknowledgmentRecord,
  DeliveryProgressRecord,
  IncomingAssignment,
  MatchAssignment,
  ParticipantProfile,
  SantaIdentityReveal,
  SecretSantaEvent,
  ThemeId,
  WorkshopFeatureId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { FestiveCharacters, ThemeCardTrim } from '../../components/themes/FestiveCharacters';
import { AvatarGraphic } from '../../components/avatars/AvatarGraphic';
import { ScratchRevealCard } from '../reveal/ScratchRevealCard';
import {
  fetchMyGifteeMatch,
  fetchMySecretSantaIdentity,
} from '../../services/secretSantaService';
import {
  subscribeToDeliveryAcknowledgment,
  subscribeToDeliveryProgress,
  subscribeToIncomingAssignment,
} from '../../services/workshopService';
import { DELIVERY_STAGES } from '../../data/workshopContent';
import { playChimeSound, playPopSound } from '../../utils/sound';
import { JoinConfettiCanvas } from '../../components/animations/JoinConfettiCanvas';
import { formatBudgetGuide, getDeliveryStageInfo } from '../../utils/workshopLogic';
import { SantasWorkshopHub } from '../workshop/SantasWorkshopHub';

interface CountdownAndRevealHubProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  participant: ParticipantProfile;
  isLiveFirestoreEvent: boolean;
  activeTab: 'home' | 'workshop';
  onChangeTab: (tab: 'home' | 'workshop') => void;
  celebrateOnMount?: boolean;
  onCelebrationComplete?: () => void;
  onEditDetails: () => void;
}

interface TimeParts {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  daysNum: number;
  hoursNum: number;
  minutesNum: number;
  secondsNum: number;
  expired: boolean;
}

function getCountdownParts(target: Date, nowMs: number): TimeParts {
  const diff = target.getTime() - nowMs;
  if (diff <= 0) {
    return {
      days: '00',
      hours: '00',
      minutes: '00',
      seconds: '00',
      daysNum: 0,
      hoursNum: 0,
      minutesNum: 0,
      secondsNum: 0,
      expired: true,
    };
  }
  const totalSec = Math.floor(diff / 1000);
  const daysNum = Math.floor(totalSec / 86400);
  const hoursNum = Math.floor((totalSec % 86400) / 3600);
  const minutesNum = Math.floor((totalSec % 3600) / 60);
  const secondsNum = totalSec % 60;
  return {
    days: String(daysNum).padStart(2, '0'),
    hours: String(hoursNum).padStart(2, '0'),
    minutes: String(minutesNum).padStart(2, '0'),
    seconds: String(secondsNum).padStart(2, '0'),
    daysNum,
    hoursNum,
    minutesNum,
    secondsNum,
    expired: false,
  };
}

function formatRemainingSummary(parts: TimeParts, targetLabel: string): string {
  if (parts.expired) {
    return `${targetLabel} has arrived!`;
  }
  const dayUnit = parts.daysNum === 1 ? 'day' : 'days';
  const hourUnit = parts.hoursNum === 1 ? 'hour' : 'hours';
  const minUnit = parts.minutesNum === 1 ? 'minute' : 'minutes';
  return `${parts.daysNum} ${dayUnit}, ${parts.hoursNum} ${hourUnit}, and ${parts.minutesNum} ${minUnit} remaining until ${targetLabel}`;
}

function formatReadableDate(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

const DEMO_PREVIEW_GIFTEE: MatchAssignment = {
  eventId: 'preview',
  giverKey: 'preview',
  outgoingAssignmentId: 'preview_outgoing_demo',
  recipientName: 'Meera Sharma',
  recipientAvatarId: 'holly-princess',
  recipientHobbies: ['Reading', 'Coffee', 'Chocolate', 'Baking'],
  recipientAddress: {
    line1: 'Flat 804, Emerald Heights, Sector 62',
    line2: 'Golf Course Extension Road',
    landmark: 'Near WorldMark Mall',
    city: 'Gurugram',
    state: 'Haryana',
    postalCode: '122011',
    phone: '+91 98112 34091',
  },
  recipientDislikes: {
    dislikedCategories: ['Strong Perfumes', 'Mugs'],
    dietaryRestrictions: ['Peanuts'],
    dislikedColors: ['Neon Green'],
    alreadyOwned: ['French Press'],
    nonFoodNotes: 'Prefer cozy or handmade touches!',
    generalNotes: '',
  },
};

const DEMO_PREVIEW_SANTA: SantaIdentityReveal = {
  eventId: 'preview',
  recipientKey: 'preview',
  santaName: 'Aarav Verma',
  santaAvatarId: 'holiday-nerd-boy',
  santaHobbies: ['Gaming', 'Technology', 'Anime', 'Coffee'],
};

export const CountdownAndRevealHub: React.FC<CountdownAndRevealHubProps> = ({
  theme,
  event,
  participant,
  isLiveFirestoreEvent,
  activeTab,
  onChangeTab,
  celebrateOnMount = false,
  onCelebrationComplete,
  onEditDetails,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [gifteeMatch, setGifteeMatch] = useState<MatchAssignment | null>(null);
  const [santaReveal, setSantaReveal] = useState<SantaIdentityReveal | null>(null);
  const [gifteeRevealed, setGifteeRevealed] = useState(false);
  const [santaRevealed, setSantaRevealed] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [gifteeNotInMatch, setGifteeNotInMatch] = useState(false);
  const [matchRetryTick, setMatchRetryTick] = useState(0);
  const [previewResetTick, setPreviewResetTick] = useState(0);
  const [showGifteeCardInStage3, setShowGifteeCardInStage3] = useState(false);
  const [showJoinConfetti, setShowJoinConfetti] = useState(celebrateOnMount);
  const [requestedWorkshopFeature, setRequestedWorkshopFeature] =
    useState<WorkshopFeatureId | null>(null);

  // Interactive preview toggle ONLY when event is not yet matched in Firestore
  const [previewStage, setPreviewStage] = useState<
    'live' | 'preview-giftee' | 'preview-santa'
  >('live');

  // Switch back to live view automatically once Admin runs live matching
  useEffect(() => {
    if (event.isMatched) {
      setPreviewStage('live');
    }
  }, [event.isMatched]);

  const jumpToWorkshopFeature = (feature: WorkshopFeatureId) => {
    setRequestedWorkshopFeature(feature);
    onChangeTab('workshop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (celebrateOnMount) {
      setShowJoinConfetti(true);
      playChimeSound();
    }
  }, [celebrateOnMount]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const gifteeTimer = useMemo(
    () => getCountdownParts(event.gifteeRevealAt, nowMs),
    [event.gifteeRevealAt, nowMs]
  );
  const giftDeadlineTimer = useMemo(
    () => getCountdownParts(event.giftDeadline, nowMs),
    [event.giftDeadline, nowMs]
  );
  const santaIdentityTimer = useMemo(
    () => getCountdownParts(event.santaIdentityRevealAt, nowMs),
    [event.santaIdentityRevealAt, nowMs]
  );

  // Lifted real-time delivery tracking & incoming channel state (persists across Home <-> Workshop tabs)
  const liveMatchedMode = isLiveFirestoreEvent && event.isMatched;
  const [incomingAssignment, setIncomingAssignment] = useState<IncomingAssignment | null>(null);
  const [incomingDelivery, setIncomingDelivery] = useState<DeliveryProgressRecord | null>(null);
  const [incomingAck, setIncomingAck] = useState<DeliveryAcknowledgmentRecord | null>(null);
  const [outgoingDelivery, setOutgoingDelivery] = useState<DeliveryProgressRecord | null>(null);
  const [deliverySyncError, setDeliverySyncError] = useState<string | null>(null);
  const [deliveryRetryTick, setDeliveryRetryTick] = useState(0);

  const gifteeRevealMs = event.gifteeRevealAt.getTime();
  const santaRevealMs = event.santaIdentityRevealAt.getTime();
  const matchedAtMs = event.matchedAt ? event.matchedAt.getTime() : 0;

  // Fetch giftee match from Firestore once gifteeRevealAt arrives
  // Retries with bounded backoff when client clock is slightly ahead of server time
  useEffect(() => {
    if (!isLiveFirestoreEvent || !event.isMatched) {
      setGifteeMatch(null);
      setGifteeNotInMatch(false);
      setLoadingMatch(false);
      return;
    }
    if (!gifteeTimer.expired) return;

    let active = true;
    let retryTimer: number | undefined;
    let attempt = 0;

    const loadMatch = async () => {
      if (!active) return;
      if (attempt === 0) {
        setLoadingMatch(true);
        setGifteeNotInMatch(false);
      }
      try {
        const res = await fetchMyGifteeMatch(participant.id);
        if (!active) return;
        if (!res.locked && res.match) {
          setGifteeMatch(res.match);
          setGifteeNotInMatch(false);
          setLoadingMatch(false);
          return;
        }
        if (res.notInMatch) {
          setGifteeMatch(null);
          setGifteeNotInMatch(true);
          setLoadingMatch(false);
          return;
        }
        if (res.locked && attempt < 6) {
          attempt += 1;
          const delayMs = attempt <= 3 ? 2000 : 4000;
          retryTimer = window.setTimeout(() => {
            void loadMatch();
          }, delayMs);
          return;
        }
        setLoadingMatch(false);
      } catch {
        if (active) setLoadingMatch(false);
      }
    };

    void loadMatch();
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [
    isLiveFirestoreEvent,
    event.isMatched,
    gifteeTimer.expired,
    gifteeRevealMs,
    matchedAtMs,
    participant.id,
    matchRetryTick,
  ]);

  // Fetch Secret Santa identity once santaIdentityRevealAt arrives
  useEffect(() => {
    if (!isLiveFirestoreEvent || !event.isMatched) {
      setSantaReveal(null);
      return;
    }
    if (!santaIdentityTimer.expired) return;

    let active = true;
    let retryTimer: number | undefined;
    let attempt = 0;

    const loadReveal = async () => {
      if (!active) return;
      try {
        const res = await fetchMySecretSantaIdentity(participant.id);
        if (!active) return;
        if (!res.locked && res.reveal) {
          setSantaReveal(res.reveal);
          return;
        }
        if (res.notInMatch) {
          setSantaReveal(null);
          return;
        }
        if (res.locked && attempt < 6) {
          attempt += 1;
          const delayMs = attempt <= 3 ? 2000 : 4000;
          retryTimer = window.setTimeout(() => {
            void loadReveal();
          }, delayMs);
        }
      } catch {
        // ignore transient errors
      }
    };

    void loadReveal();
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [
    isLiveFirestoreEvent,
    event.isMatched,
    santaIdentityTimer.expired,
    santaRevealMs,
    matchedAtMs,
    participant.id,
    matchRetryTick,
  ]);

  // Real-time subscription to participant's opaque incoming assignment handle
  useEffect(() => {
    setDeliverySyncError(null);
    return subscribeToIncomingAssignment(
      participant.id,
      liveMatchedMode,
      (assignment) => {
        setIncomingAssignment(assignment);
      },
      (errMsg) => {
        setDeliverySyncError(errMsg);
      }
    );
  }, [participant.id, liveMatchedMode, deliveryRetryTick]);

  const incomingAssignmentId = useMemo(() => {
    if (liveMatchedMode) {
      return incomingAssignment?.incomingAssignmentId || '';
    }
    return `preview_in_${participant.id.slice(0, 12)}`;
  }, [incomingAssignment?.incomingAssignmentId, liveMatchedMode, participant.id]);

  const outgoingAssignmentId = useMemo(() => {
    if (liveMatchedMode) {
      return gifteeMatch?.outgoingAssignmentId || '';
    }
    return `preview_out_${participant.id.slice(0, 12)}`;
  }, [gifteeMatch?.outgoingAssignmentId, liveMatchedMode, participant.id]);

  // Real-time subscription to incoming gift delivery progress & receipt confirmation
  useEffect(() => {
    if (!event.deliveryTrackingEnabled || !incomingAssignmentId) {
      setIncomingDelivery(null);
      setIncomingAck(null);
      return;
    }
    const unsubProg = subscribeToDeliveryProgress(
      incomingAssignmentId,
      event.id,
      liveMatchedMode,
      (rec) => {
        setDeliverySyncError(null);
        setIncomingDelivery(rec);
      },
      (errMsg) => {
        setDeliverySyncError(errMsg);
      }
    );
    const unsubAck = subscribeToDeliveryAcknowledgment(
      incomingAssignmentId,
      event.id,
      liveMatchedMode,
      (rec) => {
        setIncomingAck(rec);
      },
      (errMsg) => {
        setDeliverySyncError((prev) => prev || errMsg);
      }
    );
    return () => {
      unsubProg();
      unsubAck();
    };
  }, [event.deliveryTrackingEnabled, event.id, incomingAssignmentId, liveMatchedMode, deliveryRetryTick]);

  // Real-time subscription to outgoing gift delivery progress (once giftee assignment is known)
  useEffect(() => {
    if (!event.deliveryTrackingEnabled || !outgoingAssignmentId) {
      setOutgoingDelivery(null);
      return;
    }
    return subscribeToDeliveryProgress(
      outgoingAssignmentId,
      event.id,
      liveMatchedMode,
      (rec) => {
        setDeliverySyncError(null);
        setOutgoingDelivery(rec);
      },
      (errMsg) => {
        setDeliverySyncError((prev) => prev || errMsg);
      }
    );
  }, [event.deliveryTrackingEnabled, event.id, outgoingAssignmentId, liveMatchedMode, deliveryRetryTick]);

  // Determine active stage
  const showingGifteeReveal =
    previewStage === 'preview-giftee' ||
    (previewStage === 'live' && event.isMatched && gifteeTimer.expired && !giftDeadlineTimer.expired);

  const showingSantaIdentityCountdown =
    previewStage === 'live' &&
    event.isMatched &&
    giftDeadlineTimer.expired &&
    !santaIdentityTimer.expired;

  const showingSantaIdentityReveal =
    previewStage === 'preview-santa' ||
    (previewStage === 'live' && event.isMatched && santaIdentityTimer.expired);

  const activeGiftee =
    previewStage === 'preview-giftee' ? DEMO_PREVIEW_GIFTEE : gifteeMatch;
  const activeSantaIdentity =
    previewStage === 'preview-santa' ? DEMO_PREVIEW_SANTA : santaReveal;

  const characterMood =
    gifteeRevealed || santaRevealed
      ? theme === 'funny'
        ? 'fainting'
        : 'celebrating'
      : showJoinConfetti
        ? 'celebrating'
        : 'checklist';

  const ringStroke =
    theme === 'chocolate'
      ? '#b45309'
      : theme === 'funny'
        ? '#db2777'
        : '#e11d48';

  const ringTrack =
    theme === 'chocolate'
      ? '#ecd3ad'
      : theme === 'funny'
        ? '#fde68a'
        : '#e0e7ff';

  const renderTimerBlocks = (parts: TimeParts, targetLabel = 'Reveal Time') => {
    const circumference = 2 * Math.PI * 30;
    const units = [
      {
        label: 'Days',
        value: parts.days,
        progress: Math.min(1, parts.daysNum / 30),
      },
      {
        label: 'Hours',
        value: parts.hours,
        progress: parts.hoursNum / 24,
      },
      {
        label: 'Minutes',
        value: parts.minutes,
        progress: parts.minutesNum / 60,
      },
      {
        label: 'Seconds',
        value: parts.seconds,
        progress: parts.secondsNum / 60,
      },
    ];

    return (
      <div className="space-y-3">
        <div
          role="timer"
          aria-live="off"
          aria-label={formatRemainingSummary(parts, targetLabel)}
          className="grid grid-cols-4 gap-2 sm:gap-3.5 max-w-lg mx-auto"
        >
          {units.map((block) => {
            const dashOffset = circumference * (1 - Math.max(0.04, block.progress));
            return (
              <div
                key={block.label}
                className={`relative rounded-2xl py-3 px-1.5 sm:px-2.5 border shadow-sm flex flex-col items-center justify-center transition-colors ${
                  theme === 'chocolate'
                    ? 'bg-[#fffaf2] border-[#cfa375]'
                    : theme === 'funny'
                      ? 'bg-[#fffdf5] border-amber-400'
                      : 'bg-white border-indigo-200'
                }`}
              >
                <div className="relative w-16 h-16 sm:w-[74px] sm:h-[74px] flex items-center justify-center">
                  <svg
                    viewBox="0 0 72 72"
                    className="w-full h-full -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="36"
                      cy="36"
                      r="30"
                      fill="none"
                      stroke={ringTrack}
                      strokeWidth="5"
                    />
                    <circle
                      cx="36"
                      cy="36"
                      r="30"
                      fill="none"
                      stroke={ringStroke}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      className="transition-[stroke-dashoffset] duration-700 ease-out"
                    />
                  </svg>
                  <motion.span
                    key={`${block.label}-${block.value}`}
                    initial={{ y: -6, opacity: 0.35, scale: 0.92 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                    className={`absolute font-mono-tabular text-xl sm:text-2xl font-extrabold ${cfg.cardText}`}
                  >
                    {block.value}
                  </motion.span>
                </div>
                <p
                  className={`text-[11px] font-bold uppercase tracking-wider mt-1 ${cfg.mutedText}`}
                >
                  {block.label}
                </p>
              </div>
            );
          })}
        </div>

        <p className={`text-xs sm:text-sm font-semibold ${cfg.mutedText}`}>
          {formatRemainingSummary(parts, targetLabel)}
        </p>
      </div>
    );
  };

  return (
    <>
      <JoinConfettiCanvas
        active={showJoinConfetti}
        theme={theme}
        onComplete={() => {
          setShowJoinConfetti(false);
          onCelebrationComplete?.();
        }}
      />
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-3xl mx-auto flex flex-col items-center"
      >
        {activeTab === 'home' ? (
          <>
            <FestiveCharacters theme={theme} mood={characterMood} />

            <div className={`w-full rounded-[28px] overflow-hidden -mt-4 ${cfg.cardClass}`}>
              <ThemeCardTrim theme={theme} />

              <div className="p-5 sm:p-8 space-y-6">
          {/* Participant Status Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/10">
            <div className="flex items-center gap-3">
              <AvatarGraphic avatarId={participant.avatarId} size={52} className="w-13 h-13 shrink-0" />
              <div>
                <p className={`font-display text-lg font-bold leading-tight ${cfg.cardText}`}>
                  {participant.name}
                </p>
                <p className={`text-xs ${cfg.mutedText}`}>
                  {participant.address.city} · {participant.hobbies.length} gift clues saved
                </p>
              </div>
            </div>

            {!event.isMatched && (
              <button
                type="button"
                onClick={() => {
                  playPopSound();
                  onEditDetails();
                }}
                className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer ${cfg.secondaryBtnClass}`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit my details
              </button>
            )}
          </div>

          {/* Feature 9: Gift Budget Guide Banner */}
          <div
            className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${
              theme === 'chocolate'
                ? 'bg-[#fff6e5] border-[#cfa375]'
                : 'bg-amber-50/90 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-sm text-amber-950">
                  Gift Budget Guide: {formatBudgetGuide(event.budget)}
                </p>
                {event.budget.announcement && (
                  <p className="text-xs text-amber-900/80 truncate">{event.budget.announcement}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => jumpToWorkshopFeature('dislikes')}
              className="text-xs font-bold text-rose-700 hover:underline cursor-pointer whitespace-nowrap"
            >
              Set my dislikes →
            </button>
          </div>

          {/* STAGE 2: GIFTEE SCRATCH & SHAKE REVEAL */}
          {showingGifteeReveal ? (
            <div className="space-y-6 text-center">
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Reveal Unlocked · Stage 1 of 2
                </p>
                <h1 className={`font-display text-3xl sm:text-4xl font-bold ${cfg.cardText}`}>
                  It&apos;s reveal time! 🎉
                </h1>
                <p className={`text-sm ${cfg.mutedText}`}>
                  Scratch the card or shake your phone to discover who gets your gift!
                </p>
              </div>

              {loadingMatch ? (
                <div className="py-8 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-rose-600" />
                  <p className={`text-sm font-medium ${cfg.mutedText}`}>
                    Unlocking your giftee match from Santa&apos;s vault...
                  </p>
                </div>
              ) : activeGiftee ? (
                <ScratchRevealCard
                  key={`giftee-${previewStage}-${activeGiftee.giverKey}-${activeGiftee.recipientName}-${previewResetTick}`}
                  theme={theme}
                  mode="giftee"
                  personName={activeGiftee.recipientName}
                  personAvatarId={activeGiftee.recipientAvatarId}
                  personHobbies={activeGiftee.recipientHobbies}
                  personAddress={activeGiftee.recipientAddress}
                  budgetText={formatBudgetGuide(event.budget)}
                  budgetAnnouncement={event.budget.announcement}
                  recipientDislikes={activeGiftee.recipientDislikes}
                  alreadyRevealed={gifteeRevealed}
                  onRevealed={() => setGifteeRevealed(true)}
                  onOpenMailbox={() => jumpToWorkshopFeature('mailbox-outgoing')}
                  onOpenDelivery={() => jumpToWorkshopFeature('delivery-outgoing')}
                />
              ) : (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-950 space-y-3">
                  <p>
                    {gifteeNotInMatch
                      ? 'Your profile was not included in the current matching round. Ask the organizer to verify your registration or re-run matching.'
                      : 'Your giftee reveal is syncing with the official reveal clock. Tap below to check again.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setMatchRetryTick((n) => n + 1);
                    }}
                    className="min-h-[38px] px-4 py-1.5 rounded-full bg-amber-900 hover:bg-amber-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Check Again
                  </button>
                </div>
              )}

              {/* Gift Sending Deadline Countdown Banner */}
              <div
                className={`rounded-2xl border p-4 space-y-3 ${
                  theme === 'chocolate'
                    ? 'bg-[#f8e7ce] border-[#cfa375]'
                    : 'bg-rose-50/90 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-rose-800">
                  <Gift className="w-4 h-4" />
                  <span>
                    Send your gift before {formatReadableDate(event.giftDeadline, event.timezone)}!
                  </span>
                </div>
                {renderTimerBlocks(giftDeadlineTimer, 'Gift Deadline')}
                <p className="text-xs text-rose-900/75">
                  After the gift deadline passes, the countdown to reveal who YOUR Secret Santa is will begin!
                </p>
              </div>
            </div>
          ) : showingSantaIdentityCountdown ? (
            /* STAGE 3A: COUNTDOWN TO SECRET SANTA IDENTITY REVEAL */
            <div className="space-y-6 text-center">
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  Gifts Sent · Final Mystery Countdown
                </p>
                <h1 className={`font-display text-3xl sm:text-4xl font-bold ${cfg.cardText}`}>
                  Who is YOUR Secret Santa? 🎅
                </h1>
                <p className={`text-sm ${cfg.mutedText}`}>
                  Hope you loved your surprise! The grand Secret Santa identity reveal unlocks on:
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-sm font-bold">
                <Calendar className="w-4 h-4" />
                {formatReadableDate(event.santaIdentityRevealAt, event.timezone)}
              </div>

              {renderTimerBlocks(santaIdentityTimer, 'Secret Santa Identity Reveal')}

              {activeGiftee && (
                <div className="pt-3 border-t border-black/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
                    <span>
                      You gifted <span className="font-bold">{activeGiftee.recipientName}</span> 🎁
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playPopSound();
                        setShowGifteeCardInStage3((v) => !v);
                      }}
                      className="font-bold text-rose-700 hover:underline cursor-pointer"
                    >
                      {showGifteeCardInStage3 ? 'Hide Giftee Card' : 'View My Giftee Card →'}
                    </button>
                  </div>
                  {showGifteeCardInStage3 && (
                    <ScratchRevealCard
                      key={`stage3a-giftee-${activeGiftee.giverKey}-${activeGiftee.recipientName}`}
                      theme={theme}
                      mode="giftee"
                      personName={activeGiftee.recipientName}
                      personAvatarId={activeGiftee.recipientAvatarId}
                      personHobbies={activeGiftee.recipientHobbies}
                      personAddress={activeGiftee.recipientAddress}
                      budgetText={formatBudgetGuide(event.budget)}
                      budgetAnnouncement={event.budget.announcement}
                      recipientDislikes={activeGiftee.recipientDislikes}
                      alreadyRevealed={true}
                      onOpenMailbox={() => jumpToWorkshopFeature('mailbox-outgoing')}
                      onOpenDelivery={() => jumpToWorkshopFeature('delivery-outgoing')}
                    />
                  )}
                </div>
              )}
            </div>
          ) : showingSantaIdentityReveal ? (
            /* STAGE 3B: SECRET SANTA IDENTITY REVEAL WITH SCRATCH/SHAKE + FAAAAH */
            <div className="space-y-6 text-center">
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-purple-700">
                  Grand Finale · Secret Santa Identity Reveal
                </p>
                <h1 className={`font-display text-3xl sm:text-4xl font-bold ${cfg.cardText}`}>
                  Meet Your Secret Santa! 🎅✨
                </h1>
                <p className={`text-sm ${cfg.mutedText}`}>
                  Scratch the card or shake your phone to find out who sent your gift!
                </p>
              </div>

              {activeSantaIdentity ? (
                <ScratchRevealCard
                  key={`santa-${previewStage}-${activeSantaIdentity.recipientKey}-${activeSantaIdentity.santaName}-${previewResetTick}`}
                  theme={theme}
                  mode="secret-santa"
                  personName={activeSantaIdentity.santaName}
                  personAvatarId={activeSantaIdentity.santaAvatarId}
                  personHobbies={activeSantaIdentity.santaHobbies}
                  alreadyRevealed={santaRevealed}
                  onRevealed={() => setSantaRevealed(true)}
                />
              ) : (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-950 space-y-3">
                  <p>
                    Your Secret Santa identity is syncing or waiting for the organizer to run matching.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setMatchRetryTick((n) => n + 1);
                    }}
                    className="min-h-[38px] px-4 py-1.5 rounded-full bg-amber-900 hover:bg-amber-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Check Again
                  </button>
                </div>
              )}

              {activeGiftee && previewStage === 'live' && (
                <div className="pt-3 border-t border-black/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
                    <span>
                      You gifted <span className="font-bold">{activeGiftee.recipientName}</span> 🎁
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playPopSound();
                        setShowGifteeCardInStage3((v) => !v);
                      }}
                      className="font-bold text-rose-700 hover:underline cursor-pointer"
                    >
                      {showGifteeCardInStage3 ? 'Hide Giftee Card' : 'View My Giftee Card →'}
                    </button>
                  </div>
                  {showGifteeCardInStage3 && (
                    <ScratchRevealCard
                      key={`stage3b-giftee-${activeGiftee.giverKey}-${activeGiftee.recipientName}`}
                      theme={theme}
                      mode="giftee"
                      personName={activeGiftee.recipientName}
                      personAvatarId={activeGiftee.recipientAvatarId}
                      personHobbies={activeGiftee.recipientHobbies}
                      personAddress={activeGiftee.recipientAddress}
                      budgetText={formatBudgetGuide(event.budget)}
                      budgetAnnouncement={event.budget.announcement}
                      recipientDislikes={activeGiftee.recipientDislikes}
                      alreadyRevealed={true}
                      onOpenMailbox={() => jumpToWorkshopFeature('mailbox-outgoing')}
                      onOpenDelivery={() => jumpToWorkshopFeature('delivery-outgoing')}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            /* STAGE 1: YOU'RE IN! COUNTDOWN TO GIFTEE REVEAL */
            <div className="space-y-6 text-center">
              <div className="space-y-1.5">
                <h1 className={`font-display text-4xl sm:text-5xl font-bold ${cfg.cardText}`}>
                  You&apos;re in! 🎉
                </h1>
                <p className={`text-sm sm:text-base font-medium ${cfg.mutedText}`}>
                  {gifteeTimer.expired && !event.isMatched
                    ? 'Reveal time has arrived! Waiting for the organizer to run matching...'
                    : 'Santa is secretly working on your surprise...'}
                </p>
              </div>

              {/* Target Reveal Date */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-950 text-amber-200 text-xs sm:text-sm font-semibold shadow-sm">
                  <Calendar className="w-4 h-4 text-amber-300" />
                  <span>
                    Giftee Reveal: {formatReadableDate(event.gifteeRevealAt, event.timezone)}
                  </span>
                </div>

                {renderTimerBlocks(gifteeTimer, 'Reveal Time')}
              </div>

              {/* Animated Gift Exchange Ring Visual */}
              <div className="py-2 flex items-center justify-center gap-4 sm:gap-7">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.8 }}
                  className="rounded-2xl bg-white/80 p-1.5 shadow-md"
                >
                  <AvatarGraphic avatarId={participant.avatarId} size={56} />
                </motion.div>

                <motion.div
                  animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-xl flex items-center justify-center text-3xl border-2 border-amber-300"
                >
                  🎁
                </motion.div>

                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.8, delay: 0.4 }}
                  className="w-[68px] h-[68px] rounded-2xl bg-gradient-to-br from-amber-200 to-rose-200 border-2 border-white shadow-md flex items-center justify-center font-display text-3xl font-bold text-rose-700"
                >
                  ?
                </motion.div>
              </div>

              {/* Upcoming Schedule Timeline */}
              <div className="rounded-2xl bg-black/5 px-4 py-3 text-xs text-left space-y-1.5">
                <div className={`flex items-center justify-between ${cfg.mutedText}`}>
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    Send gifts before:
                  </span>
                  <span className="font-mono-tabular font-semibold">
                    {formatReadableDate(event.giftDeadline, event.timezone)}
                  </span>
                </div>
                <div className={`flex items-center justify-between ${cfg.mutedText}`}>
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    Secret Santa identity reveal:
                  </span>
                  <span className="font-mono-tabular font-semibold">
                    {formatReadableDate(event.santaIdentityRevealAt, event.timezone)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Live Gift Tracking Status Panel inside the Hub */}
          {event.deliveryTrackingEnabled && (
            <div className="rounded-2xl bg-slate-950 text-white border border-white/15 p-4 sm:p-5 space-y-3.5 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-300/20 border border-amber-300/35 text-amber-300 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-bold leading-tight">
                      Live Gift Tracking
                    </h2>
                    <p className="text-[11px] text-sky-200/80">
                      {liveMatchedMode
                        ? 'Synced live with Santa’s Delivery Express'
                        : 'Interactive preview · syncs live once matching runs'}
                    </p>
                  </div>
                </div>
                {deliverySyncError && (
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setDeliveryRetryTick((n) => n + 1);
                    }}
                    className="min-h-[34px] px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                )}
              </div>

              {deliverySyncError && (
                <div className="rounded-xl bg-rose-500/20 border border-rose-300/40 px-3 py-2 text-xs text-rose-100 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
                  <span>{deliverySyncError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Incoming Gift Status Card */}
                {(() => {
                  const waitingIncoming = liveMatchedMode && !incomingAssignmentId;
                  const stageInfo = getDeliveryStageInfo(incomingDelivery?.stage || 'preparing');
                  const stageIdx = Math.max(
                    0,
                    DELIVERY_STAGES.findIndex((s) => s.id === stageInfo.id)
                  );
                  const pct =
                    DELIVERY_STAGES.length > 1
                      ? ((stageIdx + 1) / DELIVERY_STAGES.length) * 100
                      : 100;
                  return (
                    <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 flex flex-col justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                            Incoming Surprise
                          </span>
                          {incomingAck?.status === 'received' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Received
                            </span>
                          ) : incomingAck?.status === 'problem' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-300">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Issue Reported
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono-tabular text-sky-200/80">
                              {waitingIncoming ? '...' : `${stageIdx + 1}/${DELIVERY_STAGES.length}`}
                            </span>
                          )}
                        </div>
                        <p className="font-display text-base font-bold text-white">
                          {waitingIncoming
                            ? 'Syncing sleigh channel...'
                            : `${stageInfo.emoji} ${stageInfo.label}`}
                        </p>
                        <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-300 transition-all duration-500"
                            style={{ width: waitingIncoming ? '12%' : `${pct}%` }}
                          />
                        </div>
                        {incomingDelivery?.sharedNote ? (
                          <p className="text-[11px] text-amber-100/90 italic truncate">
                            &ldquo;{incomingDelivery.sharedNote}&rdquo;
                          </p>
                        ) : (
                          <p className="text-[11px] text-sky-100/75 line-clamp-1">
                            {stageInfo.recipientMessage}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={waitingIncoming}
                        onClick={() => {
                          playPopSound();
                          jumpToWorkshopFeature('delivery-incoming');
                        }}
                        className="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-300 hover:bg-amber-200 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        Track &amp; Confirm Gift →
                      </button>
                    </div>
                  );
                })()}

                {/* Outgoing Gift Status Card (Sender Mission) */}
                {(() => {
                  const senderReady =
                    !liveMatchedMode || (gifteeTimer.expired && Boolean(gifteeMatch));
                  const stageInfo = getDeliveryStageInfo(outgoingDelivery?.stage || 'preparing');
                  const stageIdx = Math.max(
                    0,
                    DELIVERY_STAGES.findIndex((s) => s.id === stageInfo.id)
                  );
                  const pct =
                    DELIVERY_STAGES.length > 1
                      ? ((stageIdx + 1) / DELIVERY_STAGES.length) * 100
                      : 100;
                  return (
                    <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 flex flex-col justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                            Outgoing Gift Mission
                          </span>
                          <span className="text-[11px] font-mono-tabular text-sky-200/80">
                            {senderReady ? `${stageIdx + 1}/${DELIVERY_STAGES.length}` : 'Locked'}
                          </span>
                        </div>
                        <p className="font-display text-base font-bold text-white truncate">
                          {senderReady
                            ? `${stageInfo.emoji} ${stageInfo.label}`
                            : '🔒 Unlocks After Giftee Reveal'}
                        </p>
                        <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-300 transition-all duration-500"
                            style={{ width: senderReady ? `${pct}%` : '0%' }}
                          />
                        </div>
                        <p className="text-[11px] text-sky-100/75 truncate">
                          {senderReady
                            ? `Sending to ${activeGiftee?.recipientName || 'Your Giftee'}`
                            : 'Update checkpoints once your giftee is revealed'}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={!senderReady}
                        onClick={() => {
                          playPopSound();
                          jumpToWorkshopFeature('delivery-outgoing');
                        }}
                        className="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        Update Sleigh Status →
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Interactive Demo Stage Switcher (only shown before live admin matching completes, so reviewers can immediately try Scratch + Shake + FAAAAH!) */}
          {!event.isMatched && (
            <div className="pt-4 border-t border-black/10 space-y-2.5">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600">
                <Eye className="w-3.5 h-3.5" />
                <span>Interactive Preview (until Admin runs live matching):</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setPreviewStage('live');
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
                    previewStage === 'live' ? cfg.chipSelectedClass : cfg.chipIdleClass
                  }`}
                >
                  Countdown View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setGifteeRevealed(false);
                    setPreviewResetTick((n) => n + 1);
                    setPreviewStage('preview-giftee');
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
                    previewStage === 'preview-giftee' ? cfg.chipSelectedClass : cfg.chipIdleClass
                  }`}
                >
                  Try Giftee Scratch &amp; Shake
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setSantaRevealed(false);
                    setPreviewResetTick((n) => n + 1);
                    setPreviewStage('preview-santa');
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
                    previewStage === 'preview-santa' ? cfg.chipSelectedClass : cfg.chipIdleClass
                  }`}
                >
                  Try Secret Santa Identity Reveal
                </button>
              </div>
            </div>
          )}
              </div>
            </div>
          </>
        ) : (
          /* Dedicated Workshop Tab (Mailbox, Sleigh, Advent Calendar & Games) */
          <div className="w-full">
            <SantasWorkshopHub
              theme={theme}
              event={event}
              participant={participant}
              gifteeMatch={activeGiftee}
              santaReveal={activeSantaIdentity}
              incomingAssignment={incomingAssignment}
              incomingDelivery={incomingDelivery}
              incomingAck={incomingAck}
              outgoingDelivery={outgoingDelivery}
              gifteeRevealReady={showingGifteeReveal || showingSantaIdentityCountdown || showingSantaIdentityReveal}
              santaIdentityReady={showingSantaIdentityReveal}
              countdownSummaryLabel={
                showingSantaIdentityReveal
                  ? 'Meet Your Secret Santa! 🎅'
                  : showingSantaIdentityCountdown
                    ? `${santaIdentityTimer.days}d ${santaIdentityTimer.hours}h ${santaIdentityTimer.minutes}m`
                    : showingGifteeReveal
                      ? 'Giftee Reveal Unlocked! 🎉'
                      : `${gifteeTimer.days}d ${gifteeTimer.hours}h ${gifteeTimer.minutes}m`
              }
              isLiveFirestoreEvent={isLiveFirestoreEvent}
              requestedFeature={requestedWorkshopFeature}
              onClearRequestedFeature={() => setRequestedWorkshopFeature(null)}
              onTriggerGrandReveal={() => {
                if (!event.isMatched) {
                  setPreviewStage('preview-giftee');
                  setGifteeRevealed(false);
                }
                onChangeTab('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </motion.section>
    </>
  );
};
