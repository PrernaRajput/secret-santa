import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  Shuffle,
  Sliders,
  Trash2,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_EVENT_ID,
  formatFriendlyFirestoreError,
  signInAdminWithGoogle,
  signOutAdmin,
} from '../../services/firebase';
import {
  addCoAdminAccount,
  adminCorrectDeliveryAcknowledgment,
  checkIsAuthorizedAdmin,
  clearAllParticipantsAndMatches,
  dismissRecoveryRequest,
  generatePersonalInvitation,
  issueRecoveryInvitation,
  listAdminAccounts,
  listDeliveryAcknowledgmentsAdmin,
  listInvitations,
  listParticipants,
  listRecoveryAuditLogs,
  listRecoveryRequests,
  removeCoAdminAccount,
  removeParticipant,
  resetMatchesForTesting,
  revokeInvitation,
  runCryptographicMatching,
  saveAdminEventConfig,
  seedFestiveParticipants,
} from '../../services/secretSantaService';
import {
  AdminAccount,
  DeliveryAckStatus,
  DeliveryAcknowledgmentRecord,
  GiftBudgetMode,
  InvitationRecord,
  ParticipantProfile,
  RecoveryAuditLogRecord,
  SecretSantaEvent,
  SessionRecoveryRequestRecord,
} from '../../types/secretSanta';
import { BUDGET_PRESETS } from '../../data/workshopContent';
import { formatBudgetGuide } from '../../utils/workshopLogic';
import { AvatarGraphic } from '../../components/avatars/AvatarGraphic';
import { playChimeSound, playPopSound } from '../../utils/sound';
import { PlatformUser } from '../../types/rbac';
import {
  ensureDefaultEventSyncedToGroup,
  listAllGroupsAdmin,
  listPlatformUsers,
  registerOrPromoteUserByEmail,
  syncSignedInPlatformUser,
} from '../../services/rbacService';
import { ROLE_META } from '../../utils/rbacLogic';
import { AdminGovernancePanels, GovernanceTabId } from './AdminGovernancePanels';
import { OrganiserDashboard } from '../organiser/OrganiserDashboard';
// PRE-PUBLISH TESTING ONLY — remove import & tab before publishing
import { AdminTestingResetPanel } from './AdminTestingResetPanel';

interface AdminDashboardProps {
  event: SecretSantaEvent;
  isLiveEvent: boolean;
  onClose: () => void;
  onEventUpdated: () => Promise<void>;
  onSelectActiveGroup?: (groupId: string) => void;
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  event,
  isLiveEvent,
  onClose,
  onEventUpdated,
  onSelectActiveGroup,
}) => {
  const activeEventId = event.id || DEFAULT_EVENT_ID;
  const [adminUser, setAdminUser] = useState<User | null>(auth.currentUser);
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(Boolean(auth.currentUser));
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | GovernanceTabId
    | 'timers'
    | 'workshop'
    | 'invites'
    | 'participants'
    | 'recovery'
    | 'admins'
    | 'testing'
  >('overview');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
    technical?: string;
  } | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Event Timer Form
  const [eventName, setEventName] = useState(event.name);
  const [timezone, setTimezone] = useState(event.timezone || 'Asia/Kolkata');
  const [registrationOpen, setRegistrationOpen] = useState(event.registrationOpen);
  const [registrationDeadline, setRegistrationDeadline] = useState(
    toDatetimeLocalValue(event.registrationDeadline)
  );
  const [gifteeRevealAt, setGifteeRevealAt] = useState(
    toDatetimeLocalValue(event.gifteeRevealAt)
  );
  const [giftDeadline, setGiftDeadline] = useState(
    toDatetimeLocalValue(event.giftDeadline)
  );
  const [santaIdentityRevealAt, setSantaIdentityRevealAt] = useState(
    toDatetimeLocalValue(event.santaIdentityRevealAt)
  );

  // Phase 2 Budget & Workshop Governance Form
  const [budgetMode, setBudgetMode] = useState<GiftBudgetMode>(event.budget.mode);
  const [budgetCurrency, setBudgetCurrency] = useState(event.budget.currency || '₹');
  const [budgetMin, setBudgetMin] = useState(event.budget.minAmount);
  const [budgetMax, setBudgetMax] = useState(event.budget.maxAmount);
  const [budgetAnnouncement, setBudgetAnnouncement] = useState(event.budget.announcement || '');
  const [mailboxEnabled, setMailboxEnabled] = useState(event.mailboxEnabled);
  const [mailboxOpenAt, setMailboxOpenAt] = useState(toDatetimeLocalValue(event.mailboxOpenAt));
  const [mailboxCloseAt, setMailboxCloseAt] = useState(toDatetimeLocalValue(event.mailboxCloseAt));
  const [guessingEnabled, setGuessingEnabled] = useState(event.guessingEnabled);
  const [maxGuesses, setMaxGuesses] = useState(event.maxGuesses);
  const [allowDuplicateGuesses, setAllowDuplicateGuesses] = useState(event.allowDuplicateGuesses);
  const [adventEnabled, setAdventEnabled] = useState(event.adventEnabled);
  const [adventStartAt, setAdventStartAt] = useState(toDatetimeLocalValue(event.adventStartAt));
  const [adventAllowCatchUp, setAdventAllowCatchUp] = useState(event.adventAllowCatchUp);
  const [wheelEnabled, setWheelEnabled] = useState(event.wheelEnabled);
  const [elfChallengeEnabled, setElfChallengeEnabled] = useState(event.elfChallengeEnabled);
  const [quizEnabled, setQuizEnabled] = useState(event.quizEnabled);
  const [quizAllowRetake, setQuizAllowRetake] = useState(event.quizAllowRetake);
  const [deliveryTrackingEnabled, setDeliveryTrackingEnabled] = useState(event.deliveryTrackingEnabled);
  const [thankYouEnabled, setThankYouEnabled] = useState(event.thankYouEnabled);
  const [snowGlobeRevealEnabled, setSnowGlobeRevealEnabled] = useState(event.snowGlobeRevealEnabled);
  const [giftPreferencesCutoffAt, setGiftPreferencesCutoffAt] = useState(
    toDatetimeLocalValue(event.giftPreferencesCutoffAt)
  );

  // Invites, Participants, Recovery, Delivery & Co-Admins
  const [inviteLabel, setInviteLabel] = useState('');
  const [lastGeneratedLink, setLastGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [participants, setParticipants] = useState<ParticipantProfile[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<SessionRecoveryRequestRecord[]>([]);
  const [deliveryAcks, setDeliveryAcks] = useState<DeliveryAcknowledgmentRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<RecoveryAuditLogRecord[]>([]);
  const [recoveryTargetParticipantId, setRecoveryTargetParticipantId] = useState('');
  const [recoveryReasonNote, setRecoveryReasonNote] = useState('');
  const [lastRecoveryLink, setLastRecoveryLink] = useState<string | null>(null);
  const [copiedRecoveryLink, setCopiedRecoveryLink] = useState(false);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [newCoAdminEmail, setNewCoAdminEmail] = useState('');
  const [newCoAdminName, setNewCoAdminName] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [promoteParticipantTarget, setPromoteParticipantTarget] =
    useState<ParticipantProfile | null>(null);
  const [promoteParticipantEmail, setPromoteParticipantEmail] = useState('');
  const [promoteParticipantGrantActiveGroup, setPromoteParticipantGrantActiveGroup] =
    useState(true);

  const reportError = useCallback((err: unknown, fallback: string) => {
    const formatted = formatFriendlyFirestoreError(err, fallback);
    setShowTechDetails(false);
    setStatusMsg({
      type: 'err',
      text: formatted.message,
      technical: formatted.technical,
    });
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setAdminUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    let active = true;
    if (!adminUser) {
      setPlatformUser(null);
      setIsAuthorizedAdmin(false);
      setCheckingAccess(false);
      return;
    }
    setCheckingAccess(true);
    Promise.all([
      checkIsAuthorizedAdmin(adminUser.uid, adminUser.email, adminUser.emailVerified),
      syncSignedInPlatformUser(adminUser).catch(() => null),
    ])
      .then(([allowed, pUser]) => {
        if (!active) return;
        setPlatformUser(pUser);
        setIsAuthorizedAdmin(allowed || (pUser?.role === 'ADMIN' && pUser?.status === 'ACTIVE'));
      })
      .finally(() => {
        if (active) setCheckingAccess(false);
      });
    return () => {
      active = false;
    };
  }, [adminUser]);

  const loadAdminLists = useCallback(async () => {
    if (!isAuthorizedAdmin) return;
    try {
      const [inv, parts, admins, recReqs, acks, audits] = await Promise.all([
        listInvitations(activeEventId),
        listParticipants(activeEventId),
        listAdminAccounts(),
        listRecoveryRequests(activeEventId).catch(() => []),
        listDeliveryAcknowledgmentsAdmin(activeEventId).catch(() => []),
        listRecoveryAuditLogs(activeEventId).catch(() => []),
      ]);
      setInvitations(inv);
      setParticipants(parts);
      setAdminAccounts(admins);
      setRecoveryRequests(recReqs);
      setDeliveryAcks(acks);
      setAuditLogs(audits);
    } catch (err) {
      reportError(err, 'Unable to load organizer data from Firestore.');
    }
  }, [activeEventId, isAuthorizedAdmin, reportError]);

  useEffect(() => {
    void loadAdminLists();
  }, [loadAdminLists]);

  // Keep event form synced when switching active groups
  useEffect(() => {
    setEventName(event.name);
    setTimezone(event.timezone || 'Asia/Kolkata');
    setRegistrationOpen(event.registrationOpen);
    setRegistrationDeadline(toDatetimeLocalValue(event.registrationDeadline));
    setGifteeRevealAt(toDatetimeLocalValue(event.gifteeRevealAt));
    setGiftDeadline(toDatetimeLocalValue(event.giftDeadline));
    setSantaIdentityRevealAt(toDatetimeLocalValue(event.santaIdentityRevealAt));
    setBudgetMode(event.budget.mode);
    setBudgetCurrency(event.budget.currency || '₹');
    setBudgetMin(event.budget.minAmount);
    setBudgetMax(event.budget.maxAmount);
    setBudgetAnnouncement(event.budget.announcement || '');
  }, [event]);

  const handleGoogleSignIn = async () => {
    setStatusMsg(null);
    setBusy(true);
    try {
      await signInAdminWithGoogle();
    } catch (err) {
      reportError(err, 'Google Sign-In was cancelled or failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTimers = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!adminUser) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const parsedMin = Math.max(0, Number(budgetMin) || 0);
      const parsedMax =
        budgetMode === 'fixed' ? parsedMin : Math.max(parsedMin, Number(budgetMax) || parsedMin);
      await saveAdminEventConfig(adminUser.uid, {
        eventId: activeEventId,
        name: eventName,
        timezone,
        registrationOpen,
        registrationDeadline: new Date(registrationDeadline),
        gifteeRevealAt: new Date(gifteeRevealAt),
        giftDeadline: new Date(giftDeadline),
        santaIdentityRevealAt: new Date(santaIdentityRevealAt),
        budget: {
          mode: budgetMode,
          currency: budgetCurrency.trim().slice(0, 6) || '₹',
          minAmount: parsedMin,
          maxAmount: parsedMax,
          announcement: budgetAnnouncement.trim().slice(0, 220),
        },
        mailboxEnabled,
        mailboxOpenAt: new Date(mailboxOpenAt),
        mailboxCloseAt: new Date(mailboxCloseAt),
        guessingEnabled,
        maxGuesses,
        allowDuplicateGuesses,
        adventEnabled,
        adventStartAt: new Date(adventStartAt),
        adventAllowCatchUp,
        wheelEnabled,
        elfChallengeEnabled,
        quizEnabled,
        quizAllowRetake,
        deliveryTrackingEnabled,
        thankYouEnabled,
        snowGlobeRevealEnabled,
        giftPreferencesCutoffAt: new Date(giftPreferencesCutoffAt),
      });
      await onEventUpdated();
      playPopSound();
      setStatusMsg({
        type: 'ok',
        text: 'Event schedule, budget guide & Workshop settings saved to Firestore!',
      });
    } catch (err) {
      reportError(err, 'Could not save event settings to Firestore.');
    } finally {
      setBusy(false);
    }
  };

  const handleIssueRecoveryLink = async (
    targetParticipantId: string,
    recoveryRequestId?: string
  ) => {
    if (!adminUser) return;
    const target = participants.find((p) => p.id === targetParticipantId);
    if (!target) {
      setStatusMsg({ type: 'err', text: 'Please select a verified participant first.' });
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await issueRecoveryInvitation({
        eventId: activeEventId,
        targetParticipant: target,
        actorEmail: adminUser.email || 'admin',
        reasonNote: recoveryReasonNote || 'Organizer verified participant out-of-band.',
        recoveryRequestId,
      });
      setLastRecoveryLink(res.inviteUrl);
      setRecoveryReasonNote('');
      await loadAdminLists();
      playChimeSound();
      setStatusMsg({
        type: 'ok',
        text: `Issued one-time 24h recovery link for ${target.name} (old invite revoked & logged).`,
      });
    } catch (err) {
      reportError(err, 'Could not issue session recovery link.');
    } finally {
      setBusy(false);
    }
  };

  const handleDismissRecoveryRequest = async (req: SessionRecoveryRequestRecord) => {
    if (!adminUser) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      await dismissRecoveryRequest(
        req.id,
        activeEventId,
        adminUser.email || 'admin',
        req.requestedName
      );
      await loadAdminLists();
      playPopSound();
    } catch (err) {
      reportError(err, 'Could not dismiss recovery request.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminCorrectAck = async (
    ack: DeliveryAcknowledgmentRecord,
    newStatus: DeliveryAckStatus
  ) => {
    if (!adminUser) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      await adminCorrectDeliveryAcknowledgment({
        assignmentId: ack.assignmentId,
        eventId: activeEventId,
        newStatus,
        correctionNote: `Organizer updated delivery confirmation status to "${newStatus}".`,
        actorEmail: adminUser.email || 'admin',
      });
      await loadAdminLists();
      playPopSound();
      setStatusMsg({
        type: 'ok',
        text: `Updated delivery acknowledgment to "${newStatus}" and logged audit record.`,
      });
    } catch (err) {
      reportError(err, 'Could not update delivery acknowledgment.');
    } finally {
      setBusy(false);
    }
  };

  const applyQuickPreset = (preset: 'christmas' | 'giftee-now' | 'santa-now') => {
    const now = Date.now();
    if (preset === 'christmas') {
      setRegistrationDeadline(toDatetimeLocalValue(new Date(now + 10 * 86400_000)));
      setGifteeRevealAt(toDatetimeLocalValue(new Date(now + 12 * 86400_000)));
      setGiftDeadline(toDatetimeLocalValue(new Date(now + 22 * 86400_000)));
      setSantaIdentityRevealAt(toDatetimeLocalValue(new Date(now + 24 * 86400_000)));
    } else if (preset === 'giftee-now') {
      setRegistrationDeadline(toDatetimeLocalValue(new Date(now - 3600_000)));
      setGifteeRevealAt(toDatetimeLocalValue(new Date(now - 5 * 60_000)));
      setGiftDeadline(toDatetimeLocalValue(new Date(now + 5 * 86400_000)));
      setSantaIdentityRevealAt(toDatetimeLocalValue(new Date(now + 7 * 86400_000)));
    } else {
      setRegistrationDeadline(toDatetimeLocalValue(new Date(now - 3 * 86400_000)));
      setGifteeRevealAt(toDatetimeLocalValue(new Date(now - 2 * 86400_000)));
      setGiftDeadline(toDatetimeLocalValue(new Date(now - 3600_000)));
      setSantaIdentityRevealAt(toDatetimeLocalValue(new Date(now - 5 * 60_000)));
    }
    playPopSound();
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLiveEvent) {
      setStatusMsg({
        type: 'err',
        text: 'Please save the Event & Timers tab once first to initialize the event in Firestore.',
      });
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await generatePersonalInvitation(
        activeEventId,
        inviteLabel || 'Secret Santa Guest'
      );
      setLastGeneratedLink(res.inviteUrl);
      setInviteLabel('');
      await loadAdminLists();
      playPopSound();
      setStatusMsg({
        type: 'ok',
        text: 'Secure 256-bit invitation link created! Copy it now — only its SHA-256 hash is stored.',
      });
    } catch (err) {
      reportError(err, 'Failed to create personal invitation link.');
    } finally {
      setBusy(false);
    }
  };

  const handleSeedParticipants = async () => {
    if (!isLiveEvent) {
      setStatusMsg({
        type: 'err',
        text: 'Save the Event & Timers tab first to initialize the Firestore event.',
      });
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const added = await seedFestiveParticipants(activeEventId);
      await loadAdminLists();
      playPopSound();
      setStatusMsg({
        type: 'ok',
        text: `Added ${added} sample festive participants so you can test cryptographic matching!`,
      });
    } catch (err) {
      reportError(err, 'Failed to add sample festive guests.');
    } finally {
      setBusy(false);
    }
  };

  const handleRunMatching = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await runCryptographicMatching(activeEventId);
      await onEventUpdated();
      await loadAdminLists();
      playChimeSound();
      setStatusMsg({
        type: 'ok',
        text: `Cryptographic derangement matched ${res.matchedCount} participants with zero self-matches!`,
      });
    } catch (err) {
      reportError(err, 'Could not complete Secret Santa matching.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetMatches = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await resetMatchesForTesting(activeEventId);
      await onEventUpdated();
      await loadAdminLists();
      setStatusMsg({
        type: 'ok',
        text: 'Matches cleared for test mode. You can re-run matching when ready.',
      });
    } catch (err) {
      reportError(err, 'Failed to reset matches.');
    } finally {
      setBusy(false);
    }
  };

  const handleClearAllParticipantsAndMatches = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const result = await clearAllParticipantsAndMatches(activeEventId);
      setConfirmClearAll(false);
      await onEventUpdated();
      await loadAdminLists();
      playPopSound();
      setStatusMsg({
        type: 'ok',
        text: `Cleared ${result.deletedParticipants} participants, ${result.deletedMatches} matches, and ${result.deletedReveals} reveal cards from Firestore.`,
      });
    } catch (err) {
      reportError(err, 'Failed to clear participants and matches.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddCoAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const created = await addCoAdminAccount(newCoAdminEmail, newCoAdminName);
      setNewCoAdminEmail('');
      setNewCoAdminName('');
      await loadAdminLists();
      playPopSound();
      setStatusMsg({
        type: 'ok',
        text: `Added ${created.email} as a co-admin! They can now sign in with Google to manage this event.`,
      });
    } catch (err) {
      reportError(err, 'Could not add co-admin account.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveCoAdmin = async (account: AdminAccount) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await removeCoAdminAccount(account.id);
      await loadAdminLists();
      playPopSound();
      setStatusMsg({
        type: 'ok',
        text: `Removed co-admin access for ${account.email}.`,
      });
    } catch (err) {
      reportError(err, 'Could not remove co-admin account.');
    } finally {
      setBusy(false);
    }
  };

  const handleMakeParticipantOrganiser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser || !promoteParticipantTarget || !promoteParticipantEmail.trim()) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const effectiveActor: PlatformUser = {
        id: platformUser?.id || adminUser.uid,
        email: platformUser?.email || adminUser.email || BOOTSTRAPPED_ADMIN_EMAIL,
        displayName: platformUser?.displayName || adminUser.displayName || 'Supreme Santa',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: platformUser?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      await ensureDefaultEventSyncedToGroup(effectiveActor).catch(() => null);
      const [allUsers, allGroups] = await Promise.all([
        listPlatformUsers().catch(() => []),
        listAllGroupsAdmin().catch(() => []),
      ]);
      const grantGroupIds =
        promoteParticipantGrantActiveGroup && allGroups.some((g) => g.id === activeEventId)
          ? [activeEventId]
          : [];
      const created = await registerOrPromoteUserByEmail({
        actor: effectiveActor,
        email: promoteParticipantEmail,
        displayName: promoteParticipantTarget.name,
        role: 'ORGANISER',
        initialGroupIds: grantGroupIds,
        allUsers,
        allGroups,
        reason: `Promoted participant "${promoteParticipantTarget.name}" to Head Elf Organiser.`,
      });
      setPromoteParticipantTarget(null);
      setPromoteParticipantEmail('');
      playChimeSound();
      setStatusMsg({
        type: 'ok',
        text: `${created.displayName} (${created.email}) is now a Head Elf Organiser 🧝${
          grantGroupIds.length > 0 ? ` with management access to "${event.name}"` : ''
        }. They can sign in with Google in the Console to manage groups.`,
      });
    } catch (err) {
      reportError(err, 'Could not grant Head Elf Organiser access.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Secret Santa Admin Console"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Top Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="font-display text-lg sm:text-xl font-bold whitespace-nowrap">
              {isAuthorizedAdmin
                ? '🎅 Supreme Santa Admin Console'
                : platformUser?.role === 'ORGANISER'
                  ? '🧝 Head Elf Organiser Console'
                  : 'Secret Santa Console'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {adminUser && (
              <button
                type="button"
                onClick={() => void signOutAdmin()}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Console"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Auth Gate or Role-Scoped Workspace */}
        {!adminUser ? (
          <div className="p-8 sm:p-12 text-center space-y-5 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <KeyRound className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="font-display text-2xl font-bold text-slate-900">
                Sign In to Secret Santa Console
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sign in with Google to access your Supreme Santa Admin or Head Elf Organiser tools,
                or register your account so an Admin can promote you to Head Elf.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {busy ? 'Opening Google Sign-In...' : 'Sign in with Google'}
            </button>
          </div>
        ) : checkingAccess ? (
          <div className="p-10 text-center space-y-3">
            <RefreshCw className="w-7 h-7 mx-auto text-slate-400 animate-spin" />
            <p className="text-sm font-semibold text-slate-600">
              Checking role permissions for {adminUser.email}...
            </p>
          </div>
        ) : platformUser?.status === 'SUSPENDED' ? (
          <div className="p-8 text-center space-y-4 max-w-md mx-auto">
            <h3 className="font-display text-2xl font-bold text-rose-700">
              Account Suspended
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your account ({adminUser.email}) is currently suspended by a Supreme Santa Admin.
              Please contact your organizer if you believe this is a mistake.
            </p>
            <button
              type="button"
              onClick={() => void signOutAdmin()}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        ) : !isAuthorizedAdmin && platformUser?.role === 'ORGANISER' ? (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <OrganiserDashboard
              actor={platformUser}
              initialGroupId={activeEventId}
              onOpenGroupInApp={(groupId) => {
                onSelectActiveGroup?.(groupId);
                onClose();
              }}
            />
          </div>
        ) : !isAuthorizedAdmin ? (
          <div className="p-8 text-center space-y-4 max-w-md mx-auto">
            <div className="text-4xl">{ROLE_META.PARTICIPANT.emoji}</div>
            <h3 className="font-display text-2xl font-bold text-slate-900">
              Signed in as Secret Santa Participant
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Welcome, <span className="font-semibold">{adminUser.displayName || adminUser.email}</span>!
              Your account is registered as a <strong>Participant — Secret Santa</strong>. Ask a
              Supreme Santa Admin ({BOOTSTRAPPED_ADMIN_EMAIL}) to promote you to{' '}
              <strong>Head Elf Organiser 🧝</strong> in <em>Users &amp; Roles</em> if you&apos;d
              like to create and manage Secret Santa groups.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold cursor-pointer"
              >
                Back to Secret Santa
              </button>
              <button
                type="button"
                onClick={() => void signOutAdmin()}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold cursor-pointer"
              >
                Switch Account
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Supreme Santa Navigation: Platform Governance + Active Group Operations */}
            <div className="space-y-2.5 border-b border-slate-200 pb-3.5">
              {/* Row 1: Platform Governance */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/5 p-1 rounded-xl">
                  {[
                    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
                    { id: 'all-groups' as const, label: 'All Groups', icon: Users },
                    { id: 'users-roles' as const, label: 'Users & Roles', icon: UserCheck },
                    { id: 'organiser-access' as const, label: 'Organiser Access', icon: KeyRound },
                    { id: 'system-settings' as const, label: 'System Settings', icon: Settings },
                    { id: 'audit-logs' as const, label: 'Audit Logs', icon: ScrollText },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-700 hover:text-slate-950 hover:bg-white/70'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <span className="text-xs font-semibold text-slate-500">
                  Active Group: <strong className="text-slate-900">{event.name}</strong>
                </span>
              </div>

              {/* Row 2: Active Group Operations */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  {[
                    { id: 'timers' as const, label: 'Timers & Event', icon: Clock },
                    { id: 'workshop' as const, label: 'Budget & Workshop', icon: Sliders },
                    { id: 'invites' as const, label: `Invitations (${invitations.length})`, icon: Link2 },
                    { id: 'participants' as const, label: `Participants (${participants.length})`, icon: Users },
                    {
                      id: 'recovery' as const,
                      label: `Recovery & Delivery (${
                        recoveryRequests.filter((r) => r.status === 'pending').length +
                        deliveryAcks.filter((a) => a.status === 'problem').length
                      })`,
                      icon: LifeBuoy,
                    },
                    { id: 'admins' as const, label: `Co-Admins (${adminAccounts.length + 1})`, icon: UserCheck },
                    // PRE-PUBLISH TESTING ONLY — remove tab before publishing
                    { id: 'testing' as const, label: 'Testing Resets', icon: FlaskConical },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => void loadAdminLists()}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>
            </div>

            {statusMsg && (
              <div
                role="alert"
                className={`rounded-2xl px-4 py-3 text-sm font-medium border space-y-2 ${
                  statusMsg.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {statusMsg.type === 'err' && (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{statusMsg.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatusMsg(null)}
                    aria-label="Dismiss notification"
                    className="p-0.5 rounded-lg opacity-60 hover:opacity-100 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {statusMsg.technical && (
                  <div className="pt-1 border-t border-rose-200/70">
                    <button
                      type="button"
                      onClick={() => setShowTechDetails((v) => !v)}
                      className="text-xs font-semibold text-rose-700 hover:text-rose-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {showTechDetails ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          Hide technical details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          View technical details
                        </>
                      )}
                    </button>
                    {showTechDetails && (
                      <pre className="mt-2 p-2.5 rounded-xl bg-white/80 border border-rose-200 text-[11px] font-mono text-rose-950 overflow-x-auto whitespace-pre-wrap break-all">
                        {statusMsg.technical}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PLATFORM GOVERNANCE TABS (ADMIN SUPREME SANTA) */}
            {(activeTab === 'overview' ||
              activeTab === 'all-groups' ||
              activeTab === 'users-roles' ||
              activeTab === 'organiser-access' ||
              activeTab === 'system-settings' ||
              activeTab === 'audit-logs') && (
              <AdminGovernancePanels
                actor={{
                  id: platformUser?.id || adminUser.uid,
                  email: platformUser?.email || adminUser.email || BOOTSTRAPPED_ADMIN_EMAIL,
                  displayName: platformUser?.displayName || adminUser.displayName || 'Supreme Santa',
                  photoURL: platformUser?.photoURL || adminUser.photoURL || '',
                  role: 'ADMIN',
                  status: 'ACTIVE',
                  createdAt: platformUser?.createdAt || new Date(),
                  updatedAt: platformUser?.updatedAt || new Date(),
                }}
                activeSubTab={activeTab}
                activeEventId={activeEventId}
                onSelectActiveGroup={(groupId) => {
                  onSelectActiveGroup?.(groupId);
                  setStatusMsg({
                    type: 'ok',
                    text: 'Switched active workspace to selected group.',
                  });
                }}
                onNotice={(msg) => setStatusMsg(msg)}
              />
            )}

            {/* TAB 1: TIMERS & EVENT */}
            {activeTab === 'timers' && (
              <form onSubmit={handleSaveTimers} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      required
                      maxLength={120}
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Timezone
                    </label>
                    <input
                      type="text"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Registration Deadline
                    </label>
                    <input
                      type="datetime-local"
                      value={registrationDeadline}
                      onChange={(e) => setRegistrationDeadline(e.target.value)}
                      required
                      className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3.5 text-sm font-mono-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-rose-700 mb-1">
                      Timer 1: Giftee Reveal Time (Who You Gift To)
                    </label>
                    <input
                      type="datetime-local"
                      value={gifteeRevealAt}
                      onChange={(e) => setGifteeRevealAt(e.target.value)}
                      required
                      className="w-full min-h-[42px] rounded-xl border border-rose-300 bg-rose-50/40 px-3.5 text-sm font-mono-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-700 mb-1">
                      Send Gifts Before Deadline
                    </label>
                    <input
                      type="datetime-local"
                      value={giftDeadline}
                      onChange={(e) => setGiftDeadline(e.target.value)}
                      required
                      className="w-full min-h-[42px] rounded-xl border border-amber-300 bg-amber-50/40 px-3.5 text-sm font-mono-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-purple-700 mb-1">
                      Timer 2: Secret Santa Identity Reveal (Who Gifted You)
                    </label>
                    <input
                      type="datetime-local"
                      value={santaIdentityRevealAt}
                      onChange={(e) => setSantaIdentityRevealAt(e.target.value)}
                      required
                      className="w-full min-h-[42px] rounded-xl border border-purple-300 bg-purple-50/40 px-3.5 text-sm font-mono-tabular"
                    />
                  </div>
                </div>

                {/* Quick Test Presets */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
                  <p className="text-xs font-bold text-slate-700">
                    Quick Schedule Presets (click Save Timers below to apply):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyQuickPreset('christmas')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                    >
                      Future Festive Schedule
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickPreset('giftee-now')}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
                    >
                      Unlock Timer 1 (Giftee Reveal) Now
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickPreset('santa-now')}
                      className="px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-100 cursor-pointer"
                    >
                      Unlock Timer 2 (Secret Santa Identity) Now
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={registrationOpen}
                      onChange={(e) => setRegistrationOpen(e.target.checked)}
                      className="w-4 h-4 accent-rose-600"
                    />
                    Registration Open for New Participants
                  </label>

                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[46px] px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm cursor-pointer disabled:opacity-60"
                  >
                    {busy ? 'Saving...' : isLiveEvent ? 'Save Timers to Firestore' : 'Initialize Event in Firestore'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 1B: BUDGET & WORKSHOP FEATURE CONTROLS */}
            {activeTab === 'workshop' && (
              <form onSubmit={handleSaveTimers} className="space-y-5">
                {/* Gift Budget Guide Section */}
                <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-amber-700" />
                      <h3 className="font-display font-bold text-base text-slate-900">
                        Gift Budget Guide (Feature 9)
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-amber-900">
                      Preview:{' '}
                      {formatBudgetGuide({
                        mode: budgetMode,
                        currency: budgetCurrency || '₹',
                        minAmount: Number(budgetMin) || 0,
                        maxAmount:
                          budgetMode === 'fixed'
                            ? Number(budgetMin) || 0
                            : Number(budgetMax) || Number(budgetMin) || 0,
                        announcement: budgetAnnouncement,
                      })}
                    </span>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {BUDGET_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setBudgetMode(preset.mode);
                          setBudgetMin(preset.min);
                          setBudgetMax(preset.max);
                          setBudgetCurrency('₹');
                          playPopSound();
                        }}
                        className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-950 hover:bg-amber-100 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Mode</label>
                      <select
                        value={budgetMode}
                        onChange={(e) => setBudgetMode(e.target.value as GiftBudgetMode)}
                        className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                      >
                        <option value="fixed">Fixed Target</option>
                        <option value="range">Min–Max Range</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Currency</label>
                      <input
                        type="text"
                        value={budgetCurrency}
                        onChange={(e) => setBudgetCurrency(e.target.value)}
                        maxLength={6}
                        className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        {budgetMode === 'fixed' ? 'Target Amount' : 'Min Amount'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={1000000}
                        value={budgetMin}
                        onChange={(e) => setBudgetMin(Number(e.target.value))}
                        className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                      />
                    </div>
                    {budgetMode === 'range' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Max Amount
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={1000000}
                          value={budgetMax}
                          onChange={(e) => setBudgetMax(Number(e.target.value))}
                          className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Organizer Budget Note / Announcement
                    </label>
                    <input
                      type="text"
                      value={budgetAnnouncement}
                      onChange={(e) => setBudgetAnnouncement(e.target.value)}
                      maxLength={220}
                      placeholder="e.g. Thoughtful gifts around ₹1,000 — handmade surprises always welcome!"
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    />
                  </div>
                </div>

                {/* Feature Toggles & Windows */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-4">
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Santa&apos;s Workshop Feature Controls
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Anonymous Santa Mailbox', checked: mailboxEnabled, set: setMailboxEnabled },
                      { label: 'Guess Your Santa Detective Game', checked: guessingEnabled, set: setGuessingEnabled },
                      { label: 'Allow Duplicate Guesses', checked: allowDuplicateGuesses, set: setAllowDuplicateGuesses },
                      { label: 'Daily Advent Calendar (25 Doors)', checked: adventEnabled, set: setAdventEnabled },
                      { label: 'Allow Advent Catch-Up Opening', checked: adventAllowCatchUp, set: setAdventAllowCatchUp },
                      { label: "Spin Santa's Daily Wheel", checked: wheelEnabled, set: setWheelEnabled },
                      { label: 'Find the Hidden Elf Challenge', checked: elfChallengeEnabled, set: setElfChallengeEnabled },
                      { label: 'Naughty or Nice Meter Quiz', checked: quizEnabled, set: setQuizEnabled },
                      { label: 'Allow Quiz Retake', checked: quizAllowRetake, set: setQuizAllowRetake },
                      { label: "Santa's Delivery Express Tracker", checked: deliveryTrackingEnabled, set: setDeliveryTrackingEnabled },
                      { label: 'Animated Thank-You Cards', checked: thankYouEnabled, set: setThankYouEnabled },
                      { label: 'Interactive Magical Snow Globe', checked: snowGlobeRevealEnabled, set: setSnowGlobeRevealEnabled },
                    ].map((toggle) => (
                      <label
                        key={toggle.label}
                        className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 px-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={toggle.checked}
                          onChange={(e) => toggle.set(e.target.checked)}
                          className="w-4 h-4 accent-rose-600"
                        />
                        <span className="font-medium text-slate-800">{toggle.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Max Guesses per Participant (1–10)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={maxGuesses}
                        onChange={(e) => setMaxGuesses(Number(e.target.value))}
                        className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Advent Calendar Start Date (Day 1)
                      </label>
                      <input
                        type="datetime-local"
                        value={adventStartAt}
                        onChange={(e) => setAdventStartAt(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Mailbox Opens At
                      </label>
                      <input
                        type="datetime-local"
                        value={mailboxOpenAt}
                        onChange={(e) => setMailboxOpenAt(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Mailbox Closes At
                      </label>
                      <input
                        type="datetime-local"
                        value={mailboxCloseAt}
                        onChange={(e) => setMailboxCloseAt(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Gift Dislikes &amp; Restrictions Cutoff Deadline
                      </label>
                      <input
                        type="datetime-local"
                        value={giftPreferencesCutoffAt}
                        onChange={(e) => setGiftPreferencesCutoffAt(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[46px] px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm cursor-pointer disabled:opacity-60"
                  >
                    {busy ? 'Saving...' : 'Save Budget & Workshop Settings'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: PERSONAL INVITATION LINKS */}
            {activeTab === 'invites' && (
              <div className="space-y-5">
                <form onSubmit={handleGenerateInvite} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={inviteLabel}
                    onChange={(e) => setInviteLabel(e.target.value)}
                    placeholder="Guest name or label (e.g. Riya from Design)"
                    maxLength={100}
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Link2 className="w-4 h-4" />
                    Generate Personal Link
                  </button>
                </form>

                {lastGeneratedLink && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                    <p className="text-xs font-bold text-emerald-900">
                      Share this one-time personal invitation link (only its SHA-256 hash is stored in Firestore):
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white border border-emerald-200 rounded-xl px-3 py-2 break-all text-slate-800">
                        {lastGeneratedLink}
                      </code>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(lastGeneratedLink);
                          setCopiedLink(true);
                          window.setTimeout(() => setCopiedLink(false), 2200);
                        }}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLink ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {invitations.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">
                      No personal invitations generated yet.
                    </p>
                  ) : (
                    invitations.map((inv) => (
                      <div
                        key={inv.tokenHash}
                        className="rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{inv.label}</p>
                          <p className="text-xs text-slate-500 font-mono-tabular">
                            Hash: {inv.tokenHash.slice(0, 14)}… · Status:{' '}
                            <span
                              className={
                                inv.status === 'claimed'
                                  ? 'text-emerald-700 font-bold'
                                  : inv.status === 'revoked'
                                    ? 'text-rose-600 font-bold'
                                    : 'text-amber-700 font-bold'
                              }
                            >
                              {inv.status}
                            </span>
                          </p>
                        </div>

                        {inv.status === 'pending' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await revokeInvitation(inv.tokenHash);
                                await loadAdminLists();
                              } catch (err) {
                                reportError(err, 'Could not revoke invitation link.');
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PARTICIPANTS & MATCHING */}
            {activeTab === 'participants' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <div>
                    <p className="font-display font-bold text-base text-slate-900">
                      Matching Status: {event.isMatched ? 'Matched & Locked 🔒' : 'Not Matched Yet'}
                    </p>
                    <p className="text-xs text-slate-600">
                      {participants.filter((p) => p.hasJoined).length} joined participants ready for
                      cryptographic derangement
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!event.isMatched && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleSeedParticipants}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        Seed 5 Sample Guests
                      </button>
                    )}

                    {!event.isMatched ? (
                      <button
                        type="button"
                        disabled={busy || participants.filter((p) => p.hasJoined).length < 2}
                        onClick={handleRunMatching}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Shuffle className="w-4 h-4" />
                        Run Secret Santa Matching
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleResetMatches}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold cursor-pointer"
                      >
                        Reset Matches (Test Mode)
                      </button>
                    )}

                    {(participants.length > 0 || event.isMatched) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          playPopSound();
                          setConfirmClearAll((prev) => !prev);
                        }}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear All Participants &amp; Matches
                      </button>
                    )}
                  </div>
                </div>

                {confirmClearAll && (
                  <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 text-rose-900">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs sm:text-sm">
                        <p className="font-bold">Clear all participants and matches?</p>
                        <p className="text-rose-800/85">
                          This permanently deletes all {participants.length} registered participants,
                          giftee matches, and Secret Santa reveals from Firestore and reopens registration.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmClearAll(false)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleClearAllParticipantsAndMatches}
                        className="min-h-[38px] px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                      >
                        {busy ? 'Clearing...' : 'Yes, Clear Everything'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  {participants.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">
                      No participants registered in Firestore yet.
                    </p>
                  ) : (
                    participants.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarGraphic
                            avatarId={p.avatarId}
                            size={44}
                            hasGoldenCrown={Boolean(p.hasGoldenDetectiveCrown)}
                            className="shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">
                              {p.name}
                              {p.hasGoldenDetectiveCrown ? (
                                <span className="ml-2 text-xs font-semibold text-amber-700">
                                  · Golden Detective Crown
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {p.address.city}, {p.address.postalCode} · {p.hobbies.join(', ')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setPromoteParticipantTarget(p);
                              setPromoteParticipantEmail('');
                              setPromoteParticipantGrantActiveGroup(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Make Organiser
                          </button>

                          {!event.isMatched && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await removeParticipant(p.id);
                                  await loadAdminLists();
                                } catch (err) {
                                  reportError(err, `Could not remove ${p.name}.`);
                                }
                              }}
                              aria-label={`Remove ${p.name}`}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Inline Modal: Grant Organiser Access to a Participant */}
                {promoteParticipantTarget && (
                  <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <form
                      onSubmit={handleMakeParticipantOrganiser}
                      className="w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl p-6 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-display text-lg font-bold text-slate-900">
                            Make {promoteParticipantTarget.name} a Head Elf Organiser? 🧝
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Enter their Google email below. They&apos;ll immediately gain Head Elf
                            Organiser access when they sign in to the Secret Santa Console.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPromoteParticipantTarget(null)}
                          className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Participant&apos;s Google Email *
                        </label>
                        <input
                          type="email"
                          required
                          autoFocus
                          value={promoteParticipantEmail}
                          onChange={(e) => setPromoteParticipantEmail(e.target.value)}
                          placeholder="name@gmail.com"
                          maxLength={160}
                          className="w-full min-h-[42px] rounded-xl border border-slate-300 px-3 text-sm"
                        />
                      </div>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={promoteParticipantGrantActiveGroup}
                          onChange={(e) =>
                            setPromoteParticipantGrantActiveGroup(e.target.checked)
                          }
                          className="w-4 h-4 accent-emerald-600"
                        />
                        <span>Also grant management access to &ldquo;{event.name}&rdquo;</span>
                      </label>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setPromoteParticipantTarget(null)}
                          className="min-h-[40px] px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={busy || !promoteParticipantEmail.trim()}
                          className="min-h-[40px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4" />
                          {busy ? 'Granting...' : 'Make Organiser'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3B: SESSION RECOVERY, DELIVERY ISSUES & AUDIT LOG */}
            {activeTab === 'recovery' && (
              <div className="space-y-6">
                {/* Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <div className="text-[11px] font-semibold text-slate-500">Pending Recovery</div>
                    <div className="font-mono-tabular text-xl font-bold text-amber-700 mt-0.5">
                      {recoveryRequests.filter((r) => r.status === 'pending').length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <div className="text-[11px] font-semibold text-slate-500">Gifts Confirmed</div>
                    <div className="font-mono-tabular text-xl font-bold text-emerald-700 mt-0.5">
                      {deliveryAcks.filter((a) => a.status === 'received').length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <div className="text-[11px] font-semibold text-slate-500">Delivery Issues</div>
                    <div className="font-mono-tabular text-xl font-bold text-rose-700 mt-0.5">
                      {deliveryAcks.filter((a) => a.status === 'problem').length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <div className="text-[11px] font-semibold text-slate-500">Audit Events</div>
                    <div className="font-mono-tabular text-xl font-bold text-slate-900 mt-0.5">
                      {auditLogs.length}
                    </div>
                  </div>
                </div>

                {/* Direct 24h One-Time Recovery Link Issuer */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-rose-600" />
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Issue 24-Hour One-Time Session Recovery Link
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Restores a participant&apos;s exact profile, dislikes, collectibles, and Secret
                    Santa matches onto a new device while automatically revoking their old link and
                    writing an immutable audit entry.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={recoveryTargetParticipantId}
                      onChange={(e) => setRecoveryTargetParticipantId(e.target.value)}
                      className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    >
                      <option value="">Select verified participant...</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.address.city || 'Guest'})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={recoveryReasonNote}
                      onChange={(e) => setRecoveryReasonNote(e.target.value)}
                      placeholder="Verification note (e.g. Confirmed via WhatsApp)"
                      maxLength={200}
                      className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy || !recoveryTargetParticipantId}
                      onClick={() => void handleIssueRecoveryLink(recoveryTargetParticipantId)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white text-xs sm:text-sm font-semibold cursor-pointer"
                    >
                      Generate 24h Recovery Link
                    </button>
                  </div>

                  {lastRecoveryLink && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-2">
                      <p className="text-xs font-bold text-emerald-900">
                        Send this private 24-hour recovery link directly to the verified participant:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-white border border-emerald-200 rounded-lg px-2.5 py-2 break-all text-slate-800">
                          {lastRecoveryLink}
                        </code>
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(lastRecoveryLink);
                            setCopiedRecoveryLink(true);
                            window.setTimeout(() => setCopiedRecoveryLink(false), 2200);
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          {copiedRecoveryLink ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedRecoveryLink ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Incoming Recovery Requests Queue */}
                <div className="space-y-2.5">
                  <h4 className="font-display font-bold text-sm text-slate-900">
                    Session Recovery Requests ({recoveryRequests.length})
                  </h4>
                  {recoveryRequests.length === 0 ? (
                    <p className="text-xs text-slate-500 rounded-xl border border-slate-200 p-4 text-center">
                      No participant recovery requests right now.
                    </p>
                  ) : (
                    recoveryRequests.map((req) => {
                      const autoMatch = participants.find(
                        (p) => p.name.trim().toLowerCase() === req.requestedName.trim().toLowerCase()
                      );
                      const resolvedTargetId = recoveryTargetParticipantId || autoMatch?.id || '';
                      const resolvedTargetLabel = recoveryTargetParticipantId
                        ? participants.find((p) => p.id === recoveryTargetParticipantId)?.name ||
                          'Selected Guest'
                        : autoMatch?.name || 'Select guest above';
                      return (
                        <div
                          key={req.id}
                          className="rounded-2xl border border-slate-200 p-3.5 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-slate-900">
                                {req.requestedName}
                              </p>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  req.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800'
                                    : req.status === 'resolved'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>
                            {req.verificationHint && (
                              <p className="text-xs text-slate-600">Hint: {req.verificationHint}</p>
                            )}
                            <p className="text-[11px] text-slate-400">
                              {req.createdAt.toLocaleString()}
                            </p>
                          </div>

                          {req.status === 'pending' && (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={busy || !resolvedTargetId}
                                onClick={() =>
                                  void handleIssueRecoveryLink(resolvedTargetId, req.id)
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
                              >
                                {resolvedTargetId
                                  ? `Issue Link to ${resolvedTargetLabel}`
                                  : 'Select Guest Above First'}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleDismissRecoveryRequest(req)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                              >
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Delivery Acknowledgments & Problem Reports */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <h4 className="font-display font-bold text-sm text-slate-900">
                      Recipient Delivery Acknowledgments ({deliveryAcks.length})
                    </h4>
                  </div>
                  {deliveryAcks.length === 0 ? (
                    <p className="text-xs text-slate-500 rounded-xl border border-slate-200 p-4 text-center">
                      No recipient delivery confirmations or issue reports yet.
                    </p>
                  ) : (
                    deliveryAcks.map((ack) => (
                      <div
                        key={ack.assignmentId}
                        className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                          ack.status === 'problem'
                            ? 'border-rose-300 bg-rose-50/70'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-mono-tabular text-xs font-bold text-slate-800">
                            Assignment {ack.assignmentId.slice(0, 12)}… ·{' '}
                            <span
                              className={
                                ack.status === 'received'
                                  ? 'text-emerald-700'
                                  : ack.status === 'problem'
                                    ? 'text-rose-700'
                                    : 'text-amber-700'
                              }
                            >
                              {ack.status.toUpperCase()}
                            </span>
                          </p>
                          {ack.problemSummary && (
                            <p className="text-xs text-rose-800 font-medium">
                              Reported Issue: {ack.problemSummary}
                            </p>
                          )}
                          {ack.adminCorrectionNote && (
                            <p className="text-[11px] text-slate-500">
                              Corrected by {ack.correctedBy}: {ack.adminCorrectionNote}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {ack.status !== 'received' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleAdminCorrectAck(ack, 'received')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                            >
                              Mark Received
                            </button>
                          )}
                          {ack.status !== 'pending' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleAdminCorrectAck(ack, 'pending')}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
                            >
                              Reset Pending
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Immutable Recovery & Correction Audit Log */}
                <div className="space-y-2">
                  <h4 className="font-display font-bold text-sm text-slate-900">
                    Immutable Audit Trail ({auditLogs.length})
                  </h4>
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-slate-500">No audit entries recorded yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{log.action}</span> ·{' '}
                            <span className="text-slate-700">{log.targetLabel}</span>
                            {log.note && <span className="text-slate-500"> — {log.note}</span>}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono-tabular">
                            {log.actorEmail} · {log.createdAt.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: CO-ADMINS */}
            {activeTab === 'admins' && (
              <div className="space-y-5">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Add a Co-Admin Organizer
                    </h3>
                    <p className="text-xs text-slate-600">
                      Grant another verified Google account full access to manage timers, invitation
                      links, participants, and matching.
                    </p>
                  </div>

                  <form onSubmit={handleAddCoAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="email"
                      required
                      value={newCoAdminEmail}
                      onChange={(e) => setNewCoAdminEmail(e.target.value)}
                      placeholder="co-admin@gmail.com"
                      maxLength={160}
                      className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm"
                    />
                    <input
                      type="text"
                      value={newCoAdminName}
                      onChange={(e) => setNewCoAdminName(e.target.value)}
                      placeholder="Name (e.g. Dheeraj)"
                      maxLength={100}
                      className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4" />
                      {busy ? 'Adding...' : 'Add Co-Admin'}
                    </button>
                  </form>
                </div>

                <div className="space-y-2.5">
                  {/* Primary Bootstrapped Organizer (Protected) */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          Primary Organizer
                        </p>
                        <p className="text-xs text-slate-600 font-mono-tabular truncate">
                          {BOOTSTRAPPED_ADMIN_EMAIL}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold shrink-0">
                      Protected
                    </span>
                  </div>

                  {/* Added Co-Admins */}
                  {adminAccounts.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-5">
                      No additional co-admins added yet. Enter a Gmail address above to share admin access.
                    </p>
                  ) : (
                    adminAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="rounded-2xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">
                              {acc.displayName || 'Co-Admin Organizer'}
                            </p>
                            <p className="text-xs text-slate-500 font-mono-tabular truncate">
                              {acc.email}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRemoveCoAdmin(acc)}
                          aria-label={`Remove co-admin ${acc.email}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* PRE-PUBLISH TESTING ONLY — TAB 7: TESTING RESETS */}
            {activeTab === 'testing' && (
              <AdminTestingResetPanel
                participants={participants}
                isLiveEvent={isLiveEvent}
                busy={busy}
                setBusy={setBusy}
                onSuccess={(message) => setStatusMsg({ type: 'ok', text: message })}
                onError={reportError}
                onRefreshLists={async () => {
                  await Promise.all([loadAdminLists(), onEventUpdated()]);
                }}
              />
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
