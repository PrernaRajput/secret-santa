import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  DEFAULT_EVENT_ID,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AdminAccount,
  DeliveryAckStatus,
  DeliveryAcknowledgmentRecord,
  GenderCategory,
  GiftBudgetConfig,
  GiftDislikesShareable,
  InvitationRecord,
  MatchAssignment,
  ParticipantAddress,
  ParticipantProfile,
  PublicRosterEntry,
  RecoveryAuditLogRecord,
  SantaIdentityReveal,
  SecretSantaEvent,
  SessionRecoveryRequestRecord,
  ThemeId,
} from '../types/secretSanta';
import {
  generateSecureTokenHex,
  generateUnbiasedDerangement,
  sha256Hex,
} from '../utils/crypto';
import { extractShareableDislikes } from '../utils/workshopLogic';
import { buildPersonalInviteUrl } from '../utils/rbacLogic';

function toDateSafe(val: unknown, fallback: Date): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

export function buildDefaultEventTemplate(): SecretSantaEvent {
  const now = new Date();
  const regDeadline = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 12); // +12 days
  const gifteeReveal = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14); // +14 days
  const giftDeadline = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 24); // +24 days
  const santaIdentityReveal = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 26); // +26 days
  const adventStart = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 6); // 7 doors available immediately for joyful play
  const adventEnd = new Date(adventStart.getTime() + 1000 * 60 * 60 * 24 * 25);

  return {
    id: DEFAULT_EVENT_ID,
    name: 'Secret Santa 2026',
    timezone: 'Asia/Kolkata',
    registrationOpen: true,
    registrationDeadline: regDeadline,
    gifteeRevealAt: gifteeReveal,
    giftDeadline,
    santaIdentityRevealAt: santaIdentityReveal,
    isMatched: false,
    matchedAt: null,
    participantCount: 0,
    createdBy: 'system',

    // Phase 2 Defaults
    budget: {
      mode: 'fixed',
      currency: '₹',
      minAmount: 1000,
      maxAmount: 1000,
      announcement: 'Thoughtful & festive gifts — handmade touches always welcome!',
    },
    mailboxEnabled: true,
    mailboxOpenAt: new Date(now.getTime() - 1000 * 60 * 60),
    mailboxCloseAt: new Date(santaIdentityReveal.getTime() + 1000 * 60 * 60 * 24 * 7),
    guessingEnabled: true,
    maxGuesses: 3,
    allowDuplicateGuesses: false,
    adventEnabled: true,
    adventStartAt: adventStart,
    adventEndAt: adventEnd,
    adventAllowCatchUp: true,
    wheelEnabled: true,
    elfChallengeEnabled: true,
    quizEnabled: true,
    quizAllowRetake: true,
    deliveryTrackingEnabled: true,
    allowSharedTrackingLink: false,
    thankYouEnabled: true,
    snowGlobeRevealEnabled: true,
    giftPreferencesCutoffAt: gifteeReveal,
  };
}

function mapBudget(raw: unknown, fallback: GiftBudgetConfig): GiftBudgetConfig {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const mode = obj.mode === 'range' ? 'range' : 'fixed';
  const minAmount = Math.max(0, Math.round(Number(obj.minAmount ?? fallback.minAmount) || 0));
  const maxAmount = Math.max(
    minAmount,
    Math.round(Number(obj.maxAmount ?? fallback.maxAmount) || minAmount)
  );
  return {
    mode,
    currency: String(obj.currency || fallback.currency || '₹').slice(0, 8),
    minAmount,
    maxAmount,
    announcement: String(obj.announcement ?? fallback.announcement).slice(0, 240),
  };
}

function mapEventDoc(id: string, data: Record<string, unknown>): SecretSantaEvent {
  const fallback = buildDefaultEventTemplate();
  const gifteeRevealAt = toDateSafe(data.gifteeRevealAt, fallback.gifteeRevealAt);
  const santaIdentityRevealAt = toDateSafe(
    data.santaIdentityRevealAt,
    fallback.santaIdentityRevealAt
  );
  return {
    id,
    name: String(data.name || fallback.name),
    timezone: String(data.timezone || 'Asia/Kolkata'),
    registrationOpen: Boolean(data.registrationOpen),
    registrationDeadline: toDateSafe(data.registrationDeadline, fallback.registrationDeadline),
    gifteeRevealAt,
    giftDeadline: toDateSafe(data.giftDeadline, fallback.giftDeadline),
    santaIdentityRevealAt,
    isMatched: Boolean(data.isMatched),
    matchedAt: data.matchedAt ? toDateSafe(data.matchedAt, new Date()) : null,
    participantCount: Number(data.participantCount || 0),
    createdBy: String(data.createdBy || ''),

    budget: mapBudget(data.budget, fallback.budget),
    mailboxEnabled: data.mailboxEnabled === undefined ? true : Boolean(data.mailboxEnabled),
    mailboxOpenAt: toDateSafe(data.mailboxOpenAt, fallback.mailboxOpenAt),
    mailboxCloseAt: toDateSafe(
      data.mailboxCloseAt,
      new Date(santaIdentityRevealAt.getTime() + 1000 * 60 * 60 * 24 * 7)
    ),
    guessingEnabled: data.guessingEnabled === undefined ? true : Boolean(data.guessingEnabled),
    maxGuesses: Math.max(1, Math.min(10, Math.round(Number(data.maxGuesses ?? 3) || 3))),
    allowDuplicateGuesses: Boolean(data.allowDuplicateGuesses),
    adventEnabled: data.adventEnabled === undefined ? true : Boolean(data.adventEnabled),
    adventStartAt: toDateSafe(data.adventStartAt, fallback.adventStartAt),
    adventEndAt: toDateSafe(data.adventEndAt, fallback.adventEndAt),
    adventAllowCatchUp:
      data.adventAllowCatchUp === undefined ? true : Boolean(data.adventAllowCatchUp),
    wheelEnabled: data.wheelEnabled === undefined ? true : Boolean(data.wheelEnabled),
    elfChallengeEnabled:
      data.elfChallengeEnabled === undefined ? true : Boolean(data.elfChallengeEnabled),
    quizEnabled: data.quizEnabled === undefined ? true : Boolean(data.quizEnabled),
    quizAllowRetake: data.quizAllowRetake === undefined ? true : Boolean(data.quizAllowRetake),
    deliveryTrackingEnabled:
      data.deliveryTrackingEnabled === undefined ? true : Boolean(data.deliveryTrackingEnabled),
    allowSharedTrackingLink: Boolean(data.allowSharedTrackingLink),
    thankYouEnabled: data.thankYouEnabled === undefined ? true : Boolean(data.thankYouEnabled),
    snowGlobeRevealEnabled:
      data.snowGlobeRevealEnabled === undefined ? true : Boolean(data.snowGlobeRevealEnabled),
    giftPreferencesCutoffAt: toDateSafe(data.giftPreferencesCutoffAt, gifteeRevealAt),
  };
}

export async function fetchEvent(eventId = DEFAULT_EVENT_ID): Promise<SecretSantaEvent | null> {
  const path = `events/${eventId}`;
  try {
    const snap = await getDoc(doc(db, 'events', eventId));
    if (!snap.exists()) return null;
    return mapEventDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export function subscribeToEvent(
  eventId: string,
  onChange: (event: SecretSantaEvent | null) => void
) {
  const path = `events/${eventId}`;
  return onSnapshot(
    doc(db, 'events', eventId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(mapEventDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export interface AdminEventConfigInput {
  eventId?: string;
  name: string;
  timezone: string;
  registrationOpen: boolean;
  registrationDeadline: Date;
  gifteeRevealAt: Date;
  giftDeadline: Date;
  santaIdentityRevealAt: Date;
  budget?: GiftBudgetConfig;
  mailboxEnabled?: boolean;
  mailboxOpenAt?: Date;
  mailboxCloseAt?: Date;
  guessingEnabled?: boolean;
  maxGuesses?: number;
  allowDuplicateGuesses?: boolean;
  adventEnabled?: boolean;
  adventStartAt?: Date;
  adventEndAt?: Date;
  adventAllowCatchUp?: boolean;
  wheelEnabled?: boolean;
  elfChallengeEnabled?: boolean;
  quizEnabled?: boolean;
  quizAllowRetake?: boolean;
  deliveryTrackingEnabled?: boolean;
  allowSharedTrackingLink?: boolean;
  thankYouEnabled?: boolean;
  snowGlobeRevealEnabled?: boolean;
  giftPreferencesCutoffAt?: Date;
}

export async function saveAdminEventConfig(
  adminUid: string,
  config: AdminEventConfigInput
): Promise<void> {
  const eventId = config.eventId || DEFAULT_EVENT_ID;
  const path = `events/${eventId}`;
  const defaults = buildDefaultEventTemplate();
  const cleanBudget: GiftBudgetConfig = mapBudget(config.budget, defaults.budget);
  const adventStart = config.adventStartAt || defaults.adventStartAt;
  const adventEnd =
    config.adventEndAt || new Date(adventStart.getTime() + 1000 * 60 * 60 * 24 * 25);
  const mailboxOpen = config.mailboxOpenAt || defaults.mailboxOpenAt;
  const mailboxClose =
    config.mailboxCloseAt ||
    new Date(config.santaIdentityRevealAt.getTime() + 1000 * 60 * 60 * 24 * 7);
  const prefsCutoff = config.giftPreferencesCutoffAt || config.gifteeRevealAt;

  const phase2Payload = {
    budget: cleanBudget,
    mailboxEnabled: config.mailboxEnabled ?? true,
    mailboxOpenAt: Timestamp.fromDate(mailboxOpen),
    mailboxCloseAt: Timestamp.fromDate(mailboxClose),
    guessingEnabled: config.guessingEnabled ?? true,
    maxGuesses: Math.max(1, Math.min(10, Math.round(config.maxGuesses ?? 3))),
    allowDuplicateGuesses: Boolean(config.allowDuplicateGuesses ?? false),
    adventEnabled: config.adventEnabled ?? true,
    adventStartAt: Timestamp.fromDate(adventStart),
    adventEndAt: Timestamp.fromDate(adventEnd),
    adventAllowCatchUp: config.adventAllowCatchUp ?? true,
    wheelEnabled: config.wheelEnabled ?? true,
    elfChallengeEnabled: config.elfChallengeEnabled ?? true,
    quizEnabled: config.quizEnabled ?? true,
    quizAllowRetake: config.quizAllowRetake ?? true,
    deliveryTrackingEnabled: config.deliveryTrackingEnabled ?? true,
    allowSharedTrackingLink: Boolean(config.allowSharedTrackingLink ?? false),
    thankYouEnabled: config.thankYouEnabled ?? true,
    snowGlobeRevealEnabled: config.snowGlobeRevealEnabled ?? true,
    giftPreferencesCutoffAt: Timestamp.fromDate(prefsCutoff),
  };

  try {
    const ref = doc(db, 'events', eventId);
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        name: config.name.trim().slice(0, 120),
        timezone: config.timezone.trim().slice(0, 64),
        registrationOpen: config.registrationOpen,
        registrationDeadline: Timestamp.fromDate(config.registrationDeadline),
        gifteeRevealAt: Timestamp.fromDate(config.gifteeRevealAt),
        giftDeadline: Timestamp.fromDate(config.giftDeadline),
        santaIdentityRevealAt: Timestamp.fromDate(config.santaIdentityRevealAt),
        isMatched: false,
        matchedAt: null,
        participantCount: 0,
        createdBy: adminUid,
        ...phase2Payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: config.name.trim().slice(0, 120),
        timezone: config.timezone.trim().slice(0, 64),
        registrationOpen: config.registrationOpen,
        registrationDeadline: Timestamp.fromDate(config.registrationDeadline),
        gifteeRevealAt: Timestamp.fromDate(config.gifteeRevealAt),
        giftDeadline: Timestamp.fromDate(config.giftDeadline),
        santaIdentityRevealAt: Timestamp.fromDate(config.santaIdentityRevealAt),
        ...phase2Payload,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function generatePersonalInvitation(
  eventId: string,
  label: string,
  expiresInDays = 30
): Promise<{ rawToken: string; tokenHash: string; inviteUrl: string }> {
  const rawToken = generateSecureTokenHex(32); // 256-bit cryptographically secure secret
  const tokenHash = await sha256Hex(rawToken);
  const path = `invitations/${tokenHash}`;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  try {
    await setDoc(doc(db, 'invitations', tokenHash), {
      eventId,
      label: label.trim().slice(0, 100) || 'Secret Santa Guest',
      status: 'pending',
      participantKey: '',
      isRecovery: false,
      recoveryParticipantKey: '',
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      rawToken,
      tokenHash,
      inviteUrl: buildPersonalInviteUrl(window.location.origin, rawToken),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/**
 * Feature 12: Admin-verified one-time 24-hour session recovery link.
 * Restores the participant's exact existing participantKey (preserving profile, dislikes, collectibles, and matches),
 * revokes any older active invitation for that participant, and writes an immutable audit entry.
 */
export async function issueRecoveryInvitation(params: {
  eventId: string;
  targetParticipant: ParticipantProfile;
  actorEmail: string;
  reasonNote: string;
  recoveryRequestId?: string;
}): Promise<{ rawToken: string; tokenHash: string; inviteUrl: string; expiresAt: Date }> {
  const rawToken = generateSecureTokenHex(32);
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours short-lived
  const auditId = `audit_${Date.now()}_${generateSecureTokenHex(4)}`;

  const targetEventId = params.targetParticipant.eventId || params.eventId;

  try {
    const batch = writeBatch(db);

    // Revoke previous invitation hash if present
    if (params.targetParticipant.invitationHash && /^[a-f0-9]{64}$/.test(params.targetParticipant.invitationHash)) {
      const oldInvRef = doc(db, 'invitations', params.targetParticipant.invitationHash);
      const oldInvSnap = await getDoc(oldInvRef);
      if (oldInvSnap.exists() && oldInvSnap.data().status !== 'revoked') {
        batch.update(oldInvRef, {
          status: 'revoked',
          updatedAt: serverTimestamp(),
        });
      }
    }

    batch.set(doc(db, 'invitations', tokenHash), {
      eventId: targetEventId,
      label: `Recovery: ${params.targetParticipant.name}`.slice(0, 100),
      status: 'pending',
      participantKey: '',
      isRecovery: true,
      recoveryParticipantKey: params.targetParticipant.id,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.recoveryRequestId) {
      batch.update(doc(db, 'recoveryRequests', params.recoveryRequestId), {
        status: 'resolved',
        resolvedBy: params.actorEmail.slice(0, 160),
      });
    }

    batch.set(doc(db, 'recoveryAuditLogs', auditId), {
      eventId: targetEventId,
      action: 'recovery_issued',
      actorEmail: params.actorEmail.slice(0, 160),
      targetLabel: params.targetParticipant.name.slice(0, 120),
      note: (params.reasonNote.trim() || 'Admin verified out-of-band and issued 24h recovery link.').slice(
        0,
        300
      ),
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return {
      rawToken,
      tokenHash,
      inviteUrl: buildPersonalInviteUrl(window.location.origin, rawToken),
      expiresAt,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `invitations/${tokenHash}`);
  }
}

export async function listInvitations(eventId = DEFAULT_EVENT_ID): Promise<InvitationRecord[]> {
  const path = 'invitations';
  try {
    const q = query(collection(db, 'invitations'), where('eventId', '==', eventId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          tokenHash: d.id,
          eventId: String(data.eventId),
          label: String(data.label || 'Guest'),
          status: (data.status as InvitationRecord['status']) || 'pending',
          participantKey: String(data.participantKey || ''),
          expiresAt: toDateSafe(data.expiresAt, new Date()),
          createdAt: toDateSafe(data.createdAt, new Date()),
          claimedAt: data.claimedAt ? toDateSafe(data.claimedAt, new Date()) : null,
          isRecovery: Boolean(data.isRecovery),
          recoveryParticipantKey: String(data.recoveryParticipantKey || ''),
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function revokeInvitation(
  tokenHash: string,
  auditContext?: { eventId: string; actorEmail: string; label: string }
): Promise<void> {
  const path = `invitations/${tokenHash}`;
  try {
    await updateDoc(doc(db, 'invitations', tokenHash), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
    if (auditContext) {
      const auditId = `audit_${Date.now()}_${generateSecureTokenHex(4)}`;
      await setDoc(doc(db, 'recoveryAuditLogs', auditId), {
        eventId: auditContext.eventId,
        action: 'invite_revoked',
        actorEmail: auditContext.actorEmail.slice(0, 160),
        targetLabel: auditContext.label.slice(0, 120),
        note: 'Organizer revoked invitation link.',
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function validateAndClaimInvitation(rawToken: string): Promise<{
  ok: boolean;
  reason?: string;
  eventId?: string;
  tokenHash?: string;
  participantKey?: string;
  label?: string;
  isRecovery?: boolean;
}> {
  const trimmed = rawToken.trim();
  if (!/^[a-f0-9]{64}$/i.test(trimmed)) {
    return { ok: false, reason: 'This invitation link looks invalid or incomplete.' };
  }
  const tokenHash = await sha256Hex(trimmed.toLowerCase());
  const path = `invitations/${tokenHash}`;
  try {
    const ref = doc(db, 'invitations', tokenHash);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return {
        ok: false,
        reason: 'Invitation not found. Please ask the organizer for a fresh link.',
      };
    }
    const data = snap.data();
    if (data.status === 'revoked') {
      return { ok: false, reason: 'This invitation link was revoked by the organizer.' };
    }
    const expiresAt = toDateSafe(data.expiresAt, new Date(0));
    if (expiresAt.getTime() <= Date.now()) {
      return { ok: false, reason: 'This invitation link has expired.' };
    }
    if (data.status === 'claimed') {
      return {
        ok: false,
        reason:
          'This one-time invitation has already been claimed on another browser. Use "Lost your invitation?" to request a recovery link.',
      };
    }

    const isRecovery = Boolean(data.isRecovery && data.recoveryParticipantKey);
    // For recovery invitations, restore the exact existing participantKey so zero profile/match/collectible data is lost!
    const participantKey = isRecovery
      ? String(data.recoveryParticipantKey)
      : await sha256Hex(generateSecureTokenHex(32));

    await updateDoc(ref, {
      status: 'claimed',
      participantKey,
      claimedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      ok: true,
      eventId: String(data.eventId),
      tokenHash,
      participantKey,
      label: String(data.label || ''),
      isRecovery,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveParticipantProfile(
  participantKey: string,
  payload: {
    eventId: string;
    invitationHash: string;
    name: string;
    address: ParticipantAddress;
    hobbies: string[];
    avatarId: string;
    genderPreference: GenderCategory;
    selectedTheme: ThemeId;
    hasJoined: boolean;
  }
): Promise<void> {
  const path = `participants/${participantKey}`;
  try {
    const ref = doc(db, 'participants', participantKey);
    const snap = await getDoc(ref);
    const sanitizedAddress: ParticipantAddress = {
      line1: payload.address.line1.trim().slice(0, 200),
      line2: payload.address.line2.trim().slice(0, 200),
      landmark: payload.address.landmark.trim().slice(0, 120),
      city: payload.address.city.trim().slice(0, 80),
      state: payload.address.state.trim().slice(0, 80),
      postalCode: payload.address.postalCode.trim().slice(0, 12),
      phone: payload.address.phone.trim().slice(0, 20),
    };
    const sanitizedHobbies = payload.hobbies
      .map((h) => h.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 5);

    if (!snap.exists()) {
      await setDoc(ref, {
        eventId: payload.eventId,
        invitationHash: payload.invitationHash,
        name: payload.name.trim().slice(0, 100),
        address: sanitizedAddress,
        hobbies: sanitizedHobbies,
        avatarId: payload.avatarId,
        genderPreference: payload.genderPreference,
        selectedTheme: payload.selectedTheme,
        hasJoined: payload.hasJoined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: payload.name.trim().slice(0, 100),
        address: sanitizedAddress,
        hobbies: sanitizedHobbies,
        avatarId: payload.avatarId,
        genderPreference: payload.genderPreference,
        selectedTheme: payload.selectedTheme,
        hasJoined: payload.hasJoined,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchParticipantProfile(
  participantKey: string
): Promise<ParticipantProfile | null> {
  const path = `participants/${participantKey}`;
  try {
    const snap = await getDoc(doc(db, 'participants', participantKey));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      eventId: String(d.eventId),
      invitationHash: String(d.invitationHash || ''),
      name: String(d.name || ''),
      address: {
        line1: String(d.address?.line1 || ''),
        line2: String(d.address?.line2 || ''),
        landmark: String(d.address?.landmark || ''),
        city: String(d.address?.city || ''),
        state: String(d.address?.state || ''),
        postalCode: String(d.address?.postalCode || ''),
        phone: String(d.address?.phone || ''),
      },
      hobbies: Array.isArray(d.hobbies) ? d.hobbies.map(String) : [],
      avatarId: String(d.avatarId || 'santa-hat-girl'),
      genderPreference: (d.genderPreference as GenderCategory) || 'all',
      selectedTheme: (d.selectedTheme as ThemeId) || 'santa',
      hasJoined: Boolean(d.hasJoined),
      hasGoldenDetectiveCrown: Boolean(d.hasGoldenDetectiveCrown),
      createdAt: d.createdAt ? toDateSafe(d.createdAt, new Date()) : null,
      updatedAt: d.updatedAt ? toDateSafe(d.updatedAt, new Date()) : null,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Permanently equips the rare Golden Detective Crown cosmetic for this participant
 * in the current event after unlocking The 1% Santa Secret.
 */
export async function claimGoldenDetectiveCrown(participantKey: string): Promise<void> {
  const path = `participants/${participantKey}`;
  try {
    await updateDoc(doc(db, 'participants', participantKey), {
      hasGoldenDetectiveCrown: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function listParticipants(eventId = DEFAULT_EVENT_ID): Promise<ParticipantProfile[]> {
  const path = 'participants';
  try {
    const q = query(collection(db, 'participants'), where('eventId', '==', eventId));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        eventId: String(d.eventId),
        invitationHash: String(d.invitationHash || ''),
        name: String(d.name || ''),
        address: {
          line1: String(d.address?.line1 || ''),
          line2: String(d.address?.line2 || ''),
          landmark: String(d.address?.landmark || ''),
          city: String(d.address?.city || ''),
          state: String(d.address?.state || ''),
          postalCode: String(d.address?.postalCode || ''),
          phone: String(d.address?.phone || ''),
        },
        hobbies: Array.isArray(d.hobbies) ? d.hobbies.map(String) : [],
        avatarId: String(d.avatarId || 'santa-hat-girl'),
        genderPreference: (d.genderPreference as GenderCategory) || 'all',
        selectedTheme: (d.selectedTheme as ThemeId) || 'santa',
        hasJoined: Boolean(d.hasJoined),
        hasGoldenDetectiveCrown: Boolean(d.hasGoldenDetectiveCrown),
        createdAt: d.createdAt ? toDateSafe(d.createdAt, new Date()) : null,
        updatedAt: d.updatedAt ? toDateSafe(d.updatedAt, new Date()) : null,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function removeParticipant(participantKey: string): Promise<void> {
  const path = `participants/${participantKey}`;
  try {
    await deleteDoc(doc(db, 'participants', participantKey));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function seedFestiveParticipants(eventId = DEFAULT_EVENT_ID): Promise<number> {
  const sampleGuests = [
    {
      name: 'Meera Sharma',
      avatarId: 'holly-princess',
      genderPreference: 'female' as GenderCategory,
      hobbies: ['Reading', 'Coffee', 'Chocolate', 'Baking'],
      address: {
        line1: 'Flat 804, Emerald Heights, Sector 62',
        line2: 'Golf Course Extension Road',
        landmark: 'Near WorldMark Mall',
        city: 'Gurugram',
        state: 'Haryana',
        postalCode: '122011',
        phone: '+91 98112 34091',
      },
    },
    {
      name: 'Aarav Verma',
      avatarId: 'holiday-nerd-boy',
      genderPreference: 'male' as GenderCategory,
      hobbies: ['Gaming', 'Technology', 'Anime', 'Coffee'],
      address: {
        line1: '21B, Indiranagar 12th Main',
        line2: 'HAL 2nd Stage',
        landmark: 'Opposite Third Wave Coffee',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        phone: '+91 98450 21839',
      },
    },
    {
      name: 'Ananya Kapoor',
      avatarId: 'earmuffs-bookworm',
      genderPreference: 'female' as GenderCategory,
      hobbies: ['Skincare', 'Plants', 'Photography', 'K-Dramas'],
      address: {
        line1: 'C-502, Hiranandani Meadows',
        line2: 'Powai Lake Road',
        landmark: 'Near Galleria Plaza',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400076',
        phone: '+91 98201 77412',
      },
    },
    {
      name: 'Kabir Malhotra',
      avatarId: 'green-beanie-boy',
      genderPreference: 'male' as GenderCategory,
      hobbies: ['Travelling', 'Fitness', 'Music', 'Cooking'],
      address: {
        line1: 'House 42, Greater Kailash Part 2',
        line2: 'M-Block Enclave',
        landmark: 'Near M-Block Market',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110048',
        phone: '+91 98109 65218',
      },
    },
    {
      name: 'Riya Nair',
      avatarId: 'reindeer-hoodie-girl',
      genderPreference: 'female' as GenderCategory,
      hobbies: ['Art', 'Pets', 'Chocolate', 'Movies'],
      address: {
        line1: 'Apt 301, Palm Breeze Residency',
        line2: 'Koregaon Park Lane 7',
        landmark: 'Behind German Bakery',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        phone: '+91 97654 88103',
      },
    },
  ];

  const batch = writeBatch(db);
  for (const guest of sampleGuests) {
    const key = await sha256Hex(generateSecureTokenHex(32));
    batch.set(doc(db, 'participants', key), {
      eventId,
      invitationHash: '',
      name: guest.name,
      address: guest.address,
      hobbies: guest.hobbies,
      avatarId: guest.avatarId,
      genderPreference: guest.genderPreference,
      selectedTheme: 'santa',
      hasJoined: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
    return sampleGuests.length;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'participants');
  }
}

/**
 * Executes unbiased cryptographic derangement matching across all joined participants.
 * Strictly separates:
 * - /matches/{giverKey} (unlocked at gifteeRevealAt) with outgoingAssignmentId + recipientDislikes
 * - /incomingAssignments/{recipientKey} (opaque handle with ZERO sender identity)
 * - /santaReveals/{recipientKey} (unlocked at santaIdentityRevealAt) with santaPublicId
 * - /eventRosters/{eventId} (non-PII list of publicId, name, avatarId for Guess Your Santa)
 */
export async function runCryptographicMatching(
  eventId = DEFAULT_EVENT_ID
): Promise<{ matchedCount: number }> {
  const participants = (await listParticipants(eventId)).filter((p) => p.hasJoined);
  if (participants.length < 2) {
    throw new Error(
      `Need at least 2 joined participants to run Secret Santa matching (currently ${participants.length}).`
    );
  }

  const event = await fetchEvent(eventId);
  if (!event) {
    throw new Error('Event configuration not found. Initialize the event first.');
  }
  if (event.isMatched) {
    throw new Error(
      'This event is already matched! Use "Reset Matches" first if you are testing.'
    );
  }

  // Gather shareable gift dislikes for all participants (admin-readable)
  const dislikesByKey = new Map<string, GiftDislikesShareable | null>();
  await Promise.all(
    participants.map(async (p) => {
      try {
        const snap = await getDoc(doc(db, 'giftPreferences', p.id));
        if (snap.exists()) {
          const d = snap.data();
          dislikesByKey.set(
            p.id,
            extractShareableDislikes({
              dislikedCategories: Array.isArray(d.dislikedCategories)
                ? d.dislikedCategories.map(String)
                : [],
              dietaryRestrictions: Array.isArray(d.dietaryRestrictions)
                ? d.dietaryRestrictions.map(String)
                : [],
              dislikedColors: Array.isArray(d.dislikedColors) ? d.dislikedColors.map(String) : [],
              alreadyOwned: Array.isArray(d.alreadyOwned) ? d.alreadyOwned.map(String) : [],
              nonFoodNotes: String(d.nonFoodNotes || ''),
              generalNotes: String(d.generalNotes || ''),
              shareWithSanta: Boolean(d.shareWithSanta),
              shareDietaryWithSanta: Boolean(d.shareDietaryWithSanta),
            })
          );
        } else {
          dislikesByKey.set(p.id, null);
        }
      } catch {
        dislikesByKey.set(p.id, null);
      }
    })
  );

  // Derive deterministic public IDs (no secret key leakage) for Guess Your Santa roster
  const publicIds = new Map<string, string>();
  const rosterEntries: PublicRosterEntry[] = [];
  for (const p of participants) {
    const pubId = await sha256Hex(`pub:${p.id}`);
    publicIds.set(p.id, pubId);
    rosterEntries.push({
      publicId: pubId,
      name: p.name,
      avatarId: p.avatarId,
    });
  }

  const recipients = generateUnbiasedDerangement(participants);
  const assignmentIds = await Promise.all(
    participants.map(() => sha256Hex(generateSecureTokenHex(32)))
  );

  const batch = writeBatch(db);

  participants.forEach((giver, index) => {
    const recipient = recipients[index];
    const assignmentId = assignmentIds[index];
    const giverPublicId = publicIds.get(giver.id) || '';

    // 1. Giver's time-locked Giftee reveal (unlocks at gifteeRevealAt)
    batch.set(doc(db, 'matches', giver.id), {
      eventId,
      giverKey: giver.id,
      outgoingAssignmentId: assignmentId,
      recipientName: recipient.name,
      recipientAvatarId: recipient.avatarId,
      recipientHobbies: recipient.hobbies,
      recipientAddress: recipient.address,
      recipientDislikes: dislikesByKey.get(recipient.id) ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Recipient's strictly anonymous incoming assignment handle (ZERO sender identity!)
    batch.set(doc(db, 'incomingAssignments', recipient.id), {
      eventId,
      recipientKey: recipient.id,
      incomingAssignmentId: assignmentId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 3. Recipient's time-locked Secret Santa identity reveal (unlocks ONLY at santaIdentityRevealAt)
    batch.set(doc(db, 'santaReveals', recipient.id), {
      eventId,
      recipientKey: recipient.id,
      santaPublicId: giverPublicId,
      santaName: giver.name,
      santaAvatarId: giver.avatarId,
      santaHobbies: giver.hobbies,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // 4. Non-PII public roster for Guess Your Santa
  batch.set(doc(db, 'eventRosters', eventId), {
    eventId,
    entries: rosterEntries,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'events', eventId), {
    isMatched: true,
    matchedAt: serverTimestamp(),
    participantCount: participants.length,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return { matchedCount: participants.length };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `matches/${eventId}`);
  }
}

export async function resetMatchesForTesting(eventId = DEFAULT_EVENT_ID): Promise<void> {
  try {
    const [
      matchesSnap,
      revealsSnap,
      incomingSnap,
      sharedDislikesSnap,
      deliveryProgressSnap,
      deliveryAcksSnap,
    ] = await Promise.all([
      getDocs(query(collection(db, 'matches'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'santaReveals'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'incomingAssignments'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'sharedDislikes'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'deliveryProgress'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'deliveryAcknowledgments'), where('eventId', '==', eventId))),
    ]);
    const refsToDelete = [
      ...matchesSnap.docs.map((d) => d.ref),
      ...revealsSnap.docs.map((d) => d.ref),
      ...incomingSnap.docs.map((d) => d.ref),
      ...sharedDislikesSnap.docs.map((d) => d.ref),
      ...deliveryProgressSnap.docs.map((d) => d.ref),
      ...deliveryAcksSnap.docs.map((d) => d.ref),
    ];
    const CHUNK_SIZE = 420;
    for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      refsToDelete.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    const finalBatch = writeBatch(db);
    finalBatch.delete(doc(db, 'eventRosters', eventId));
    finalBatch.update(doc(db, 'events', eventId), {
      isMatched: false,
      matchedAt: null,
      updatedAt: serverTimestamp(),
    });
    await finalBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `matches/${eventId}`);
  }
}

export async function clearAllParticipantsAndMatches(
  eventId = DEFAULT_EVENT_ID
): Promise<{ deletedParticipants: number; deletedMatches: number; deletedReveals: number }> {
  try {
    const [
      participantsSnap,
      matchesSnap,
      revealsSnap,
      incomingSnap,
      sharedDislikesSnap,
      deliveryProgressSnap,
      deliveryAcksSnap,
      eventSnap,
    ] = await Promise.all([
      getDocs(query(collection(db, 'participants'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'matches'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'santaReveals'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'incomingAssignments'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'sharedDislikes'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'deliveryProgress'), where('eventId', '==', eventId))),
      getDocs(query(collection(db, 'deliveryAcknowledgments'), where('eventId', '==', eventId))),
      getDoc(doc(db, 'events', eventId)),
    ]);

    const refsToDelete = [
      ...participantsSnap.docs.map((d) => d.ref),
      ...matchesSnap.docs.map((d) => d.ref),
      ...revealsSnap.docs.map((d) => d.ref),
      ...incomingSnap.docs.map((d) => d.ref),
      ...sharedDislikesSnap.docs.map((d) => d.ref),
      ...deliveryProgressSnap.docs.map((d) => d.ref),
      ...deliveryAcksSnap.docs.map((d) => d.ref),
    ];

    const CHUNK_SIZE = 420;
    for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      refsToDelete.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    try {
      await deleteDoc(doc(db, 'eventRosters', eventId));
    } catch {
      // ignore if roster does not exist
    }

    if (eventSnap.exists()) {
      await updateDoc(doc(db, 'events', eventId), {
        isMatched: false,
        matchedAt: null,
        participantCount: 0,
        registrationOpen: true,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      deletedParticipants: participantsSnap.size,
      deletedMatches: matchesSnap.size,
      deletedReveals: revealsSnap.size,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `participants/${eventId}`);
  }
}

export async function fetchMyGifteeMatch(
  participantKey: string
): Promise<{ locked: boolean; match: MatchAssignment | null; notInMatch?: boolean }> {
  try {
    const snap = await getDoc(doc(db, 'matches', participantKey));
    if (!snap.exists()) return { locked: false, match: null, notInMatch: true };
    const d = snap.data();
    const outgoingAssignmentId = String(d.outgoingAssignmentId || '');
    const rawDislikes = d.recipientDislikes as Record<string, unknown> | null | undefined;
    let recipientDislikes: GiftDislikesShareable | null = rawDislikes
      ? {
          dislikedCategories: Array.isArray(rawDislikes.dislikedCategories)
            ? rawDislikes.dislikedCategories.map(String)
            : [],
          dietaryRestrictions: Array.isArray(rawDislikes.dietaryRestrictions)
            ? rawDislikes.dietaryRestrictions.map(String)
            : [],
          dislikedColors: Array.isArray(rawDislikes.dislikedColors)
            ? rawDislikes.dislikedColors.map(String)
            : [],
          alreadyOwned: Array.isArray(rawDislikes.alreadyOwned)
            ? rawDislikes.alreadyOwned.map(String)
            : [],
          nonFoodNotes: String(rawDislikes.nonFoodNotes || ''),
          generalNotes: String(rawDislikes.generalNotes || ''),
        }
      : null;

    // Prefer post-match pre-cutoff updates mirrored anonymously to sharedDislikes/{outgoingAssignmentId}
    if (/^[a-f0-9]{64}$/.test(outgoingAssignmentId)) {
      try {
        const sharedSnap = await getDoc(doc(db, 'sharedDislikes', outgoingAssignmentId));
        if (sharedSnap.exists()) {
          const sd = sharedSnap.data();
          if (sd.isShared === false) {
            recipientDislikes = null;
          } else {
            recipientDislikes = {
              dislikedCategories: Array.isArray(sd.dislikedCategories)
                ? sd.dislikedCategories.map(String)
                : [],
              dietaryRestrictions: Array.isArray(sd.dietaryRestrictions)
                ? sd.dietaryRestrictions.map(String)
                : [],
              dislikedColors: Array.isArray(sd.dislikedColors)
                ? sd.dislikedColors.map(String)
                : [],
              alreadyOwned: Array.isArray(sd.alreadyOwned)
                ? sd.alreadyOwned.map(String)
                : [],
              nonFoodNotes: String(sd.nonFoodNotes || ''),
              generalNotes: String(sd.generalNotes || ''),
            };
          }
        }
      } catch {
        // Gracefully fall back to the match snapshot if sharedDislikes is unavailable
      }
    }

    return {
      locked: false,
      match: {
        eventId: String(d.eventId),
        giverKey: String(d.giverKey),
        outgoingAssignmentId,
        recipientName: String(d.recipientName),
        recipientAvatarId: String(d.recipientAvatarId),
        recipientHobbies: Array.isArray(d.recipientHobbies) ? d.recipientHobbies.map(String) : [],
        recipientAddress: {
          line1: String(d.recipientAddress?.line1 || ''),
          line2: String(d.recipientAddress?.line2 || ''),
          landmark: String(d.recipientAddress?.landmark || ''),
          city: String(d.recipientAddress?.city || ''),
          state: String(d.recipientAddress?.state || ''),
          postalCode: String(d.recipientAddress?.postalCode || ''),
          phone: String(d.recipientAddress?.phone || ''),
        },
        recipientDislikes,
      },
    };
  } catch (err) {
    // Permission error happens either when gifteeRevealAt > server request.time OR when matches/{participantKey} does not exist
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('permission')) {
      try {
        const incomingSnap = await getDoc(doc(db, 'incomingAssignments', participantKey));
        if (!incomingSnap.exists()) {
          return { locked: false, match: null, notInMatch: true };
        }
      } catch {
        // fall through to locked: true so caller can retry
      }
      return { locked: true, match: null };
    }
    handleFirestoreError(err, OperationType.GET, `matches/${participantKey}`);
  }
}

export async function fetchMySecretSantaIdentity(
  participantKey: string
): Promise<{ locked: boolean; reveal: SantaIdentityReveal | null; notInMatch?: boolean }> {
  try {
    const snap = await getDoc(doc(db, 'santaReveals', participantKey));
    if (!snap.exists()) return { locked: false, reveal: null, notInMatch: true };
    const d = snap.data();
    return {
      locked: false,
      reveal: {
        eventId: String(d.eventId),
        recipientKey: String(d.recipientKey),
        santaPublicId: d.santaPublicId ? String(d.santaPublicId) : undefined,
        santaName: String(d.santaName),
        santaAvatarId: String(d.santaAvatarId),
        santaHobbies: Array.isArray(d.santaHobbies) ? d.santaHobbies.map(String) : [],
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('permission')) {
      try {
        const incomingSnap = await getDoc(doc(db, 'incomingAssignments', participantKey));
        if (!incomingSnap.exists()) {
          return { locked: false, reveal: null, notInMatch: true };
        }
      } catch {
        // fall through to locked: true
      }
      return { locked: true, reveal: null };
    }
    handleFirestoreError(err, OperationType.GET, `santaReveals/${participantKey}`);
  }
}

// ---------- Admin Recovery, Delivery Problems & Audit Logs ----------

function mapRecoveryRequestDoc(
  id: string,
  data: Record<string, unknown>
): SessionRecoveryRequestRecord {
  return {
    id,
    eventId: String(data.eventId || DEFAULT_EVENT_ID),
    requestedName: String(data.requestedName || ''),
    verificationHint: String(data.verificationHint || ''),
    status: (data.status as SessionRecoveryRequestRecord['status']) || 'pending',
    resolvedBy: data.resolvedBy ? String(data.resolvedBy) : undefined,
    createdAt: toDateSafe(data.createdAt, new Date()),
  };
}

export async function listRecoveryRequests(
  eventId: string | 'ALL' = DEFAULT_EVENT_ID
): Promise<SessionRecoveryRequestRecord[]> {
  try {
    const q =
      eventId === 'ALL'
        ? query(collection(db, 'recoveryRequests'))
        : query(collection(db, 'recoveryRequests'), where('eventId', '==', eventId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapRecoveryRequestDoc(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'recoveryRequests');
  }
}

export function subscribeToRecoveryRequests(
  eventId: string | 'ALL',
  onUpdate: (items: SessionRecoveryRequestRecord[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const q =
    eventId === 'ALL'
      ? query(collection(db, 'recoveryRequests'))
      : query(collection(db, 'recoveryRequests'), where('eventId', '==', eventId));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapRecoveryRequestDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onUpdate(items);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function dismissRecoveryRequest(
  requestId: string,
  eventId: string,
  actorEmail: string,
  requestedName: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'recoveryRequests', requestId), {
      status: 'dismissed',
      resolvedBy: actorEmail.slice(0, 160),
    });
    const auditId = `audit_${Date.now()}_${generateSecureTokenHex(4)}`;
    batch.set(doc(db, 'recoveryAuditLogs', auditId), {
      eventId,
      action: 'request_dismissed',
      actorEmail: actorEmail.slice(0, 160),
      targetLabel: requestedName.slice(0, 120),
      note: 'Admin dismissed recovery request.',
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `recoveryRequests/${requestId}`);
  }
}

export async function deleteRecoveryRequest(requestId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'recoveryRequests', requestId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `recoveryRequests/${requestId}`);
  }
}

export async function listDeliveryAcknowledgmentsAdmin(
  eventId = DEFAULT_EVENT_ID
): Promise<DeliveryAcknowledgmentRecord[]> {
  try {
    const q = query(collection(db, 'deliveryAcknowledgments'), where('eventId', '==', eventId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          assignmentId: d.id,
          eventId: String(data.eventId),
          status: (data.status as DeliveryAckStatus) || 'pending',
          acknowledgedAt: data.acknowledgedAt ? toDateSafe(data.acknowledgedAt, new Date()) : null,
          problemSummary: String(data.problemSummary || ''),
          adminCorrectionNote: String(data.adminCorrectionNote || ''),
          correctedBy: String(data.correctedBy || ''),
          updatedAt: toDateSafe(data.updatedAt, new Date()),
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'deliveryAcknowledgments');
  }
}

export async function adminCorrectDeliveryAcknowledgment(params: {
  assignmentId: string;
  eventId: string;
  newStatus: DeliveryAckStatus;
  correctionNote: string;
  actorEmail: string;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'deliveryAcknowledgments', params.assignmentId), {
      status: params.newStatus,
      acknowledgedAt: params.newStatus === 'received' ? serverTimestamp() : null,
      adminCorrectionNote: params.correctionNote.trim().slice(0, 300),
      correctedBy: params.actorEmail.slice(0, 160),
      updatedAt: serverTimestamp(),
    });
    const auditId = `audit_${Date.now()}_${generateSecureTokenHex(4)}`;
    batch.set(doc(db, 'recoveryAuditLogs', auditId), {
      eventId: params.eventId,
      action: 'ack_corrected',
      actorEmail: params.actorEmail.slice(0, 160),
      targetLabel: `Assignment ${params.assignmentId.slice(0, 10)}…`,
      note: `Status corrected to "${params.newStatus}": ${params.correctionNote.trim()}`.slice(
        0,
        300
      ),
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `deliveryAcknowledgments/${params.assignmentId}`
    );
  }
}

export async function listRecoveryAuditLogs(
  eventId = DEFAULT_EVENT_ID
): Promise<RecoveryAuditLogRecord[]> {
  try {
    const q = query(collection(db, 'recoveryAuditLogs'), where('eventId', '==', eventId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          eventId: String(data.eventId),
          action: (data.action as RecoveryAuditLogRecord['action']) || 'recovery_issued',
          actorEmail: String(data.actorEmail || ''),
          targetLabel: String(data.targetLabel || ''),
          note: String(data.note || ''),
          createdAt: toDateSafe(data.createdAt, new Date()),
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'recoveryAuditLogs');
  }
}

export async function checkIsAuthorizedAdmin(
  uid: string,
  email: string | null | undefined,
  emailVerified: boolean
): Promise<boolean> {
  if (!emailVerified || !email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }

  try {
    const emailHash = await sha256Hex(normalized);
    const [byUid, byEmailHash] = await Promise.all([
      getDoc(doc(db, 'admins', uid)),
      getDoc(doc(db, 'admins', emailHash)),
    ]);
    return byUid.exists() || byEmailHash.exists();
  } catch {
    return false;
  }
}

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  const path = 'admins';
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: String(data.email || ''),
          displayName: String(data.displayName || ''),
          createdAt: toDateSafe(data.createdAt, new Date()),
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function addCoAdminAccount(
  email: string,
  displayName: string
): Promise<AdminAccount> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 160) {
    throw new Error('Please enter a valid Google email address.');
  }
  if (normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('This email is already the primary organizer.');
  }

  const emailHash = await sha256Hex(normalizedEmail);
  const path = `admins/${emailHash}`;
  const cleanName = displayName.trim().slice(0, 100);
  try {
    await setDoc(doc(db, 'admins', emailHash), {
      email: normalizedEmail,
      displayName: cleanName,
      createdAt: serverTimestamp(),
    });
    return {
      id: emailHash,
      email: normalizedEmail,
      displayName: cleanName,
      createdAt: new Date(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function removeCoAdminAccount(adminId: string): Promise<void> {
  const path = `admins/${adminId}`;
  try {
    await deleteDoc(doc(db, 'admins', adminId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
