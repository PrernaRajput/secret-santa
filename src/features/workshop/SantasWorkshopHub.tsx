import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  CalendarDays,
  Compass,
  Cookie,
  Disc3,
  Heart,
  HelpCircle,
  Lock,
  Mail,
  ShieldAlert,
  Sparkles,
  Truck,
  Wand2,
} from 'lucide-react';
import {
  AdventUnlockRecord,
  DailyWheelSpinRecord,
  DeliveryAcknowledgmentRecord,
  DeliveryProgressRecord,
  ElfDiscoveryRecord,
  ElfHidingSpotId,
  GingerbreadDesign,
  IncomingAssignment,
  MatchAssignment,
  ParticipantProfile,
  PublicRosterEntry,
  SantaIdentityReveal,
  SecretSantaEvent,
  ThemeId,
  WorkshopFeatureId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import workshopHeroImg from '../../assets/images/santas_workshop_hero_1795780814432.jpg';
import {
  formatBudgetGuide,
  getDailyElfChallenge,
  getDeliveryStageInfo,
  getEventLocalDateKey,
} from '../../utils/workshopLogic';
import { sha256Hex } from '../../utils/crypto';
import {
  fetchAdventUnlocks,
  fetchEventRoster,
  fetchGingerbreadDesign,
  fetchRecentWheelSpins,
  fetchServerClockAndElf,
  fetchTodayElfDiscovery,
  recordElfDiscovery,
  ServerWorkshopClock,
} from '../../services/workshopService';
import { playChimeSound, playMagicSparkleSound, playPopSound } from '../../utils/sound';
import { WORKSHOP_DATA_RESET_EVENT } from '../../services/adminTestingResetService';
import { AnonymousMailboxView } from './AnonymousMailboxView';
import { GuessYourSantaView } from './GuessYourSantaView';
import { DeliveryTrackerView } from './DeliveryTrackerView';
import { ThankYouCardView } from './ThankYouCardView';
import { AdventCalendarView } from './AdventCalendarView';
import { SantasWheelView } from './SantasWheelView';
import { NaughtyOrNiceView } from './NaughtyOrNiceView';
import {
  ElfRewardModal,
  HiddenElfHuntView,
  PeekingElfWidget,
} from './HiddenElfCompanion';
import { GingerbreadCookiePreview, GingerbreadStudioView } from './GingerbreadStudioView';
import { GiftDislikesView } from './GiftDislikesView';
import {
  CollectibleOrnamentOption,
  InteractiveSnowGlobe,
} from './InteractiveSnowGlobe';

interface SantasWorkshopHubProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  participant: ParticipantProfile;
  gifteeMatch: MatchAssignment | null;
  santaReveal: SantaIdentityReveal | null;
  incomingAssignment?: IncomingAssignment | null;
  incomingDelivery?: DeliveryProgressRecord | null;
  incomingAck?: DeliveryAcknowledgmentRecord | null;
  outgoingDelivery?: DeliveryProgressRecord | null;
  gifteeRevealReady: boolean;
  santaIdentityReady: boolean;
  countdownSummaryLabel: string;
  isLiveFirestoreEvent: boolean;
  requestedFeature?: WorkshopFeatureId | null;
  onClearRequestedFeature?: () => void;
  onTriggerGrandReveal?: () => void;
  onOpenGoldenSecretEnvelope?: () => Promise<void> | void;
}

const DEMO_PREVIEW_ROSTER: PublicRosterEntry[] = [
  { publicId: 'demo-meera', name: 'Meera Sharma', avatarId: 'holly-princess' },
  { publicId: 'demo-aarav', name: 'Aarav Verma', avatarId: 'holiday-nerd-boy' },
  { publicId: 'demo-ananya', name: 'Ananya Kapoor', avatarId: 'earmuffs-bookworm' },
  { publicId: 'demo-kabir', name: 'Kabir Malhotra', avatarId: 'green-beanie-boy' },
  { publicId: 'demo-riya', name: 'Riya Nair', avatarId: 'reindeer-hoodie-girl' },
];

type WorkshopLane = 'mission' | 'incoming' | 'toys';

interface WorkshopTile {
  id: WorkshopFeatureId;
  lane: WorkshopLane;
  title: string;
  subtitle: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  lockedReason?: string;
  elfSpotId?: ElfHidingSpotId;
}

export const SantasWorkshopHub: React.FC<SantasWorkshopHubProps> = ({
  theme,
  event,
  participant,
  gifteeMatch,
  santaReveal,
  incomingAssignment = null,
  incomingDelivery = null,
  incomingAck = null,
  outgoingDelivery = null,
  gifteeRevealReady,
  santaIdentityReady,
  countdownSummaryLabel,
  isLiveFirestoreEvent,
  requestedFeature,
  onClearRequestedFeature,
  onTriggerGrandReveal,
  onOpenGoldenSecretEnvelope,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const liveMatchedMode = isLiveFirestoreEvent && event.isMatched;

  const [activeFeature, setActiveFeature] = useState<WorkshopFeatureId | 'overview'>('overview');
  const [activeLane, setActiveLane] = useState<WorkshopLane>('incoming');

  // Authoritative server clock & daily elf challenge
  const [clock, setClock] = useState<ServerWorkshopClock>(() => {
    const now = new Date();
    const dateKey = getEventLocalDateKey(now, event.timezone || 'Asia/Kolkata');
    return {
      serverNow: now,
      dateKey,
      timezone: event.timezone || 'Asia/Kolkata',
      elfChallenge: getDailyElfChallenge(dateKey, event.id),
      fromServer: false,
    };
  });

  // Roster & collectibles
  const [roster, setRoster] = useState<PublicRosterEntry[]>([]);
  const [selfPublicId, setSelfPublicId] = useState<string>('');
  const [adventUnlocks, setAdventUnlocks] = useState<AdventUnlockRecord[]>([]);
  const [wheelSpins, setWheelSpins] = useState<DailyWheelSpinRecord[]>([]);
  const [elfDiscovery, setElfDiscovery] = useState<ElfDiscoveryRecord | null>(null);
  const [elfHydrated, setElfHydrated] = useState(false);
  const [showElfModal, setShowElfModal] = useState(false);
  const [savedCookie, setSavedCookie] = useState<GingerbreadDesign | null>(null);
  const [resetRefreshTick, setResetRefreshTick] = useState(0);
  const catchingElfRef = useRef(false);

  // Re-hydrate immediately when Admin runs a pre-publish testing reset
  useEffect(() => {
    const onDataReset = () => {
      setResetRefreshTick((n) => n + 1);
    };
    window.addEventListener(WORKSHOP_DATA_RESET_EVENT, onDataReset);
    return () => window.removeEventListener(WORKSHOP_DATA_RESET_EVENT, onDataReset);
  }, []);

  // Honor external quick-jump requests (e.g. from Reveal Card -> Mailbox / Delivery)
  useEffect(() => {
    if (requestedFeature) {
      setActiveFeature(requestedFeature);
      onClearRequestedFeature?.();
    }
  }, [requestedFeature, onClearRequestedFeature]);

  // Load authoritative server time, elf challenge, roster, and collectibles
  useEffect(() => {
    let active = true;
    const tz = event.timezone || 'Asia/Kolkata';

    async function hydrateWorkshop() {
      setElfHydrated(false);
      try {
        const [serverClock, pubId] = await Promise.all([
          fetchServerClockAndElf(tz, event.id),
          sha256Hex(`pub:${participant.id}`),
        ]);
        if (!active) return;
        setClock(serverClock);
        setSelfPublicId(pubId);

        const [liveRoster, unlocks, spins, todayElf, cookie] = await Promise.all([
          liveMatchedMode ? fetchEventRoster(event.id) : Promise.resolve([]),
          fetchAdventUnlocks(participant.id, isLiveFirestoreEvent),
          fetchRecentWheelSpins(participant.id, serverClock.serverNow, tz, isLiveFirestoreEvent),
          fetchTodayElfDiscovery(participant.id, serverClock.dateKey, isLiveFirestoreEvent),
          fetchGingerbreadDesign(participant.id, event.id, isLiveFirestoreEvent),
        ]);
        if (!active) return;
        setRoster(liveRoster);
        setAdventUnlocks(unlocks);
        setWheelSpins(spins);
        setElfDiscovery(todayElf);
        setSavedCookie(cookie);
      } finally {
        if (active) {
          setElfHydrated(true);
        }
      }
    }

    void hydrateWorkshop();
    return () => {
      active = false;
    };
  }, [event.id, event.timezone, isLiveFirestoreEvent, liveMatchedMode, participant.id, resetRefreshTick]);

  // Separate opaque assignment IDs (NEVER mix sender & recipient threads, and NEVER fall back to preview IDs in live mode!)
  const outgoingAssignmentId = useMemo(() => {
    if (liveMatchedMode) {
      return gifteeMatch?.outgoingAssignmentId || '';
    }
    return `preview_out_${participant.id.slice(0, 12)}`;
  }, [gifteeMatch?.outgoingAssignmentId, liveMatchedMode, participant.id]);

  const incomingAssignmentId = useMemo(() => {
    if (liveMatchedMode) {
      return incomingAssignment?.incomingAssignmentId || '';
    }
    return `preview_in_${participant.id.slice(0, 12)}`;
  }, [incomingAssignment?.incomingAssignmentId, liveMatchedMode, participant.id]);

  const effectiveRoster = useMemo(() => {
    if (liveMatchedMode && roster.length > 0) return roster;
    return DEMO_PREVIEW_ROSTER;
  }, [liveMatchedMode, roster]);

  // Aggregate unlocked ornaments from Advent + Wheel + Elf into the Snow Globe
  const unlockedCollectibles = useMemo<CollectibleOrnamentOption[]>(() => {
    const items: CollectibleOrnamentOption[] = [];
    adventUnlocks.forEach((u) => {
      if (u.collectibleId) {
        items.push({
          collectibleId: u.collectibleId,
          label: u.collectibleName || `Advent Day ${u.day}`,
          emoji: u.collectibleEmoji || '🎄',
          source: `Advent Day ${u.day}`,
        });
      }
    });
    wheelSpins.forEach((s) => {
      if (s.collectibleId) {
        items.push({
          collectibleId: s.collectibleId,
          label: s.collectibleName || s.prizeLabel,
          emoji: s.prizeEmoji || '🎡',
          source: "Santa's Wheel",
        });
      }
    });
    if (elfDiscovery?.collectibleId) {
      items.push({
        collectibleId: elfDiscovery.collectibleId,
        label: elfDiscovery.rewardTitle,
        emoji: elfDiscovery.rewardEmoji || '🧝',
        source: 'Hidden Elf',
      });
    }
    return items;
  }, [adventUnlocks, elfDiscovery, wheelSpins]);

  const handleCatchElf = useCallback(
    async (options?: { openModal?: boolean }) => {
      if (elfDiscovery || catchingElfRef.current) return;
      catchingElfRef.current = true;
      try {
        const saved = await recordElfDiscovery({
          eventId: event.id,
          participantKey: participant.id,
          dateKey: clock.dateKey,
          challengeId: clock.elfChallenge.challengeId,
          spotId: clock.elfChallenge.spotId,
          rewardTitle: clock.elfChallenge.reward.title,
          rewardEmoji: clock.elfChallenge.reward.emoji,
          collectibleId: clock.elfChallenge.reward.collectibleId,
          liveMode: isLiveFirestoreEvent,
        });
        setElfDiscovery(saved);
        if (options?.openModal !== false) {
          playMagicSparkleSound();
          playChimeSound();
          confetti({
            particleCount: 75,
            spread: 75,
            origin: { y: 0.55 },
            colors: cfg.confettiColors,
          });
          setShowElfModal(true);
        }
      } catch (err) {
        if (options?.openModal === false) {
          throw err;
        }
      } finally {
        catchingElfRef.current = false;
      }
    },
    [
      cfg.confettiColors,
      clock.dateKey,
      clock.elfChallenge,
      elfDiscovery,
      event.id,
      isLiveFirestoreEvent,
      participant.id,
    ]
  );

  const handleJumpToWorkshopSpot = useCallback(() => {
    const spotId = clock.elfChallenge.spotId;
    if (spotId === 'mailbox' || spotId === 'giftbox') {
      setActiveLane('incoming');
    } else if (spotId === 'calendar' || spotId === 'tree') {
      setActiveLane('toys');
    }
    setActiveFeature('overview');
  }, [clock.elfChallenge.spotId]);

  const budgetText = formatBudgetGuide(event.budget);

  // Build role-separated Workshop tiles
  const senderUnlocked = !liveMatchedMode || (gifteeRevealReady && Boolean(gifteeMatch));
  const incomingUnlocked = !liveMatchedMode || Boolean(incomingAssignment);

  const tiles: WorkshopTile[] = useMemo(
    () => [
      // Lane 1: My Secret Mission (Sender / Buying for Giftee)
      {
        id: 'mailbox-outgoing',
        lane: 'mission',
        title: 'Message Your Giftee',
        subtitle: gifteeMatch
          ? `Ask ${gifteeMatch.recipientName} anonymous clues`
          : 'Send anonymous hints & questions as Santa',
        emoji: '📮',
        icon: Mail,
        enabled: event.mailboxEnabled,
        lockedReason: !senderUnlocked ? 'Unlocks after Giftee Reveal' : undefined,
        elfSpotId: 'mailbox',
      },
      {
        id: 'delivery-outgoing',
        lane: 'mission',
        title: "Santa's Sleigh Tracker",
        subtitle: outgoingDelivery
          ? `Status: ${getDeliveryStageInfo(outgoingDelivery.stage).emoji} ${getDeliveryStageInfo(outgoingDelivery.stage).label}`
          : 'Update gift status & private courier vault',
        emoji: '🛷',
        icon: Truck,
        enabled: event.deliveryTrackingEnabled,
        lockedReason: !senderUnlocked ? 'Unlocks after Giftee Reveal' : undefined,
        elfSpotId: 'giftbox',
      },
      {
        id: 'thank-you-received',
        lane: 'mission',
        title: 'Thank-You From Giftee',
        subtitle: 'View the animated thank-you card sent to you',
        emoji: '💌',
        icon: Heart,
        enabled: event.thankYouEnabled,
        lockedReason: !senderUnlocked ? 'Unlocks after Giftee Reveal' : undefined,
      },

      // Lane 2: Incoming Magic (Recipient / From Your Secret Santa)
      {
        id: 'snow-globe',
        lane: 'incoming',
        title: 'Magical Snow Globe',
        subtitle: `Shake, decorate (${unlockedCollectibles.length} ornaments) & countdown`,
        emoji: '🔮',
        icon: Sparkles,
        enabled: event.snowGlobeRevealEnabled,
      },
      {
        id: 'mailbox-incoming',
        lane: 'incoming',
        title: 'Letters From Your Santa',
        subtitle: 'Reply to anonymous notes from your mystery Santa',
        emoji: '✉️',
        icon: Mail,
        enabled: event.mailboxEnabled,
        lockedReason: !incomingUnlocked ? 'Available once matching completes' : undefined,
        elfSpotId: 'mailbox',
      },
      {
        id: 'delivery-incoming',
        lane: 'incoming',
        title: 'Track & Confirm My Gift',
        subtitle:
          incomingAck?.status === 'received'
            ? 'Gift receipt confirmed! Send a thank-you card'
            : incomingDelivery
              ? `Status: ${getDeliveryStageInfo(incomingDelivery.stage).emoji} ${getDeliveryStageInfo(incomingDelivery.stage).label}`
              : 'Watch Santa’s sleigh & confirm receipt independently',
        emoji: '🎁',
        icon: Truck,
        enabled: event.deliveryTrackingEnabled,
        lockedReason: !incomingUnlocked ? 'Available once matching completes' : undefined,
        elfSpotId: 'giftbox',
      },
      {
        id: 'thank-you',
        lane: 'incoming',
        title: 'Send Animated Thank-You',
        subtitle: 'Unlocks after you confirm your gift arrived',
        emoji: '✨',
        icon: Heart,
        enabled: event.thankYouEnabled,
        lockedReason: !incomingUnlocked ? 'Available once matching completes' : undefined,
      },
      {
        id: 'guess-santa',
        lane: 'incoming',
        title: 'Guess Your Santa',
        subtitle: `Detective Rudolph board · up to ${event.maxGuesses} guesses`,
        emoji: '🕵️',
        icon: HelpCircle,
        enabled: event.guessingEnabled,
      },
      {
        id: 'dislikes',
        lane: 'incoming',
        title: 'Things Santa Should Avoid',
        subtitle: 'Dislikes, already-owned & opt-in allergy notes',
        emoji: '🚫',
        icon: ShieldAlert,
        enabled: true,
      },

      // Lane 3: Daily Workshop Toys & Games
      {
        id: 'advent',
        lane: 'toys',
        title: 'Daily Advent Surprises',
        subtitle: `${adventUnlocks.length}/25 cottage doors opened`,
        emoji: '🎄',
        icon: CalendarDays,
        enabled: event.adventEnabled,
        elfSpotId: 'calendar',
      },
      {
        id: 'wheel',
        lane: 'toys',
        title: "Spin Santa's Wheel",
        subtitle: 'Daily free spin for festive titles & ornaments',
        emoji: '🎡',
        icon: Disc3,
        enabled: event.wheelEnabled,
        elfSpotId: 'tree',
      },
      {
        id: 'naughty-nice',
        lane: 'toys',
        title: 'Naughty or Nice Meter',
        subtitle: '5-question festive scan & shareable verdict',
        emoji: '🎅',
        icon: Wand2,
        enabled: event.quizEnabled,
      },
      {
        id: 'hidden-elf',
        lane: 'toys',
        title: 'Find the Hidden Elf',
        subtitle: elfDiscovery ? 'Found today’s elf! View reward' : 'Daily workshop treasure hunt',
        emoji: '🧝',
        icon: Compass,
        enabled: event.elfChallengeEnabled,
      },
      {
        id: 'gingerbread',
        lane: 'toys',
        title: 'Gingerbread Studio',
        subtitle: savedCookie
          ? `${savedCookie.decorations.length} toppings baked`
          : 'Decorate & bake your profile cookie',
        emoji: '🍪',
        icon: Cookie,
        enabled: true,
      },
    ],
    [
      adventUnlocks.length,
      elfDiscovery,
      event.adventEnabled,
      event.deliveryTrackingEnabled,
      event.elfChallengeEnabled,
      event.guessingEnabled,
      event.mailboxEnabled,
      event.maxGuesses,
      event.quizEnabled,
      event.snowGlobeRevealEnabled,
      event.thankYouEnabled,
      event.wheelEnabled,
      gifteeMatch,
      incomingAck?.status,
      incomingDelivery,
      incomingUnlocked,
      outgoingDelivery,
      savedCookie,
      senderUnlocked,
      unlockedCollectibles.length,
    ]
  );

  const laneTiles = tiles.filter((t) => t.lane === activeLane && t.enabled);

  const openFeature = (tile: WorkshopTile) => {
    if (tile.lockedReason) return;
    playPopSound();
    setActiveFeature(tile.id);
  };

  const renderActiveFeature = () => {
    switch (activeFeature) {
      case 'mailbox-outgoing':
        return (
          <AnonymousMailboxView
            theme={theme}
            event={event}
            role="santa"
            assignmentId={outgoingAssignmentId}
            recipientDisplayName={gifteeMatch?.recipientName || 'Meera (Preview Giftee)'}
            serverNow={clock.serverNow}
            liveMode={liveMatchedMode}
          />
        );
      case 'mailbox-incoming':
        return (
          <AnonymousMailboxView
            theme={theme}
            event={event}
            role="recipient"
            assignmentId={incomingAssignmentId}
            serverNow={clock.serverNow}
            liveMode={liveMatchedMode}
          />
        );
      case 'delivery-outgoing':
        return (
          <DeliveryTrackerView
            theme={theme}
            event={event}
            mode="sender"
            assignmentId={outgoingAssignmentId}
            participantKey={participant.id}
            recipientDisplayName={gifteeMatch?.recipientName || 'Meera (Preview Giftee)'}
            liveMode={liveMatchedMode}
          />
        );
      case 'delivery-incoming':
        return (
          <DeliveryTrackerView
            theme={theme}
            event={event}
            mode="recipient"
            assignmentId={incomingAssignmentId}
            participantKey={participant.id}
            liveMode={liveMatchedMode}
            onOpenThankYouCard={() => setActiveFeature('thank-you')}
          />
        );
      case 'thank-you':
        return (
          <ThankYouCardView
            theme={theme}
            event={event}
            mode="recipient-send"
            assignmentId={incomingAssignmentId}
            liveMode={liveMatchedMode}
            onGoToAcknowledge={() => setActiveFeature('delivery-incoming')}
          />
        );
      case 'thank-you-received':
        return (
          <ThankYouCardView
            theme={theme}
            event={event}
            mode="santa-receive"
            assignmentId={outgoingAssignmentId}
            liveMode={liveMatchedMode}
          />
        );
      case 'guess-santa':
        return (
          <GuessYourSantaView
            theme={theme}
            event={event}
            participant={participant}
            participantKey={participant.id}
            selfPublicId={selfPublicId}
            roster={effectiveRoster}
            santaReveal={santaIdentityReady ? santaReveal : null}
            serverNow={clock.serverNow}
            liveMode={liveMatchedMode}
            onOpenGoldenEnvelope={onOpenGoldenSecretEnvelope}
          />
        );
      case 'dislikes':
        return (
          <GiftDislikesView
            theme={theme}
            event={event}
            participantKey={participant.id}
            incomingAssignmentId={liveMatchedMode ? incomingAssignment?.incomingAssignmentId || null : null}
            serverNow={clock.serverNow}
            liveMode={isLiveFirestoreEvent}
          />
        );
      case 'advent':
        return (
          <AdventCalendarView
            theme={theme}
            event={event}
            participantKey={participant.id}
            serverNow={clock.serverNow}
            liveMode={isLiveFirestoreEvent}
            onUnlockChanged={setAdventUnlocks}
          />
        );
      case 'wheel':
        return (
          <SantasWheelView
            theme={theme}
            event={event}
            participantKey={participant.id}
            serverNow={clock.serverNow}
            dateKey={clock.dateKey}
            liveMode={isLiveFirestoreEvent}
            onSpinComplete={setWheelSpins}
          />
        );
      case 'naughty-nice':
        return (
          <NaughtyOrNiceView
            theme={theme}
            event={event}
            participant={participant}
            liveMode={isLiveFirestoreEvent}
          />
        );
      case 'hidden-elf':
        return (
          <HiddenElfHuntView
            theme={theme}
            challenge={clock.elfChallenge}
            discovery={elfDiscovery}
            loading={!elfHydrated}
            onCatchElf={() => handleCatchElf({ openModal: false })}
            onGoToWorkshopSpot={handleJumpToWorkshopSpot}
            onOpenSnowGlobe={
              event.snowGlobeRevealEnabled ? () => setActiveFeature('snow-globe') : undefined
            }
          />
        );
      case 'gingerbread':
        return (
          <GingerbreadStudioView
            theme={theme}
            event={event}
            participantKey={participant.id}
            liveMode={isLiveFirestoreEvent}
            onSaved={setSavedCookie}
          />
        );
      case 'snow-globe':
        return (
          <InteractiveSnowGlobe
            theme={theme}
            event={event}
            participantKey={participant.id}
            countdownLabel={countdownSummaryLabel}
            revealReady={gifteeRevealReady || santaIdentityReady}
            unlockedCollectibles={unlockedCollectibles}
            liveMode={isLiveFirestoreEvent}
            onTriggerGrandReveal={onTriggerGrandReveal}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section
      aria-label="Santa's Workshop"
      className={`relative w-full rounded-[28px] overflow-hidden ${cfg.cardClass}`}
    >
      {/* Illustrated Workshop Banner */}
      <div className="relative h-44 sm:h-52 w-full overflow-hidden">
        <img
          src={workshopHeroImg}
          alt="Santa's Workshop featuring the magical mailbox, delivery sleigh, Advent calendar, and snow globe"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/20" />

        {/* Peeking Elf on snowsign banner spot */}
        {event.elfChallengeEnabled && elfHydrated && (
          <PeekingElfWidget
            spotId="snowsign"
            activeSpotId={clock.elfChallenge.spotId}
            alreadyFound={Boolean(elfDiscovery)}
            position="banner"
            onFoundElf={() => void handleCatchElf({ openModal: true })}
          />
        )}

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 flex flex-wrap items-end justify-between gap-3 text-white">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
              Santa&apos;s Workshop · {liveMatchedMode ? 'Live Exchange' : 'Interactive Mode'}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight drop-shadow">
              Mailbox, Sleigh, Advent &amp; Games
            </h2>
            <p className="text-xs text-white/85">
              Budget Guide: <span className="font-bold text-amber-200">{budgetText}</span>
              {event.budget.announcement ? ` · ${event.budget.announcement}` : ''}
            </p>
          </div>

          {savedCookie?.isPublicProfileDecor && (
            <button
              type="button"
              onClick={() => {
                playPopSound();
                setActiveFeature('gingerbread');
              }}
              title="Edit your baked gingerbread cookie"
              className="flex items-center gap-2 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 px-2.5 py-1.5 cursor-pointer transition-colors"
            >
              <GingerbreadCookiePreview design={savedCookie} size={42} />
              <span className="text-[11px] font-bold text-amber-100 pr-1">My Cookie</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workshop Content Area */}
      <div className="p-5 sm:p-7 space-y-5">
        <AnimatePresence mode="wait">
          {activeFeature === 'overview' ? (
            <motion.div
              key="workshop-overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              {/* Role-Separated Lane Switcher */}
              <div
                role="tablist"
                aria-label="Workshop sections"
                className="grid grid-cols-3 gap-2 rounded-2xl bg-black/5 p-1.5"
              >
                {[
                  {
                    id: 'incoming' as const,
                    label: 'Incoming Magic',
                    shortDesc: 'For You',
                    emoji: '🔮',
                  },
                  {
                    id: 'mission' as const,
                    label: 'Secret Mission',
                    shortDesc: 'As Santa',
                    emoji: '🎅',
                  },
                  {
                    id: 'toys' as const,
                    label: 'Daily Games',
                    shortDesc: 'Fun & Prizes',
                    emoji: '🎄',
                  },
                ].map((lane) => {
                  const selected = activeLane === lane.id;
                  return (
                    <button
                      key={lane.id}
                      role="tab"
                      aria-selected={selected}
                      type="button"
                      onClick={() => {
                        playPopSound();
                        setActiveLane(lane.id);
                      }}
                      className={`min-h-[48px] rounded-xl px-2.5 py-2 text-center transition-all cursor-pointer ${
                        selected
                          ? 'bg-white shadow-sm text-slate-900'
                          : 'text-slate-700 hover:bg-white/50'
                      }`}
                    >
                      <span className="block text-sm sm:text-base font-display font-bold leading-tight">
                        {lane.emoji} {lane.label}
                      </span>
                      <span className="block text-[10px] font-semibold opacity-65">
                        {lane.shortDesc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Role Separation Reassurance Note */}
              <p className={`text-xs text-center ${cfg.mutedText}`}>
                {activeLane === 'mission'
                  ? 'Your outgoing Santa mission stays strictly separate from the anonymous surprises your own Secret Santa sends you.'
                  : activeLane === 'incoming'
                    ? 'Enjoy anonymous letters, delivery updates, detective guesses, and your snow globe while your Santa stays a total mystery.'
                    : 'Open Advent doors, spin the daily wheel, hunt for the peeking elf, and bake a gingerbread cookie!'}
              </p>

              {/* Feature Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {laneTiles.map((tile) => {
                  const Icon = tile.icon;
                  const isLocked = Boolean(tile.lockedReason);
                  return (
                    <div key={tile.id} className="relative">
                      {event.elfChallengeEnabled && elfHydrated && tile.elfSpotId && (
                        <PeekingElfWidget
                          spotId={tile.elfSpotId}
                          activeSpotId={clock.elfChallenge.spotId}
                          alreadyFound={Boolean(elfDiscovery)}
                          position="tile"
                          onFoundElf={() => void handleCatchElf({ openModal: true })}
                        />
                      )}

                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => openFeature(tile)}
                        className={`w-full text-left rounded-2xl border p-4 flex items-start gap-3.5 transition-all ${
                          isLocked
                            ? 'bg-black/5 border-black/10 opacity-65 cursor-not-allowed'
                            : 'bg-white/85 hover:bg-white border-black/10 hover:border-amber-400 hover:shadow-md cursor-pointer'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-100 to-amber-100 border border-amber-200/80 flex items-center justify-center text-2xl shrink-0">
                          {tile.emoji}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-display font-bold text-base text-slate-900 truncate">
                              {tile.title}
                            </p>
                            {isLocked ? (
                              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <Icon className="w-4 h-4 text-rose-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-600 leading-snug">
                            {isLocked ? tile.lockedReason : tile.subtitle}
                          </p>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`feature-${activeFeature}-${resetRefreshTick}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-black/10">
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setActiveFeature('overview');
                  }}
                  className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer ${cfg.secondaryBtnClass}`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Workshop
                </button>

                {event.elfChallengeEnabled && !elfDiscovery && (
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setActiveFeature('hidden-elf');
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    🧝 Elf Radar
                  </button>
                )}
              </div>

              {renderActiveFeature()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Peeking Elf on footer spot */}
      {event.elfChallengeEnabled && elfHydrated && (
        <PeekingElfWidget
          spotId="footer"
          activeSpotId={clock.elfChallenge.spotId}
          alreadyFound={Boolean(elfDiscovery)}
          position="footer"
          onFoundElf={() => void handleCatchElf({ openModal: true })}
        />
      )}

      {/* Reward Modal when Peeking Elf is caught */}
      <ElfRewardModal
        open={showElfModal}
        rewardTitle={clock.elfChallenge.reward.title}
        rewardEmoji={clock.elfChallenge.reward.emoji}
        joke={clock.elfChallenge.reward.joke}
        onClose={() => setShowElfModal(false)}
        onOpenSnowGlobe={
          event.snowGlobeRevealEnabled ? () => setActiveFeature('snow-globe') : undefined
        }
      />
    </section>
  );
};
