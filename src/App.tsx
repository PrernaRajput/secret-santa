import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Home, Shield, Sparkles, Volume2, VolumeX } from 'lucide-react';
import {
  AppStep,
  GenderCategory,
  ParticipantAddress,
  ParticipantProfile,
  SecretSantaEvent,
  ThemeId,
} from './types/secretSanta';
import { DEFAULT_EVENT_ID } from './services/firebase';
import {
  buildDefaultEventTemplate,
  fetchEvent,
  fetchParticipantProfile,
  saveParticipantProfile,
  subscribeToEvent,
  validateAndClaimInvitation,
} from './services/secretSantaService';
import { generateSecureTokenHex, sha256Hex } from './utils/crypto';
import { playPopSound, setSoundMuted } from './utils/sound';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { DesiSantaLoader } from './components/loading/DesiSantaLoader';
import { ThemeBackdrop } from './components/themes/ThemeBackdrop';
import { ThemeCarousel } from './components/themes/ThemeCarousel';
import { InvitationScreen } from './features/invitation/InvitationScreen';
import { StartScreen } from './features/start/StartScreen';
import { JoinQuestionScreen } from './features/participation/JoinQuestionScreen';
import { AvatarScreen } from './features/avatars/AvatarScreen';
import { DetailsScreen } from './features/onboarding/DetailsScreen';
import { CountdownAndRevealHub } from './features/countdown/CountdownAndRevealHub';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { GoldenWorldOverlay } from './components/secret/GoldenWorldOverlay';
import {
  openGoldenSecretEnvelope,
  readSandboxGoldenCrown,
} from './services/workshopService';
import { WORKSHOP_DATA_RESET_EVENT } from './services/adminTestingResetService';

const THEME_PREF_KEY = 'ss_theme_pref_v1';
const SESSION_KEY_STORE = 'ss_participant_session_key_v1';
const SESSION_DRAFT_STORE = 'ss_participant_draft_v1';

const EMPTY_ADDRESS: ParticipantAddress = {
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  postalCode: '',
  phone: '',
};

function readInitialTheme(): ThemeId {
  try {
    const saved = window.localStorage.getItem(THEME_PREF_KEY);
    if (saved === 'santa' || saved === 'chocolate' || saved === 'funny') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'santa';
}

export default function App() {
  const [showLoader, setShowLoader] = useState(true);
  const [theme, setTheme] = useState<ThemeId>(readInitialTheme);
  const [muted, setMuted] = useState(false);
  const [muteToggleTick, setMuteToggleTick] = useState(0);
  const [step, setStep] = useState<AppStep>('invitation');
  const [hubTab, setHubTab] = useState<'home' | 'workshop'>('home');
  const [showAdmin, setShowAdmin] = useState(false);

  // Live Firestore event state (falls back cleanly to default template before admin initializes)
  const [event, setEvent] = useState<SecretSantaEvent>(buildDefaultEventTemplate);
  const [isLiveFirestoreEvent, setIsLiveFirestoreEvent] = useState(false);

  // Personal invitation / capability session state (never stored in localStorage!)
  const [participantKey, setParticipantKey] = useState<string>('');
  const [invitationHash, setInvitationHash] = useState<string>('');
  const [inviteLabel, setInviteLabel] = useState<string | undefined>(undefined);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [hasPersonalToken, setHasPersonalToken] = useState(false);

  // Participant profile state
  const [selectedAvatarId, setSelectedAvatarId] = useState('santa-hat-girl');
  const [genderFilter, setGenderFilter] = useState<GenderCategory>('all');
  const [participant, setParticipant] = useState<ParticipantProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [justJoinedCelebration, setJustJoinedCelebration] = useState(false);
  const [goldenWorldActive, setGoldenWorldActive] = useState(false);

  const handleSelectTheme = useCallback(
    (nextTheme: ThemeId) => {
      setTheme(nextTheme);
      try {
        window.localStorage.setItem(THEME_PREF_KEY, nextTheme);
      } catch {
        // ignore
      }
      if (participant && participantKey && isLiveFirestoreEvent) {
        void saveParticipantProfile(participantKey, {
          eventId: event.id,
          invitationHash,
          name: participant.name,
          address: participant.address,
          hobbies: participant.hobbies,
          avatarId: participant.avatarId,
          genderPreference: participant.genderPreference,
          selectedTheme: nextTheme,
          hasJoined: participant.hasJoined,
        }).catch(() => {
          // non-blocking theme preference sync
        });
      }
    },
    [event.id, invitationHash, isLiveFirestoreEvent, participant, participantKey]
  );

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    setMuteToggleTick((t) => t + 1);
    if (!next) {
      playPopSound();
    }
  };

  // Subscribe to Firestore event schedule
  useEffect(() => {
    const unsub = subscribeToEvent(DEFAULT_EVENT_ID, (liveEvent) => {
      if (liveEvent) {
        setEvent(liveEvent);
        setIsLiveFirestoreEvent(true);
      } else {
        setIsLiveFirestoreEvent(false);
      }
    });
    return () => unsub();
  }, []);

  const refreshEvent = useCallback(async () => {
    const live = await fetchEvent(DEFAULT_EVENT_ID);
    if (live) {
      setEvent(live);
      setIsLiveFirestoreEvent(true);
    }
  }, []);

  // Re-sync Golden Detective Crown cosmetic state if Admin resets guesses during pre-publish testing
  useEffect(() => {
    const onWorkshopReset = (evt: Event) => {
      const detail = (evt as CustomEvent<{ targets?: string[] }>).detail;
      if (!detail?.targets?.includes('guesses')) return;
      setParticipant((prev) => {
        if (!prev) return prev;
        const next = { ...prev, hasGoldenDetectiveCrown: false };
        try {
          window.sessionStorage.setItem(SESSION_DRAFT_STORE, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    };
    window.addEventListener(WORKSHOP_DATA_RESET_EVENT, onWorkshopReset);
    return () => window.removeEventListener(WORKSHOP_DATA_RESET_EVENT, onWorkshopReset);
  }, []);

  // Hydrate event-scoped sandbox crown for preview/sandbox sessions
  useEffect(() => {
    if (!participant || participant.hasGoldenDetectiveCrown) return;
    if (readSandboxGoldenCrown(event.id, participant.id)) {
      setParticipant((prev) => (prev ? { ...prev, hasGoldenDetectiveCrown: true } : prev));
    }
  }, [event.id, participant]);

  const handleOpenGoldenSecretEnvelope = useCallback(async () => {
    if (!participant) return;
    setGoldenWorldActive(true);
    setParticipant((prev) => {
      if (!prev) return prev;
      const next: ParticipantProfile = { ...prev, hasGoldenDetectiveCrown: true };
      try {
        window.sessionStorage.setItem(SESSION_DRAFT_STORE, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    try {
      await openGoldenSecretEnvelope({
        participantKey: participant.id,
        eventId: event.id,
        liveMode: isLiveFirestoreEvent && event.isMatched,
      });
    } catch {
      // Non-blocking: local crown state and golden world reveal remain active
    }
  }, [event.id, event.isMatched, isLiveFirestoreEvent, participant]);

  // Process URL ?token=<256-bit-token> OR restore active browser-tab session
  useEffect(() => {
    let mounted = true;

    async function bootstrapSession() {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');

      if (urlToken) {
        setHasPersonalToken(true);
        // Strip raw token immediately from browser address bar
        window.history.replaceState({}, document.title, window.location.pathname);

        const claim = await validateAndClaimInvitation(urlToken);
        if (!mounted) return;
        if (claim.ok && claim.participantKey && claim.tokenHash) {
          setParticipantKey(claim.participantKey);
          setInvitationHash(claim.tokenHash);
          setInviteLabel(claim.label);
          setInviteError(null);
          try {
            window.sessionStorage.setItem(SESSION_KEY_STORE, claim.participantKey);
          } catch {
            // ignore
          }
          // If this is a 24-hour recovery link, restore the existing participant profile straight to the Hub!
          if (claim.isRecovery) {
            try {
              const restored = await fetchParticipantProfile(claim.participantKey);
              if (!mounted) return;
              if (restored) {
                setParticipant(restored);
                setSelectedAvatarId(restored.avatarId);
                setGenderFilter(restored.genderPreference);
                setTheme(restored.selectedTheme);
                if (restored.hasJoined) {
                  setStep('hub');
                }
              }
            } catch {
              // Fall through to invitation screen if profile lookup fails
            }
          }
          return;
        } else {
          setInviteError(claim.reason || 'Could not validate your invitation link.');
        }
      }

      // Attempt to resume existing session within this browser tab
      try {
        const existingKey = window.sessionStorage.getItem(SESSION_KEY_STORE);
        if (existingKey && /^[a-f0-9]{64}$/.test(existingKey)) {
          setParticipantKey(existingKey);
          const remoteProfile = await fetchParticipantProfile(existingKey);
          if (!mounted) return;
          if (remoteProfile) {
            setParticipant(remoteProfile);
            setSelectedAvatarId(remoteProfile.avatarId);
            setGenderFilter(remoteProfile.genderPreference);
            setTheme(remoteProfile.selectedTheme);
            setInvitationHash(remoteProfile.invitationHash);
            if (remoteProfile.hasJoined) {
              setStep('hub');
            }
            return;
          }

          // Fallback to tab-scoped draft if event hasn't been initialized in Firestore yet
          const draftRaw = window.sessionStorage.getItem(SESSION_DRAFT_STORE);
          if (draftRaw) {
            const parsedDraft = JSON.parse(draftRaw) as ParticipantProfile;
            if (parsedDraft && parsedDraft.hasJoined) {
              setParticipant(parsedDraft);
              setSelectedAvatarId(parsedDraft.avatarId);
              setStep('hub');
              return;
            }
          }
        }
      } catch {
        // ignore storage errors
      }

      // Generate a fresh 256-bit capability key for open exploration
      const freshKey = await sha256Hex(generateSecureTokenHex(32));
      if (!mounted) return;
      setParticipantKey(freshKey);
      try {
        window.sessionStorage.setItem(SESSION_KEY_STORE, freshKey);
      } catch {
        // ignore
      }
    }

    void bootstrapSession();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRedeemManualToken = async (rawToken: string) => {
    setInviteError(null);
    const claim = await validateAndClaimInvitation(rawToken);
    if (claim.ok && claim.participantKey && claim.tokenHash) {
      setHasPersonalToken(true);
      setParticipantKey(claim.participantKey);
      setInvitationHash(claim.tokenHash);
      setInviteLabel(claim.label);
      try {
        window.sessionStorage.setItem(SESSION_KEY_STORE, claim.participantKey);
      } catch {
        // ignore
      }
      if (claim.isRecovery) {
        try {
          const restored = await fetchParticipantProfile(claim.participantKey);
          if (restored) {
            setParticipant(restored);
            setSelectedAvatarId(restored.avatarId);
            setGenderFilter(restored.genderPreference);
            setTheme(restored.selectedTheme);
            if (restored.hasJoined) {
              setStep('hub');
            }
          }
        } catch {
          // ignore
        }
      }
    } else {
      setInviteError(claim.reason || 'Invalid or expired invitation token.');
    }
  };

  const handleSaveDetails = async (formData: {
    name: string;
    address: ParticipantAddress;
    hobbies: string[];
  }) => {
    setSavingProfile(true);
    try {
      const key = participantKey || (await sha256Hex(generateSecureTokenHex(32)));
      if (!participantKey) {
        setParticipantKey(key);
        try {
          window.sessionStorage.setItem(SESSION_KEY_STORE, key);
        } catch {
          // ignore
        }
      }

      const nextProfile: ParticipantProfile = {
        id: key,
        eventId: event.id,
        invitationHash,
        name: formData.name,
        address: formData.address,
        hobbies: formData.hobbies,
        avatarId: selectedAvatarId,
        genderPreference: genderFilter,
        selectedTheme: theme,
        hasJoined: true,
      };

      if (isLiveFirestoreEvent && event.registrationOpen && !event.isMatched) {
        await saveParticipantProfile(key, {
          eventId: event.id,
          invitationHash,
          name: nextProfile.name,
          address: nextProfile.address,
          hobbies: nextProfile.hobbies,
          avatarId: nextProfile.avatarId,
          genderPreference: nextProfile.genderPreference,
          selectedTheme: nextProfile.selectedTheme,
          hasJoined: true,
        });
      }

      try {
        window.sessionStorage.setItem(SESSION_DRAFT_STORE, JSON.stringify(nextProfile));
      } catch {
        // ignore
      }

      setParticipant(nextProfile);
      setJustJoinedCelebration(true);
      setStep('hub');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <ErrorBoundary>
      {/* Cinematic 3D Desi Santa on Indian Water Buffalo Loading Screen */}
      <AnimatePresence>
        {showLoader && (
          <DesiSantaLoader onComplete={() => setShowLoader(false)} />
        )}
      </AnimatePresence>

      {/* Step 0: Dedicated Dark Invitation Envelope Screen */}
      {step === 'invitation' ? (
        <InvitationScreen
          eventId={event.id}
          eventName={event.name}
          isLiveFirestoreEvent={isLiveFirestoreEvent}
          inviteLabel={inviteLabel}
          inviteError={inviteError}
          hasPersonalToken={hasPersonalToken}
          onUnwrapComplete={() => setStep('start')}
          onRedeemManualToken={handleRedeemManualToken}
          onOpenAdmin={() => setShowAdmin(true)}
        />
      ) : (
        /* Full 3-Theme Animated Secret Santa World (briefly gilded during The 1% Santa Secret) */
        <div
          className={`relative min-h-screen w-full flex flex-col transition-[filter] duration-700 ${
            goldenWorldActive ? 'sepia-[0.55] saturate-150 brightness-105' : ''
          }`}
        >
          <ThemeBackdrop theme={theme} />

          {/* Clean Top Bar (3-zone layout) */}
          <header
            className={`relative z-20 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-4 transition-colors duration-500 ${
              goldenWorldActive ? 'text-amber-100' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (participant?.hasJoined) {
                  setStep('hub');
                  setHubTab('home');
                } else {
                  setStep('start');
                }
              }}
              className="font-display text-lg sm:text-xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Secret Santa 🎅
            </button>

            {/* Primary Navigation: Home / Workshop tabs once joined; Onboarding Breadcrumb before joining */}
            {step === 'hub' && participant ? (
              <nav
                aria-label="Primary Views"
                className="hidden sm:flex items-center p-1 rounded-full bg-black/35 backdrop-blur-md border border-white/20 shadow-md"
              >
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setHubTab('home');
                  }}
                  aria-current={hubTab === 'home' ? 'page' : undefined}
                  className={`min-h-[36px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    hubTab === 'home'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-white/85 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setHubTab('workshop');
                  }}
                  aria-current={hubTab === 'workshop' ? 'page' : undefined}
                  className={`min-h-[36px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    hubTab === 'workshop'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-white/85 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Workshop
                </button>
              </nav>
            ) : (
              <nav
                aria-label="Progress"
                className="hidden sm:flex items-center gap-4 text-xs font-semibold text-white/85"
              >
                {[
                  { id: 'start', label: 'Start' },
                  { id: 'join', label: 'Join' },
                  { id: 'avatar', label: 'Avatar' },
                  { id: 'details', label: 'Details' },
                  { id: 'hub', label: 'Reveal' },
                ].map((item) => {
                  const active = step === item.id;
                  return (
                    <span
                      key={item.id}
                      className={`whitespace-nowrap transition-opacity ${
                        active
                          ? 'text-amber-200 underline underline-offset-4 decoration-2'
                          : 'opacity-70'
                      }`}
                    >
                      {item.label}
                    </span>
                  );
                })}
              </nav>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex items-center justify-center">
                <AnimatePresence>
                  {muteToggleTick > 0 && (
                    <motion.span
                      key={`mute-ripple-${muteToggleTick}`}
                      aria-hidden="true"
                      initial={{ scale: 0.75, opacity: 0.75 }}
                      animate={{ scale: 2.1, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      className={`pointer-events-none absolute inset-0 rounded-full border-2 ${
                        muted
                          ? 'border-rose-300/90 bg-rose-400/20'
                          : 'border-amber-200/90 bg-amber-300/20'
                      }`}
                    />
                  )}
                </AnimatePresence>

                <motion.button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? 'Unmute festive sounds' : 'Mute festive sounds'}
                  aria-pressed={muted}
                  whileTap={{ scale: 0.9 }}
                  animate={
                    muteToggleTick > 0
                      ? {
                          rotate: [0, -14, 14, -9, 6, 0],
                          scale: [1, 0.92, 1.08, 1],
                        }
                      : undefined
                  }
                  transition={{ duration: 0.42, ease: 'easeOut' }}
                  key={`mute-btn-${muteToggleTick}`}
                  className={`relative z-10 w-10 h-10 rounded-full backdrop-blur-md border text-white flex items-center justify-center transition-colors cursor-pointer ${
                    muted
                      ? 'bg-rose-950/60 hover:bg-rose-900/70 border-rose-300/45 text-rose-100'
                      : 'bg-black/35 hover:bg-black/50 border-white/25 text-white'
                  }`}
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </motion.button>
              </div>

              <button
                type="button"
                onClick={() => setShowAdmin(true)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-black/35 hover:bg-black/50 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Shield className="w-3.5 h-3.5 text-amber-300" />
                Admin
              </button>
            </div>
          </header>

          {/* Mobile Primary Tab Switcher (Home / Workshop) */}
          {step === 'hub' && participant && (
            <div className="relative z-20 sm:hidden w-full max-w-md mx-auto px-4 pt-1 pb-2">
              <div
                role="tablist"
                aria-label="Primary Views"
                className="grid grid-cols-2 p-1 rounded-full bg-black/35 backdrop-blur-md border border-white/20 shadow-md"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={hubTab === 'home'}
                  onClick={() => {
                    playPopSound();
                    setHubTab('home');
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    hubTab === 'home'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  Home
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={hubTab === 'workshop'}
                  onClick={() => {
                    playPopSound();
                    setHubTab('workshop');
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    hubTab === 'workshop'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Workshop
                </button>
              </div>
            </div>
          )}

          {/* Main Interactive Screen Canvas (generous bottom padding so floating carousel never overlaps inputs) */}
          <main
            className={`relative z-10 flex-1 w-full px-4 sm:px-6 pt-2 pb-36 flex flex-col ${
              step === 'hub' ? 'justify-start' : 'justify-center'
            }`}
          >
            <AnimatePresence mode="wait">
              {step === 'start' && (
                <StartScreen
                  key="start"
                  theme={theme}
                  eventName={event.name}
                  onStart={() => setStep('join')}
                />
              )}

              {step === 'join' && (
                <JoinQuestionScreen
                  key="join"
                  theme={theme}
                  onJoinYes={() => setStep('avatar')}
                  onLeave={() => setStep('invitation')}
                />
              )}

              {step === 'avatar' && (
                <AvatarScreen
                  key="avatar"
                  theme={theme}
                  selectedAvatarId={selectedAvatarId}
                  genderFilter={genderFilter}
                  hasGoldenCrown={Boolean(participant?.hasGoldenDetectiveCrown)}
                  onSelectAvatar={setSelectedAvatarId}
                  onChangeGenderFilter={setGenderFilter}
                  onContinue={() => setStep('details')}
                />
              )}

              {step === 'details' && (
                <DetailsScreen
                  key="details"
                  theme={theme}
                  initialName={participant?.name || inviteLabel || ''}
                  initialAddress={participant?.address || EMPTY_ADDRESS}
                  initialHobbies={participant?.hobbies || []}
                  saving={savingProfile}
                  onSubmit={handleSaveDetails}
                />
              )}

              {step === 'hub' && participant && (
                <CountdownAndRevealHub
                  key="hub"
                  theme={theme}
                  event={event}
                  participant={participant}
                  isLiveFirestoreEvent={isLiveFirestoreEvent}
                  activeTab={hubTab}
                  onChangeTab={setHubTab}
                  celebrateOnMount={justJoinedCelebration}
                  onCelebrationComplete={() => setJustJoinedCelebration(false)}
                  onEditDetails={() => setStep('details')}
                  onOpenGoldenSecretEnvelope={handleOpenGoldenSecretEnvelope}
                />
              )}
            </AnimatePresence>
          </main>

          {/* Persistent Semicircular 3-Theme Carousel & Required Footer */}
          <ThemeCarousel theme={theme} onSelectTheme={handleSelectTheme} />
        </div>
      )}

      {/* The 1% Santa Secret — Full-Website Hidden Golden Christmas World Transformation */}
      {participant && (
        <GoldenWorldOverlay
          active={goldenWorldActive}
          participantName={participant.name}
          participantAvatarId={participant.avatarId}
          onDismiss={() => setGoldenWorldActive(false)}
        />
      )}

      {/* Secure Admin Dashboard Modal */}
      {showAdmin && (
        <AdminDashboard
          event={event}
          isLiveEvent={isLiveFirestoreEvent}
          onClose={() => setShowAdmin(false)}
          onEventUpdated={refreshEvent}
        />
      )}
    </ErrorBoundary>
  );
}
