import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
  ALL_GROUP_PERMISSIONS,
  AuditActionType,
  BreakGlassAssignmentRow,
  GiftExchangeMode,
  GroupAnnouncement,
  GroupCurrency,
  GroupGamesConfig,
  GroupJoinRequest,
  GroupLifecycleStatus,
  GroupManagementGrant,
  GroupMembership,
  GroupPermission,
  GroupVisibility,
  PairingExclusion,
  ParticipantGroupSummary,
  PlatformAuditLog,
  PlatformConfig,
  PlatformRole,
  PlatformUser,
  SantaGroup,
} from '../types/rbac';
import {
  GiftBudgetConfig,
  GiftDislikesShareable,
  InvitationRecord,
  ParticipantProfile,
  PublicRosterEntry,
  ThemeId,
} from '../types/secretSanta';
import {
  buildGroupInviteUrl,
  buildPersonalInviteUrl,
  canModifyAdminAccount,
  canTransitionGroupLifecycle,
  currencySymbolFromCode,
  evaluateParticipantLeavePolicy,
  generateConstrainedDerangement,
  slugifyGroupName,
} from '../utils/rbacLogic';
import { generateSecureTokenHex, sha256Hex } from '../utils/crypto';
import { extractShareableDislikes } from '../utils/workshopLogic';
import {
  buildDefaultEventTemplate,
  checkIsAuthorizedAdmin,
  fetchParticipantProfile,
} from './secretSantaService';

const PARTICIPANT_GROUPS_STORAGE_KEY = 'ss_participant_groups_v2';

function toDateSafe(val: unknown, fallback: Date): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

export function buildDefaultPlatformConfig(): PlatformConfig {
  return {
    id: 'global',
    maxGroupsPerOrganiser: 10,
    defaultMaxParticipants: 40,
    permittedBudgetMin: 100,
    permittedBudgetMax: 50000,
    defaultTimezone: 'Asia/Kolkata',
    defaultCurrency: 'INR',
    allowDiscoverableGroups: true,
    globalGamesEnabled: {
      mailbox: true,
      guessing: true,
      advent: true,
      wheel: true,
      elfChallenge: true,
      quiz: true,
      gingerbreadShowdown: true,
      deliveryTracking: true,
      thankYou: true,
      snowGlobe: true,
    },
    updatedBy: BOOTSTRAPPED_ADMIN_EMAIL,
    updatedAt: new Date(),
  };
}

export function buildDefaultGamesConfig(): GroupGamesConfig {
  return {
    mailboxEnabled: true,
    guessingEnabled: true,
    maxGuesses: 3,
    adventEnabled: true,
    wheelEnabled: true,
    elfChallengeEnabled: true,
    quizEnabled: true,
    gingerbreadShowdownEnabled: true,
    gingerbreadSubmissionDeadline: null,
    gingerbreadVotingDeadline: null,
    santaStarsReward: 100,
    deliveryTrackingEnabled: true,
    thankYouEnabled: true,
    snowGlobeRevealEnabled: true,
  };
}

function mapPlatformUser(id: string, d: Record<string, unknown>): PlatformUser {
  return {
    id,
    email: String(d.email || ''),
    displayName: String(d.displayName || 'Secret Santa Member'),
    photoURL: d.photoURL ? String(d.photoURL) : '',
    role: (d.role as PlatformRole) || 'PARTICIPANT',
    status: d.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
    createdAt: toDateSafe(d.createdAt, new Date()),
    updatedAt: toDateSafe(d.updatedAt, new Date()),
  };
}

function mapGamesConfig(raw: unknown): GroupGamesConfig {
  const defaults = buildDefaultGamesConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  const g = raw as Record<string, unknown>;
  return {
    mailboxEnabled: g.mailboxEnabled === undefined ? defaults.mailboxEnabled : Boolean(g.mailboxEnabled),
    guessingEnabled: g.guessingEnabled === undefined ? defaults.guessingEnabled : Boolean(g.guessingEnabled),
    maxGuesses: Math.max(1, Math.min(10, Math.round(Number(g.maxGuesses ?? defaults.maxGuesses) || 3))),
    adventEnabled: g.adventEnabled === undefined ? defaults.adventEnabled : Boolean(g.adventEnabled),
    wheelEnabled: g.wheelEnabled === undefined ? defaults.wheelEnabled : Boolean(g.wheelEnabled),
    elfChallengeEnabled:
      g.elfChallengeEnabled === undefined ? defaults.elfChallengeEnabled : Boolean(g.elfChallengeEnabled),
    quizEnabled: g.quizEnabled === undefined ? defaults.quizEnabled : Boolean(g.quizEnabled),
    gingerbreadShowdownEnabled:
      g.gingerbreadShowdownEnabled === undefined
        ? defaults.gingerbreadShowdownEnabled
        : Boolean(g.gingerbreadShowdownEnabled),
    gingerbreadSubmissionDeadline: g.gingerbreadSubmissionDeadline
      ? toDateSafe(g.gingerbreadSubmissionDeadline, new Date())
      : null,
    gingerbreadVotingDeadline: g.gingerbreadVotingDeadline
      ? toDateSafe(g.gingerbreadVotingDeadline, new Date())
      : null,
    santaStarsReward: Math.max(0, Math.min(1000, Math.round(Number(g.santaStarsReward ?? 100) || 100))),
    deliveryTrackingEnabled:
      g.deliveryTrackingEnabled === undefined
        ? defaults.deliveryTrackingEnabled
        : Boolean(g.deliveryTrackingEnabled),
    thankYouEnabled: g.thankYouEnabled === undefined ? defaults.thankYouEnabled : Boolean(g.thankYouEnabled),
    snowGlobeRevealEnabled:
      g.snowGlobeRevealEnabled === undefined
        ? defaults.snowGlobeRevealEnabled
        : Boolean(g.snowGlobeRevealEnabled),
  };
}

function mapSantaGroup(id: string, d: Record<string, unknown>): SantaGroup {
  const fallbackEvent = buildDefaultEventTemplate();
  const rawBudget = (d.budget || {}) as Record<string, unknown>;
  const currencyCode = (rawBudget.currencyCode as GroupCurrency) || 'INR';
  const minAmount = Math.max(0, Math.round(Number(rawBudget.minAmount ?? 1000) || 0));
  const maxAmount = Math.max(minAmount, Math.round(Number(rawBudget.maxAmount ?? minAmount) || minAmount));

  return {
    id,
    slug: String(d.slug || slugifyGroupName(String(d.name || id))),
    name: String(d.name || 'Secret Santa Group'),
    description: String(d.description || ''),
    theme: (d.theme === 'chocolate' || d.theme === 'funny' ? d.theme : 'santa') as ThemeId,
    visibility: d.visibility === 'discoverable' ? 'discoverable' : 'private',
    maxParticipants: Math.max(2, Math.min(500, Math.round(Number(d.maxParticipants ?? 40) || 40))),
    budget: {
      mode: rawBudget.mode === 'range' ? 'range' : 'fixed',
      currency: String(rawBudget.currency || currencySymbolFromCode(currencyCode)),
      currencyCode,
      minAmount,
      maxAmount,
      announcement: String(rawBudget.announcement || ''),
    },
    timezone: String(d.timezone || 'Asia/Kolkata'),
    registrationDeadline: toDateSafe(d.registrationDeadline, fallbackEvent.registrationDeadline),
    matchingAt: toDateSafe(d.matchingAt, fallbackEvent.gifteeRevealAt),
    recipientRevealAt: toDateSafe(d.recipientRevealAt, fallbackEvent.gifteeRevealAt),
    senderRevealAt: d.senderRevealAt ? toDateSafe(d.senderRevealAt, fallbackEvent.santaIdentityRevealAt) : null,
    giftExchangeAt: toDateSafe(d.giftExchangeAt, fallbackEvent.giftDeadline),
    exchangeMode:
      d.exchangeMode === 'in-person' || d.exchangeMode === 'hybrid'
        ? (d.exchangeMode as GiftExchangeMode)
        : 'delivery',
    exchangeLocation: String(d.exchangeLocation || ''),
    pairingExclusions: Array.isArray(d.pairingExclusions)
      ? (d.pairingExclusions as PairingExclusion[]).filter((x) => x && x.memberA && x.memberB)
      : [],
    gamesConfig: mapGamesConfig(d.gamesConfig),
    inviteCode: String(d.inviteCode || ''),
    inviteCodeRevokedAt: d.inviteCodeRevokedAt ? toDateSafe(d.inviteCodeRevokedAt, new Date()) : null,
    status: (d.status as GroupLifecycleStatus) || 'REGISTRATION_OPEN',
    createdBy: String(d.createdBy || ''),
    ownerId: String(d.ownerId || ''),
    ownerDisplayName: String(d.ownerDisplayName || 'Head Elf'),
    memberCount: Math.max(0, Math.round(Number(d.memberCount ?? 0) || 0)),
    invitedCount: Math.max(0, Math.round(Number(d.invitedCount ?? 0) || 0)),
    isMatched: Boolean(d.isMatched),
    matchedAt: d.matchedAt ? toDateSafe(d.matchedAt, new Date()) : null,
    createdAt: toDateSafe(d.createdAt, new Date()),
    updatedAt: toDateSafe(d.updatedAt, new Date()),
  };
}

function mapGrant(id: string, d: Record<string, unknown>): GroupManagementGrant {
  return {
    id,
    groupId: String(d.groupId || ''),
    groupName: d.groupName ? String(d.groupName) : undefined,
    userId: String(d.userId || id),
    userEmail: String(d.userEmail || ''),
    userDisplayName: String(d.userDisplayName || ''),
    role: d.role === 'OWNER' ? 'OWNER' : 'MANAGER',
    permissions: Array.isArray(d.permissions)
      ? (d.permissions as GroupPermission[])
      : [...ALL_GROUP_PERMISSIONS],
    grantedBy: String(d.grantedBy || ''),
    grantedAt: toDateSafe(d.grantedAt, new Date()),
    revokedAt: d.revokedAt ? toDateSafe(d.revokedAt, new Date()) : null,
    active: Boolean(d.active),
  };
}

function mapMembership(id: string, d: Record<string, unknown>): GroupMembership {
  return {
    id,
    groupId: String(d.groupId || ''),
    userId: String(d.userId || ''),
    participantKey: String(d.participantKey || id),
    displayName: String(d.displayName || 'Participant'),
    avatarId: String(d.avatarId || 'santa-hat-girl'),
    status: (d.status as GroupMembership['status']) || 'JOINED',
    profileComplete: Boolean(d.profileComplete),
    addressComplete: Boolean(d.addressComplete),
    deliveryDispatched: Boolean(d.deliveryDispatched),
    joinedAt: d.joinedAt ? toDateSafe(d.joinedAt, new Date()) : null,
    withdrawnAt: d.withdrawnAt ? toDateSafe(d.withdrawnAt, new Date()) : null,
    updatedAt: toDateSafe(d.updatedAt, new Date()),
  };
}

function mapAuditLog(id: string, d: Record<string, unknown>): PlatformAuditLog {
  return {
    id,
    groupId: String(d.groupId || ''),
    action: (d.action as AuditActionType) || 'GROUP_UPDATED',
    actorUid: String(d.actorUid || ''),
    actorEmail: String(d.actorEmail || ''),
    actorRole: (d.actorRole as PlatformRole) || 'ADMIN',
    targetType: (d.targetType as PlatformAuditLog['targetType']) || 'group',
    targetId: String(d.targetId || ''),
    targetLabel: String(d.targetLabel || ''),
    reason: String(d.reason || ''),
    createdAt: toDateSafe(d.createdAt, new Date()),
  };
}

function serializeGamesConfigForFirestore(g: GroupGamesConfig) {
  return {
    mailboxEnabled: Boolean(g.mailboxEnabled),
    guessingEnabled: Boolean(g.guessingEnabled),
    maxGuesses: Math.max(1, Math.min(10, Math.round(g.maxGuesses || 3))),
    adventEnabled: Boolean(g.adventEnabled),
    wheelEnabled: Boolean(g.wheelEnabled),
    elfChallengeEnabled: Boolean(g.elfChallengeEnabled),
    quizEnabled: Boolean(g.quizEnabled),
    gingerbreadShowdownEnabled: Boolean(g.gingerbreadShowdownEnabled),
    gingerbreadSubmissionDeadline: g.gingerbreadSubmissionDeadline
      ? Timestamp.fromDate(g.gingerbreadSubmissionDeadline)
      : null,
    gingerbreadVotingDeadline: g.gingerbreadVotingDeadline
      ? Timestamp.fromDate(g.gingerbreadVotingDeadline)
      : null,
    santaStarsReward: Math.max(0, Math.min(1000, Math.round(g.santaStarsReward || 100))),
    deliveryTrackingEnabled: Boolean(g.deliveryTrackingEnabled),
    thankYouEnabled: Boolean(g.thankYouEnabled),
    snowGlobeRevealEnabled: Boolean(g.snowGlobeRevealEnabled),
  };
}

function buildSyncedEventPayload(params: {
  name: string;
  timezone: string;
  registrationOpen: boolean;
  registrationDeadline: Date;
  recipientRevealAt: Date;
  giftExchangeAt: Date;
  senderRevealAt: Date | null;
  budget: GiftBudgetConfig & { currencyCode?: GroupCurrency };
  gamesConfig: GroupGamesConfig;
  isMatched: boolean;
  matchedAt: Date | null;
  participantCount: number;
  createdBy: string;
  isCreate: boolean;
}) {
  const now = new Date();
  const effectiveSenderReveal =
    params.senderRevealAt || new Date(params.giftExchangeAt.getTime() + 2 * 86400_000);
  const adventStart = new Date(now.getTime() - 6 * 86400_000);
  const adventEnd = new Date(adventStart.getTime() + 25 * 86400_000);
  const mailboxOpen = new Date(now.getTime() - 3600_000);
  const mailboxClose = new Date(effectiveSenderReveal.getTime() + 7 * 86400_000);

  const cleanBudget: Record<string, unknown> = {
    mode: params.budget.mode,
    currency: params.budget.currency || currencySymbolFromCode(params.budget.currencyCode || 'INR'),
    minAmount: Math.max(0, Math.round(params.budget.minAmount || 0)),
    maxAmount: Math.max(
      Math.max(0, Math.round(params.budget.minAmount || 0)),
      Math.round(params.budget.maxAmount || params.budget.minAmount || 0)
    ),
    announcement: (params.budget.announcement || '').trim().slice(0, 240),
  };
  if (params.budget.currencyCode) {
    cleanBudget.currencyCode = params.budget.currencyCode;
  }

  const base: Record<string, unknown> = {
    name: params.name.trim().slice(0, 120),
    timezone: params.timezone.trim().slice(0, 64) || 'Asia/Kolkata',
    registrationOpen: params.registrationOpen,
    registrationDeadline: Timestamp.fromDate(params.registrationDeadline),
    gifteeRevealAt: Timestamp.fromDate(params.recipientRevealAt),
    giftDeadline: Timestamp.fromDate(params.giftExchangeAt),
    santaIdentityRevealAt: Timestamp.fromDate(effectiveSenderReveal),
    isMatched: params.isMatched,
    matchedAt: params.matchedAt ? Timestamp.fromDate(params.matchedAt) : null,
    participantCount: Math.max(0, Math.min(500, Math.round(params.participantCount))),
    budget: cleanBudget,
    mailboxEnabled: params.gamesConfig.mailboxEnabled,
    mailboxOpenAt: Timestamp.fromDate(mailboxOpen),
    mailboxCloseAt: Timestamp.fromDate(mailboxClose),
    guessingEnabled: params.gamesConfig.guessingEnabled,
    maxGuesses: Math.max(1, Math.min(10, Math.round(params.gamesConfig.maxGuesses || 3))),
    allowDuplicateGuesses: false,
    adventEnabled: params.gamesConfig.adventEnabled,
    adventStartAt: Timestamp.fromDate(adventStart),
    adventEndAt: Timestamp.fromDate(adventEnd),
    adventAllowCatchUp: true,
    wheelEnabled: params.gamesConfig.wheelEnabled,
    elfChallengeEnabled: params.gamesConfig.elfChallengeEnabled,
    quizEnabled: params.gamesConfig.quizEnabled,
    quizAllowRetake: true,
    deliveryTrackingEnabled: params.gamesConfig.deliveryTrackingEnabled,
    allowSharedTrackingLink: false,
    thankYouEnabled: params.gamesConfig.thankYouEnabled,
    snowGlobeRevealEnabled: params.gamesConfig.snowGlobeRevealEnabled,
    giftPreferencesCutoffAt: Timestamp.fromDate(params.recipientRevealAt),
    updatedAt: serverTimestamp(),
  };

  if (params.isCreate) {
    base.createdBy = params.createdBy;
    base.createdAt = serverTimestamp();
  }
  return base;
}

async function appendAuditLogs(params: {
  groupId: string;
  action: AuditActionType;
  actor: Pick<PlatformUser, 'id' | 'email' | 'role'>;
  targetType: PlatformAuditLog['targetType'];
  targetId: string;
  targetLabel: string;
  reason?: string;
  writeGroupLog?: boolean;
}) {
  const logId = `log_${Date.now()}_${generateSecureTokenHex(4)}`;
  const payload = {
    groupId: params.groupId,
    action: params.action,
    actorUid: params.actor.id,
    actorEmail: params.actor.email.slice(0, 160),
    actorRole: params.actor.role,
    targetType: params.targetType,
    targetId: params.targetId.slice(0, 128),
    targetLabel: params.targetLabel.slice(0, 160),
    reason: (params.reason || '').slice(0, 360),
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'platformAuditLogs', logId), payload);
  if (params.writeGroupLog && params.groupId) {
    batch.set(doc(db, 'groups', params.groupId, 'auditLogs', logId), payload);
  }
  await batch.commit();
}

/**
 * Syncs a signed-in Firebase Auth user into /users/{uid}.
 * Bootstrapped Admin email or existing /admins entries automatically resolve to role='ADMIN'.
 * Non-admin users always start as role='PARTICIPANT' (rules enforce anti-privilege-escalation).
 */
export async function syncSignedInPlatformUser(firebaseUser: User): Promise<PlatformUser> {
  const email = (firebaseUser.email || '').trim().toLowerCase();
  const displayName = (firebaseUser.displayName || email.split('@')[0] || 'Secret Santa Member')
    .trim()
    .slice(0, 100);
  const photoURL = (firebaseUser.photoURL || '').slice(0, 400);
  const ref = doc(db, 'users', firebaseUser.uid);

  try {
    const emailHash = email ? await sha256Hex(email) : '';
    const preRegRef = emailHash && emailHash !== firebaseUser.uid ? doc(db, 'users', emailHash) : null;

    const [existingSnap, legacyAdmin, preRegSnap] = await Promise.all([
      getDoc(ref),
      checkIsAuthorizedAdmin(firebaseUser.uid, firebaseUser.email, firebaseUser.emailVerified),
      preRegRef ? getDoc(preRegRef).catch(() => null) : Promise.resolve(null),
    ]);

    const isBootstrapped = email === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    if (!existingSnap.exists()) {
      const preRegData = preRegSnap?.exists()
        ? (preRegSnap.data() as Record<string, unknown>)
        : null;
      const preRegRole: PlatformRole =
        preRegData && preRegData.status === 'ACTIVE' && preRegData.role === 'ORGANISER'
          ? 'ORGANISER'
          : 'PARTICIPANT';

      const initialRole: PlatformRole =
        isBootstrapped || legacyAdmin ? 'ADMIN' : preRegRole;

      await setDoc(ref, {
        email,
        displayName,
        photoURL,
        role: initialRole,
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Clean up temporary email-hash pre-registration doc once real UID profile is created
      if (preRegRef && preRegSnap?.exists()) {
        await deleteDoc(preRegRef).catch(() => undefined);
      }

      return {
        id: firebaseUser.uid,
        email,
        displayName,
        photoURL,
        role: initialRole,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const mapped = mapPlatformUser(existingSnap.id, existingSnap.data() as Record<string, unknown>);

    // Ensure bootstrapped or co-admin accounts always hold active ADMIN role
    if ((isBootstrapped || legacyAdmin) && (mapped.role !== 'ADMIN' || mapped.status !== 'ACTIVE')) {
      await updateDoc(ref, {
        role: 'ADMIN',
        status: 'ACTIVE',
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
      return { ...mapped, role: 'ADMIN', status: 'ACTIVE', displayName, photoURL };
    }

    // Keep displayName/photoURL fresh if changed
    if (mapped.displayName !== displayName || (mapped.photoURL || '') !== photoURL) {
      await updateDoc(ref, {
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
      return { ...mapped, displayName, photoURL };
    }

    return mapped;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
  }
}

export async function listPlatformUsers(): Promise<PlatformUser[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const raw = snap.docs.map((d) => mapPlatformUser(d.id, d.data() as Record<string, unknown>));
    // Deduplicate by lowercase email if both a pre-registered 64-hex doc and a real UID doc exist
    const byEmail = new Map<string, PlatformUser>();
    for (const u of raw) {
      const key = u.email.trim().toLowerCase() || u.id;
      const existing = byEmail.get(key);
      if (!existing) {
        byEmail.set(key, u);
      } else {
        const existingIsPreReg = /^[a-f0-9]{64}$/.test(existing.id);
        const currentIsPreReg = /^[a-f0-9]{64}$/.test(u.id);
        if (existingIsPreReg && !currentIsPreReg) {
          byEmail.set(key, u);
        }
      }
    }
    return Array.from(byEmail.values()).sort((a, b) => {
      const order: Record<PlatformRole, number> = { ADMIN: 0, ORGANISER: 1, PARTICIPANT: 2 };
      if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
      return a.displayName.localeCompare(b.displayName);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

export async function promoteUserToOrganiser(params: {
  actor: PlatformUser;
  targetUser: PlatformUser;
  initialGroupIds: string[];
  allGroups: SantaGroup[];
  reason?: string;
}): Promise<void> {
  if (params.actor.role !== 'ADMIN') {
    throw new Error('Only a Supreme Santa Admin can promote users to Head Elf Organiser.');
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', params.targetUser.id), {
    role: 'ORGANISER',
    status: 'ACTIVE',
    updatedAt: serverTimestamp(),
  });

  const groupMap = new Map(params.allGroups.map((g) => [g.id, g]));
  for (const gid of params.initialGroupIds) {
    const grp = groupMap.get(gid);
    if (!grp) continue;
    const grantRef = doc(db, 'groups', gid, 'managementGrants', params.targetUser.id);
    const [existingGrantSnap, grpSnap] = await Promise.all([
      getDoc(grantRef),
      getDoc(doc(db, 'groups', gid)),
    ]);

    if (existingGrantSnap.exists()) {
      batch.update(grantRef, {
        groupName: grp.name.slice(0, 120),
        userEmail: params.targetUser.email,
        userDisplayName: params.targetUser.displayName.slice(0, 100),
        role: 'MANAGER',
        permissions: [...ALL_GROUP_PERMISSIONS],
        revokedAt: null,
        active: true,
      });
    } else {
      batch.set(grantRef, {
        groupId: gid,
        groupName: grp.name.slice(0, 120),
        userId: params.targetUser.id,
        userEmail: params.targetUser.email,
        userDisplayName: params.targetUser.displayName.slice(0, 100),
        role: 'MANAGER',
        permissions: [...ALL_GROUP_PERMISSIONS],
        grantedBy: params.actor.email,
        grantedAt: serverTimestamp(),
        revokedAt: null,
        active: true,
      });
    }

    const currentManagers: string[] = Array.isArray(grpSnap.data()?.managerIds)
      ? (grpSnap.data()?.managerIds as string[])
      : [];
    const nextManagers = Array.from(new Set([...currentManagers, params.targetUser.id])).slice(0, 20);
    batch.update(doc(db, 'groups', gid), {
      managerIds: nextManagers,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: '',
      action: 'USER_PROMOTED_ORGANISER',
      actor: params.actor,
      targetType: 'user',
      targetId: params.targetUser.id,
      targetLabel: `${params.targetUser.displayName} (${params.targetUser.email})`,
      reason:
        params.reason?.trim() ||
        `Promoted to Head Elf Organiser${
          params.initialGroupIds.length > 0
            ? ` with access to ${params.initialGroupIds.length} group(s)`
            : ''
        }.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.targetUser.id}`);
  }
}

/**
 * Admin-only: Pre-registers a new user by Google email (or updates an existing user with that email)
 * and assigns them a platform role (PARTICIPANT or ORGANISER) plus optional initial group grants.
 * Works immediately even before the person's first Google Sign-In.
 */
export async function registerOrPromoteUserByEmail(params: {
  actor: PlatformUser;
  email: string;
  displayName: string;
  role: 'PARTICIPANT' | 'ORGANISER';
  initialGroupIds: string[];
  allUsers: PlatformUser[];
  allGroups: SantaGroup[];
  reason?: string;
}): Promise<PlatformUser> {
  if (params.actor.role !== 'ADMIN') {
    throw new Error('Only a Supreme Santa Admin can create or pre-register users.');
  }
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Please enter a valid Google email address.');
  }
  const cleanName = (params.displayName.trim() || normalizedEmail.split('@')[0] || 'Secret Santa Member').slice(
    0,
    100
  );

  // Check if user already exists by email
  const existingUser = params.allUsers.find(
    (u) => u.email.trim().toLowerCase() === normalizedEmail
  );

  if (existingUser) {
    if (existingUser.role === 'ADMIN') {
      throw new Error(`${existingUser.displayName} is already a Supreme Santa Admin.`);
    }
    if (params.role === 'ORGANISER') {
      await promoteUserToOrganiser({
        actor: params.actor,
        targetUser: { ...existingUser, displayName: cleanName },
        initialGroupIds: params.initialGroupIds,
        allGroups: params.allGroups,
        reason: params.reason || `Promoted ${normalizedEmail} to Head Elf Organiser.`,
      });
      return { ...existingUser, displayName: cleanName, role: 'ORGANISER', status: 'ACTIVE' };
    }
    await revokeOrganiserRole({
      actor: params.actor,
      targetUser: existingUser,
      allUsers: params.allUsers,
      allGroups: params.allGroups,
      reason: params.reason || `Set ${normalizedEmail} to Participant role.`,
    });
    return { ...existingUser, role: 'PARTICIPANT', status: 'ACTIVE' };
  }

  const emailHash = await sha256Hex(normalizedEmail);
  const userRef = doc(db, 'users', emailHash);
  const existingPreReg = await getDoc(userRef);
  const batch = writeBatch(db);

  if (existingPreReg.exists()) {
    batch.update(userRef, {
      displayName: cleanName,
      role: params.role,
      status: 'ACTIVE',
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(userRef, {
      email: normalizedEmail,
      displayName: cleanName,
      photoURL: '',
      role: params.role,
      status: 'ACTIVE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (params.role === 'ORGANISER' && params.initialGroupIds.length > 0) {
    const groupMap = new Map(params.allGroups.map((g) => [g.id, g]));
    for (const gid of params.initialGroupIds) {
      const grp = groupMap.get(gid);
      if (!grp) continue;
      const grantRef = doc(db, 'groups', gid, 'managementGrants', emailHash);
      const [existingGrantSnap, grpSnap] = await Promise.all([
        getDoc(grantRef),
        getDoc(doc(db, 'groups', gid)),
      ]);
      if (existingGrantSnap.exists()) {
        batch.update(grantRef, {
          groupName: grp.name.slice(0, 120),
          userEmail: normalizedEmail,
          userDisplayName: cleanName,
          role: 'MANAGER',
          permissions: [...ALL_GROUP_PERMISSIONS],
          revokedAt: null,
          active: true,
        });
      } else {
        batch.set(grantRef, {
          groupId: gid,
          groupName: grp.name.slice(0, 120),
          userId: emailHash,
          userEmail: normalizedEmail,
          userDisplayName: cleanName,
          role: 'MANAGER',
          permissions: [...ALL_GROUP_PERMISSIONS],
          grantedBy: params.actor.email,
          grantedAt: serverTimestamp(),
          revokedAt: null,
          active: true,
        });
      }
      const currentManagers: string[] = Array.isArray(grpSnap.data()?.managerIds)
        ? (grpSnap.data()?.managerIds as string[])
        : [];
      const nextManagers = Array.from(new Set([...currentManagers, emailHash])).slice(0, 20);
      batch.update(doc(db, 'groups', gid), {
        managerIds: nextManagers,
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: '',
      action: params.role === 'ORGANISER' ? 'USER_PROMOTED_ORGANISER' : 'GROUP_UPDATED',
      actor: params.actor,
      targetType: 'user',
      targetId: emailHash,
      targetLabel: `${cleanName} (${normalizedEmail})`,
      reason:
        params.reason?.trim() ||
        `Pre-registered ${normalizedEmail} as ${params.role}${
          params.role === 'ORGANISER' && params.initialGroupIds.length > 0
            ? ` with access to ${params.initialGroupIds.length} group(s)`
            : ''
        }.`,
    });
    return {
      id: emailHash,
      email: normalizedEmail,
      displayName: cleanName,
      photoURL: '',
      role: params.role,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${emailHash}`);
  }
}

/**
 * Admin-only: Safely changes any user's platform role (PARTICIPANT / ORGANISER / ADMIN),
 * enforcing last-active-Admin protection and revoking MANAGER grants when switching to PARTICIPANT.
 */
export async function setUserPlatformRole(params: {
  actor: PlatformUser;
  targetUser: PlatformUser;
  nextRole: PlatformRole;
  allUsers: PlatformUser[];
  allGroups: SantaGroup[];
}): Promise<void> {
  if (params.actor.role !== 'ADMIN') {
    throw new Error('Only a Supreme Santa Admin can change user roles.');
  }
  if (params.targetUser.role === params.nextRole) return;

  const guard = canModifyAdminAccount(
    params.allUsers,
    params.targetUser.id,
    params.nextRole,
    params.targetUser.status
  );
  if (!guard.allowed) {
    throw new Error(guard.reason || 'Cannot modify this Admin account.');
  }

  if (params.nextRole === 'PARTICIPANT') {
    await revokeOrganiserRole({
      actor: params.actor,
      targetUser: params.targetUser,
      allUsers: params.allUsers,
      allGroups: params.allGroups,
      reason: `Changed ${params.targetUser.email} role from ${params.targetUser.role} to PARTICIPANT.`,
    });
    return;
  }

  if (params.nextRole === 'ORGANISER') {
    await promoteUserToOrganiser({
      actor: params.actor,
      targetUser: params.targetUser,
      initialGroupIds: [],
      allGroups: params.allGroups,
      reason: `Changed ${params.targetUser.email} role from ${params.targetUser.role} to ORGANISER.`,
    });
    return;
  }

  // Promoting to ADMIN
  try {
    await updateDoc(doc(db, 'users', params.targetUser.id), {
      role: 'ADMIN',
      status: 'ACTIVE',
      updatedAt: serverTimestamp(),
    });
    await appendAuditLogs({
      groupId: '',
      action: 'USER_PROMOTED_ORGANISER',
      actor: params.actor,
      targetType: 'user',
      targetId: params.targetUser.id,
      targetLabel: `${params.targetUser.displayName} (${params.targetUser.email})`,
      reason: `Elevated ${params.targetUser.email} to Supreme Santa Admin.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.targetUser.id}`);
  }
}

/**
 * Admin-only: Safely demotes all Head Elf Organisers back to Participant role in one action,
 * never touching Admin accounts and keeping all ordinary participant group memberships intact.
 */
export async function demoteAllOrganisersToParticipant(params: {
  actor: PlatformUser;
  allUsers: PlatformUser[];
  allGroups: SantaGroup[];
}): Promise<number> {
  if (params.actor.role !== 'ADMIN') {
    throw new Error('Only a Supreme Santa Admin can change all Organisers to Participant.');
  }
  const organisers = params.allUsers.filter((u) => u.role === 'ORGANISER');
  for (const org of organisers) {
    await revokeOrganiserRole({
      actor: params.actor,
      targetUser: org,
      allUsers: params.allUsers,
      allGroups: params.allGroups,
      reason: 'Bulk reset: changed Head Elf Organiser to Participant.',
    });
  }
  return organisers.length;
}

export async function revokeOrganiserRole(params: {
  actor: PlatformUser;
  targetUser: PlatformUser;
  allUsers: PlatformUser[];
  allGroups: SantaGroup[];
  reason?: string;
}): Promise<void> {
  const guard = canModifyAdminAccount(params.allUsers, params.targetUser.id, 'PARTICIPANT', 'ACTIVE');
  if (!guard.allowed) {
    throw new Error(guard.reason || 'Cannot modify this account.');
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', params.targetUser.id), {
    role: 'PARTICIPANT',
    updatedAt: serverTimestamp(),
  });

  // Revoke active MANAGER grants cleanly while keeping ordinary group membership intact
  for (const grp of params.allGroups) {
    const grantRef = doc(db, 'groups', grp.id, 'managementGrants', params.targetUser.id);
    const grantSnap = await getDoc(grantRef);
    if (grantSnap.exists() && grantSnap.data().active) {
      batch.update(grantRef, {
        active: false,
        revokedAt: serverTimestamp(),
      });
    }
    const grpSnap = await getDoc(doc(db, 'groups', grp.id));
    if (grpSnap.exists()) {
      const managers: string[] = Array.isArray(grpSnap.data().managerIds)
        ? (grpSnap.data().managerIds as string[])
        : [];
      if (managers.includes(params.targetUser.id)) {
        batch.update(doc(db, 'groups', grp.id), {
          managerIds: managers.filter((uid) => uid !== params.targetUser.id),
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: '',
      action: 'USER_REVOKED_ORGANISER',
      actor: params.actor,
      targetType: 'user',
      targetId: params.targetUser.id,
      targetLabel: `${params.targetUser.displayName} (${params.targetUser.email})`,
      reason: params.reason?.trim() || 'Revoked Head Elf Organiser role and management grants.',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.targetUser.id}`);
  }
}

export async function setUserAccountStatus(params: {
  actor: PlatformUser;
  targetUser: PlatformUser;
  allUsers: PlatformUser[];
  status: 'ACTIVE' | 'SUSPENDED';
  reason?: string;
}): Promise<void> {
  const guard = canModifyAdminAccount(
    params.allUsers,
    params.targetUser.id,
    params.targetUser.role,
    params.status
  );
  if (!guard.allowed) {
    throw new Error(guard.reason || 'Cannot suspend this account.');
  }
  try {
    await updateDoc(doc(db, 'users', params.targetUser.id), {
      status: params.status,
      updatedAt: serverTimestamp(),
    });
    await appendAuditLogs({
      groupId: '',
      action: params.status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      actor: params.actor,
      targetType: 'user',
      targetId: params.targetUser.id,
      targetLabel: `${params.targetUser.displayName} (${params.targetUser.email})`,
      reason:
        params.reason?.trim() ||
        (params.status === 'SUSPENDED' ? 'Account suspended by Admin.' : 'Account reactivated by Admin.'),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.targetUser.id}`);
  }
}

export interface CreateSantaGroupInput {
  name: string;
  description: string;
  theme: ThemeId;
  visibility: GroupVisibility;
  maxParticipants: number;
  budgetMode: 'fixed' | 'range';
  currencyCode: GroupCurrency;
  minAmount: number;
  maxAmount: number;
  budgetAnnouncement: string;
  timezone: string;
  registrationDeadline: Date;
  matchingAt: Date;
  recipientRevealAt: Date;
  senderRevealAt: Date | null;
  giftExchangeAt: Date;
  exchangeMode: GiftExchangeMode;
  exchangeLocation: string;
  pairingExclusions: PairingExclusion[];
  gamesConfig: GroupGamesConfig;
  initialStatus?: 'DRAFT' | 'REGISTRATION_OPEN';
}

export async function createSantaGroup(
  actor: PlatformUser,
  input: CreateSantaGroupInput
): Promise<SantaGroup> {
  if (actor.status !== 'ACTIVE' || (actor.role !== 'ADMIN' && actor.role !== 'ORGANISER')) {
    throw new Error('Only active Supreme Santa Admins or Head Elf Organisers can create groups.');
  }

  const baseSlug = slugifyGroupName(input.name);
  const shortSuffix = generateSecureTokenHex(3);
  const groupId = `${baseSlug.slice(0, 36)}-${shortSuffix}`;
  const slug = `${baseSlug.slice(0, 40)}-${shortSuffix}`;
  const inviteCode = generateSecureTokenHex(10).toUpperCase();
  const inviteCodeHash = await sha256Hex(inviteCode.toLowerCase());
  const status: GroupLifecycleStatus = input.initialStatus || 'REGISTRATION_OPEN';
  const currencySymbol = currencySymbolFromCode(input.currencyCode);
  const cleanMin = Math.max(0, Math.round(input.minAmount || 0));
  const cleanMax = input.budgetMode === 'fixed' ? cleanMin : Math.max(cleanMin, Math.round(input.maxAmount || cleanMin));

  const budgetPayload = {
    mode: input.budgetMode,
    currency: currencySymbol,
    currencyCode: input.currencyCode,
    minAmount: cleanMin,
    maxAmount: cleanMax,
    announcement: input.budgetAnnouncement.trim().slice(0, 240),
  };

  const gamesSerialized = serializeGamesConfigForFirestore(input.gamesConfig);
  const logId = `log_${Date.now()}_${generateSecureTokenHex(4)}`;

  const batch = writeBatch(db);

  // 1. SantaGroup document
  batch.set(doc(db, 'groups', groupId), {
    slug,
    name: input.name.trim().slice(0, 120),
    description: input.description.trim().slice(0, 400),
    theme: input.theme,
    visibility: input.visibility,
    maxParticipants: Math.max(2, Math.min(500, Math.round(input.maxParticipants || 40))),
    budget: budgetPayload,
    timezone: input.timezone.trim().slice(0, 64) || 'Asia/Kolkata',
    registrationDeadline: Timestamp.fromDate(input.registrationDeadline),
    matchingAt: Timestamp.fromDate(input.matchingAt),
    recipientRevealAt: Timestamp.fromDate(input.recipientRevealAt),
    senderRevealAt: input.senderRevealAt ? Timestamp.fromDate(input.senderRevealAt) : null,
    giftExchangeAt: Timestamp.fromDate(input.giftExchangeAt),
    exchangeMode: input.exchangeMode,
    exchangeLocation: input.exchangeLocation.trim().slice(0, 200),
    pairingExclusions: input.pairingExclusions.slice(0, 40),
    gamesConfig: gamesSerialized,
    inviteCode,
    inviteCodeRevokedAt: null,
    status,
    createdBy: actor.id,
    ownerId: actor.id,
    ownerDisplayName: actor.displayName.slice(0, 100),
    managerIds: [actor.id],
    memberCount: 0,
    invitedCount: 0,
    isMatched: false,
    matchedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Atomic OWNER management grant
  batch.set(doc(db, 'groups', groupId, 'managementGrants', actor.id), {
    groupId,
    groupName: input.name.trim().slice(0, 120),
    userId: actor.id,
    userEmail: actor.email,
    userDisplayName: actor.displayName.slice(0, 100),
    role: 'OWNER',
    permissions: [...ALL_GROUP_PERMISSIONS],
    grantedBy: actor.email,
    grantedAt: serverTimestamp(),
    revokedAt: null,
    active: true,
  });

  // 3. Privacy-preserving slug index for /g/{slug}/invite?code=...
  batch.set(doc(db, 'groupSlugIndex', slug), {
    groupId,
    slug,
    inviteCodeHash,
    name: input.name.trim().slice(0, 120),
    theme: input.theme,
    updatedAt: serverTimestamp(),
  });

  // 4. Synced /events/{groupId} doc so the entire Workshop/Countdown/Reveal engine powers this group seamlessly!
  batch.set(
    doc(db, 'events', groupId),
    buildSyncedEventPayload({
      name: input.name,
      timezone: input.timezone,
      registrationOpen: status === 'REGISTRATION_OPEN',
      registrationDeadline: input.registrationDeadline,
      recipientRevealAt: input.recipientRevealAt,
      giftExchangeAt: input.giftExchangeAt,
      senderRevealAt: input.senderRevealAt,
      budget: budgetPayload,
      gamesConfig: input.gamesConfig,
      isMatched: false,
      matchedAt: null,
      participantCount: 0,
      createdBy: actor.id,
      isCreate: true,
    })
  );

  // 5. Immutable group & platform creation audit logs
  const auditEntry = {
    groupId,
    action: 'GROUP_CREATED' as AuditActionType,
    actorUid: actor.id,
    actorEmail: actor.email.slice(0, 160),
    actorRole: actor.role,
    targetType: 'group' as const,
    targetId: groupId,
    targetLabel: input.name.trim().slice(0, 160),
    reason: `Created ${input.visibility} group (${input.theme} theme).`,
    createdAt: serverTimestamp(),
  };
  batch.set(doc(db, 'groups', groupId, 'auditLogs', logId), auditEntry);
  batch.set(doc(db, 'platformAuditLogs', logId), auditEntry);

  try {
    await batch.commit();
    const createdSnap = await getDoc(doc(db, 'groups', groupId));
    return mapSantaGroup(groupId, (createdSnap.data() || {}) as Record<string, unknown>);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `groups/${groupId}`);
  }
}

/**
 * Ensures the legacy default-secret-santa-2026 event also has a matching SantaGroup record
 * so Admins can manage it right alongside newly created groups.
 */
export async function ensureDefaultEventSyncedToGroup(actor: PlatformUser): Promise<SantaGroup | null> {
  if (actor.role !== 'ADMIN') return null;
  const grpRef = doc(db, 'groups', DEFAULT_EVENT_ID);
  const existing = await getDoc(grpRef);
  if (existing.exists()) {
    return mapSantaGroup(existing.id, existing.data() as Record<string, unknown>);
  }
  const eventSnap = await getDoc(doc(db, 'events', DEFAULT_EVENT_ID));
  const ev = eventSnap.exists() ? (eventSnap.data() as Record<string, unknown>) : null;
  const fallback = buildDefaultEventTemplate();
  const slug = 'secret-santa-2026';
  const inviteCode = generateSecureTokenHex(10).toUpperCase();
  const inviteCodeHash = await sha256Hex(inviteCode.toLowerCase());
  const isMatched = Boolean(ev?.isMatched);
  const status: GroupLifecycleStatus = isMatched
    ? 'MATCHED'
    : ev?.registrationOpen === false
      ? 'REGISTRATION_CLOSED'
      : 'REGISTRATION_OPEN';

  const batch = writeBatch(db);
  batch.set(grpRef, {
    slug,
    name: String(ev?.name || fallback.name).slice(0, 120),
    description: 'Primary Secret Santa 2026 holiday gift exchange.',
    theme: 'santa',
    visibility: 'private',
    maxParticipants: 60,
    budget: {
      mode: (ev?.budget as Record<string, unknown>)?.mode === 'range' ? 'range' : 'fixed',
      currency: String((ev?.budget as Record<string, unknown>)?.currency || '₹'),
      currencyCode: 'INR',
      minAmount: Math.round(Number((ev?.budget as Record<string, unknown>)?.minAmount ?? 1000) || 1000),
      maxAmount: Math.round(Number((ev?.budget as Record<string, unknown>)?.maxAmount ?? 1000) || 1000),
      announcement: String((ev?.budget as Record<string, unknown>)?.announcement || fallback.budget.announcement),
    },
    timezone: String(ev?.timezone || 'Asia/Kolkata'),
    registrationDeadline: ev?.registrationDeadline || Timestamp.fromDate(fallback.registrationDeadline),
    matchingAt: ev?.gifteeRevealAt || Timestamp.fromDate(fallback.gifteeRevealAt),
    recipientRevealAt: ev?.gifteeRevealAt || Timestamp.fromDate(fallback.gifteeRevealAt),
    senderRevealAt: ev?.santaIdentityRevealAt || Timestamp.fromDate(fallback.santaIdentityRevealAt),
    giftExchangeAt: ev?.giftDeadline || Timestamp.fromDate(fallback.giftDeadline),
    exchangeMode: 'delivery',
    exchangeLocation: '',
    pairingExclusions: [],
    gamesConfig: serializeGamesConfigForFirestore(buildDefaultGamesConfig()),
    inviteCode,
    inviteCodeRevokedAt: null,
    status,
    createdBy: actor.id,
    ownerId: actor.id,
    ownerDisplayName: actor.displayName.slice(0, 100),
    managerIds: [actor.id],
    memberCount: Math.round(Number(ev?.participantCount ?? 0) || 0),
    invitedCount: 0,
    isMatched,
    matchedAt: ev?.matchedAt || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'groups', DEFAULT_EVENT_ID, 'managementGrants', actor.id), {
    groupId: DEFAULT_EVENT_ID,
    groupName: String(ev?.name || fallback.name).slice(0, 120),
    userId: actor.id,
    userEmail: actor.email,
    userDisplayName: actor.displayName.slice(0, 100),
    role: 'OWNER',
    permissions: [...ALL_GROUP_PERMISSIONS],
    grantedBy: actor.email,
    grantedAt: serverTimestamp(),
    revokedAt: null,
    active: true,
  });

  batch.set(doc(db, 'groupSlugIndex', slug), {
    groupId: DEFAULT_EVENT_ID,
    slug,
    inviteCodeHash,
    name: String(ev?.name || fallback.name).slice(0, 120),
    theme: 'santa',
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  const snap = await getDoc(grpRef);
  return mapSantaGroup(snap.id, (snap.data() || {}) as Record<string, unknown>);
}

export async function updateSantaGroup(
  actor: PlatformUser,
  group: SantaGroup,
  patch: Partial<{
    name: string;
    description: string;
    theme: ThemeId;
    visibility: GroupVisibility;
    maxParticipants: number;
    budget: SantaGroup['budget'];
    timezone: string;
    registrationDeadline: Date;
    matchingAt: Date;
    recipientRevealAt: Date;
    senderRevealAt: Date | null;
    giftExchangeAt: Date;
    exchangeMode: GiftExchangeMode;
    exchangeLocation: string;
    pairingExclusions: PairingExclusion[];
    gamesConfig: GroupGamesConfig;
    status: GroupLifecycleStatus;
  }>,
  reason = ''
): Promise<SantaGroup> {
  const nextStatus = patch.status ?? group.status;
  if (nextStatus !== group.status) {
    const check = canTransitionGroupLifecycle(group.status, nextStatus, actor.role, {
      joinedParticipantCount: group.memberCount,
      isMatched: group.isMatched,
    });
    if (!check.ok) {
      throw new Error(check.reason || 'Lifecycle transition is not allowed.');
    }
  }

  const nextName = (patch.name ?? group.name).trim().slice(0, 120);
  const nextTheme = patch.theme ?? group.theme;
  const nextBudget = patch.budget ?? group.budget;
  const nextGames = patch.gamesConfig ?? group.gamesConfig;
  const nextRegDeadline = patch.registrationDeadline ?? group.registrationDeadline;
  const nextMatchingAt = patch.matchingAt ?? group.matchingAt;
  const nextRecipientRevealAt = patch.recipientRevealAt ?? group.recipientRevealAt;
  const nextSenderRevealAt =
    patch.senderRevealAt !== undefined ? patch.senderRevealAt : group.senderRevealAt;
  const nextGiftExchangeAt = patch.giftExchangeAt ?? group.giftExchangeAt;
  const nextTimezone = (patch.timezone ?? group.timezone).trim().slice(0, 64) || 'Asia/Kolkata';

  const cleanBudget: Record<string, unknown> = {
    mode: nextBudget.mode,
    currency: nextBudget.currency || currencySymbolFromCode(nextBudget.currencyCode || 'INR'),
    minAmount: Math.max(0, Math.round(nextBudget.minAmount || 0)),
    maxAmount:
      nextBudget.mode === 'fixed'
        ? Math.max(0, Math.round(nextBudget.minAmount || 0))
        : Math.max(Math.round(nextBudget.minAmount || 0), Math.round(nextBudget.maxAmount || 0)),
    announcement: (nextBudget.announcement || '').trim().slice(0, 240),
  };
  if (nextBudget.currencyCode) {
    cleanBudget.currencyCode = nextBudget.currencyCode;
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', group.id), {
    name: nextName,
    description: (patch.description ?? group.description).trim().slice(0, 400),
    theme: nextTheme,
    visibility: patch.visibility ?? group.visibility,
    maxParticipants: Math.max(2, Math.min(500, Math.round(patch.maxParticipants ?? group.maxParticipants))),
    budget: cleanBudget,
    timezone: nextTimezone,
    registrationDeadline: Timestamp.fromDate(nextRegDeadline),
    matchingAt: Timestamp.fromDate(nextMatchingAt),
    recipientRevealAt: Timestamp.fromDate(nextRecipientRevealAt),
    senderRevealAt: nextSenderRevealAt ? Timestamp.fromDate(nextSenderRevealAt) : null,
    giftExchangeAt: Timestamp.fromDate(nextGiftExchangeAt),
    exchangeMode: patch.exchangeMode ?? group.exchangeMode,
    exchangeLocation: (patch.exchangeLocation ?? group.exchangeLocation).trim().slice(0, 200),
    pairingExclusions: (patch.pairingExclusions ?? group.pairingExclusions).slice(0, 40),
    gamesConfig: serializeGamesConfigForFirestore(nextGames),
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });

  // Sync /events/{groupId}
  const eventRef = doc(db, 'events', group.id);
  const eventSnap = await getDoc(eventRef);
  const eventPayload = buildSyncedEventPayload({
    name: nextName,
    timezone: nextTimezone,
    registrationOpen: nextStatus === 'REGISTRATION_OPEN',
    registrationDeadline: nextRegDeadline,
    recipientRevealAt: nextRecipientRevealAt,
    giftExchangeAt: nextGiftExchangeAt,
    senderRevealAt: nextSenderRevealAt,
    budget: nextBudget,
    gamesConfig: nextGames,
    isMatched: group.isMatched,
    matchedAt: group.matchedAt,
    participantCount: group.memberCount,
    createdBy: group.createdBy || actor.id,
    isCreate: !eventSnap.exists(),
  });
  if (eventSnap.exists()) {
    batch.update(eventRef, eventPayload);
  } else {
    batch.set(eventRef, eventPayload);
  }

  // Keep slug index metadata fresh
  const slugRef = doc(db, 'groupSlugIndex', group.slug);
  const slugSnap = await getDoc(slugRef);
  if (slugSnap.exists()) {
    batch.update(slugRef, {
      name: nextName,
      theme: nextTheme,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    const action: AuditActionType =
      nextStatus === 'COMPLETED_ARCHIVED'
        ? 'GROUP_ARCHIVED'
        : nextStatus !== group.status
          ? 'GROUP_LIFECYCLE_CHANGED'
          : 'GROUP_UPDATED';
    await appendAuditLogs({
      groupId: group.id,
      action,
      actor,
      targetType: 'group',
      targetId: group.id,
      targetLabel: nextName,
      reason:
        reason.trim() ||
        (nextStatus !== group.status
          ? `Group status changed from ${group.status} to ${nextStatus}.`
          : 'Updated group settings and schedule.'),
      writeGroupLog: true,
    });
    const updatedSnap = await getDoc(doc(db, 'groups', group.id));
    return mapSantaGroup(group.id, (updatedSnap.data() || {}) as Record<string, unknown>);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `groups/${group.id}`);
  }
}

export async function duplicateSantaGroup(
  actor: PlatformUser,
  source: SantaGroup,
  newName: string
): Promise<SantaGroup> {
  const shiftYear = (d: Date) => new Date(d.getTime() + 365 * 86400_000);
  const created = await createSantaGroup(actor, {
    name: newName.trim() || `${source.name} (Next Edition)`,
    description: source.description,
    theme: source.theme,
    visibility: source.visibility,
    maxParticipants: source.maxParticipants,
    budgetMode: source.budget.mode,
    currencyCode: source.budget.currencyCode || 'INR',
    minAmount: source.budget.minAmount,
    maxAmount: source.budget.maxAmount,
    budgetAnnouncement: source.budget.announcement,
    timezone: source.timezone,
    registrationDeadline: shiftYear(source.registrationDeadline),
    matchingAt: shiftYear(source.matchingAt),
    recipientRevealAt: shiftYear(source.recipientRevealAt),
    senderRevealAt: source.senderRevealAt ? shiftYear(source.senderRevealAt) : null,
    giftExchangeAt: shiftYear(source.giftExchangeAt),
    exchangeMode: source.exchangeMode,
    exchangeLocation: source.exchangeLocation,
    pairingExclusions: [],
    gamesConfig: { ...source.gamesConfig },
    initialStatus: 'DRAFT',
  });

  await appendAuditLogs({
    groupId: created.id,
    action: 'GROUP_DUPLICATED',
    actor,
    targetType: 'group',
    targetId: created.id,
    targetLabel: created.name,
    reason: `Duplicated settings from "${source.name}" (no private assignments or participants copied).`,
    writeGroupLog: true,
  });
  return created;
}

export async function deleteSantaGroupAdmin(
  actor: PlatformUser,
  group: SantaGroup,
  reason: string
): Promise<void> {
  if (actor.role !== 'ADMIN') {
    throw new Error('Only a Supreme Santa Admin can permanently delete a group.');
  }
  try {
    await deleteDoc(doc(db, 'groups', group.id));
    try {
      await deleteDoc(doc(db, 'groupSlugIndex', group.slug));
    } catch {
      // ignore if missing
    }
    try {
      await deleteDoc(doc(db, 'events', group.id));
    } catch {
      // ignore if missing
    }
    await appendAuditLogs({
      groupId: '',
      action: 'GROUP_DELETED',
      actor,
      targetType: 'group',
      targetId: group.id,
      targetLabel: group.name,
      reason: reason.trim() || 'Permanently deleted group by Supreme Santa Admin.',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `groups/${group.id}`);
  }
}

export async function transferGroupOwnership(params: {
  actor: PlatformUser;
  group: SantaGroup;
  newOwner: PlatformUser;
  reason?: string;
}): Promise<void> {
  if (params.actor.role !== 'ADMIN') {
    throw new Error('Only a Supreme Santa Admin can transfer group ownership.');
  }
  const grpSnap = await getDoc(doc(db, 'groups', params.group.id));
  const currentManagers: string[] = Array.isArray(grpSnap.data()?.managerIds)
    ? (grpSnap.data()?.managerIds as string[])
    : [];
  const nextManagers = Array.from(new Set([...currentManagers, params.newOwner.id])).slice(0, 20);

  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', params.group.id), {
    ownerId: params.newOwner.id,
    ownerDisplayName: params.newOwner.displayName.slice(0, 100),
    managerIds: nextManagers,
    updatedAt: serverTimestamp(),
  });

  // Promote user to ORGANISER if currently PARTICIPANT
  if (params.newOwner.role === 'PARTICIPANT') {
    batch.update(doc(db, 'users', params.newOwner.id), {
      role: 'ORGANISER',
      updatedAt: serverTimestamp(),
    });
  }

  // Upsert OWNER grant for newOwner safely (preserve immutable grantedAt on update)
  const newOwnerGrantRef = doc(db, 'groups', params.group.id, 'managementGrants', params.newOwner.id);
  const existingNewOwnerGrant = await getDoc(newOwnerGrantRef);
  if (existingNewOwnerGrant.exists()) {
    batch.update(newOwnerGrantRef, {
      groupName: params.group.name.slice(0, 120),
      userEmail: params.newOwner.email,
      userDisplayName: params.newOwner.displayName.slice(0, 100),
      role: 'OWNER',
      permissions: [...ALL_GROUP_PERMISSIONS],
      revokedAt: null,
      active: true,
    });
  } else {
    batch.set(newOwnerGrantRef, {
      groupId: params.group.id,
      groupName: params.group.name.slice(0, 120),
      userId: params.newOwner.id,
      userEmail: params.newOwner.email,
      userDisplayName: params.newOwner.displayName.slice(0, 100),
      role: 'OWNER',
      permissions: [...ALL_GROUP_PERMISSIONS],
      grantedBy: params.actor.email,
      grantedAt: serverTimestamp(),
      revokedAt: null,
      active: true,
    });
  }

  // Downgrade previous owner's grant to MANAGER if different
  if (params.group.ownerId && params.group.ownerId !== params.newOwner.id) {
    const prevRef = doc(db, 'groups', params.group.id, 'managementGrants', params.group.ownerId);
    const prevSnap = await getDoc(prevRef);
    if (prevSnap.exists()) {
      batch.update(prevRef, { role: 'MANAGER' });
    }
  }

  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: params.group.id,
      action: 'OWNERSHIP_TRANSFERRED',
      actor: params.actor,
      targetType: 'group',
      targetId: params.group.id,
      targetLabel: `${params.group.name} → ${params.newOwner.displayName}`,
      reason: params.reason?.trim() || `Transferred group ownership to ${params.newOwner.email}.`,
      writeGroupLog: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `groups/${params.group.id}`);
  }
}

export async function grantOrUpdateGroupManager(params: {
  actor: PlatformUser;
  group: SantaGroup;
  targetUser: PlatformUser;
  permissions: GroupPermission[];
  reason?: string;
}): Promise<void> {
  if (params.actor.role !== 'ADMIN') {
    throw new Error('Only a Supreme Santa Admin can grant or edit Organiser group access.');
  }
  const grantRef = doc(db, 'groups', params.group.id, 'managementGrants', params.targetUser.id);
  const existing = await getDoc(grantRef);
  const grpSnap = await getDoc(doc(db, 'groups', params.group.id));
  const currentManagers: string[] = Array.isArray(grpSnap.data()?.managerIds)
    ? (grpSnap.data()?.managerIds as string[])
    : [];
  const nextManagers = Array.from(new Set([...currentManagers, params.targetUser.id])).slice(0, 20);
  const cleanPerms =
    params.permissions.length > 0 ? params.permissions : [...ALL_GROUP_PERMISSIONS];

  const batch = writeBatch(db);
  if (params.targetUser.role === 'PARTICIPANT') {
    batch.update(doc(db, 'users', params.targetUser.id), {
      role: 'ORGANISER',
      status: 'ACTIVE',
      updatedAt: serverTimestamp(),
    });
  }
  if (existing.exists()) {
    batch.update(grantRef, {
      groupName: params.group.name.slice(0, 120),
      userEmail: params.targetUser.email,
      userDisplayName: params.targetUser.displayName.slice(0, 100),
      permissions: cleanPerms,
      active: true,
      revokedAt: null,
    });
  } else {
    batch.set(grantRef, {
      groupId: params.group.id,
      groupName: params.group.name.slice(0, 120),
      userId: params.targetUser.id,
      userEmail: params.targetUser.email,
      userDisplayName: params.targetUser.displayName.slice(0, 100),
      role: 'MANAGER',
      permissions: cleanPerms,
      grantedBy: params.actor.email,
      grantedAt: serverTimestamp(),
      revokedAt: null,
      active: true,
    });
  }
  batch.update(doc(db, 'groups', params.group.id), {
    managerIds: nextManagers,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: params.group.id,
      action: existing.exists() ? 'GRANT_UPDATED' : 'GRANT_ADDED',
      actor: params.actor,
      targetType: 'grant',
      targetId: `${params.group.id}:${params.targetUser.id}`,
      targetLabel: `${params.targetUser.displayName} @ ${params.group.name}`,
      reason:
        params.reason?.trim() ||
        `Granted ${cleanPerms.length} group management permissions.`,
      writeGroupLog: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${params.group.id}/managementGrants/${params.targetUser.id}`);
  }
}

export async function revokeGroupManager(params: {
  actor: PlatformUser;
  group: SantaGroup;
  targetUserId: string;
  targetLabel: string;
  reason?: string;
}): Promise<void> {
  if (params.actor.role !== 'ADMIN') {
    throw new Error('Only a Supreme Santa Admin can revoke group management access.');
  }
  const grantRef = doc(db, 'groups', params.group.id, 'managementGrants', params.targetUserId);
  const grpSnap = await getDoc(doc(db, 'groups', params.group.id));
  const currentManagers: string[] = Array.isArray(grpSnap.data()?.managerIds)
    ? (grpSnap.data()?.managerIds as string[])
    : [];

  const batch = writeBatch(db);
  batch.update(grantRef, {
    active: false,
    revokedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'groups', params.group.id), {
    managerIds: currentManagers.filter((uid) => uid !== params.targetUserId),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: params.group.id,
      action: 'GRANT_REVOKED',
      actor: params.actor,
      targetType: 'grant',
      targetId: `${params.group.id}:${params.targetUserId}`,
      targetLabel: `${params.targetLabel} @ ${params.group.name}`,
      reason: params.reason?.trim() || 'Revoked group management access (participant membership preserved).',
      writeGroupLog: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `groups/${params.group.id}/managementGrants/${params.targetUserId}`);
  }
}

export async function listGroupManagementGrants(groupId: string): Promise<GroupManagementGrant[]> {
  try {
    const snap = await getDocs(collection(db, 'groups', groupId, 'managementGrants'));
    return snap.docs.map((d) => mapGrant(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `groups/${groupId}/managementGrants`);
  }
}

export async function fetchMyGrantForGroup(
  groupId: string,
  userId: string,
  userEmail?: string
): Promise<GroupManagementGrant | null> {
  try {
    const snap = await getDoc(doc(db, 'groups', groupId, 'managementGrants', userId));
    if (snap.exists()) {
      return mapGrant(snap.id, snap.data() as Record<string, unknown>);
    }
    if (userEmail) {
      const emailHash = await sha256Hex(userEmail.trim().toLowerCase());
      if (emailHash && emailHash !== userId) {
        const hashSnap = await getDoc(doc(db, 'groups', groupId, 'managementGrants', emailHash));
        if (hashSnap.exists()) {
          return mapGrant(hashSnap.id, hashSnap.data() as Record<string, unknown>);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function listAllGroupsAdmin(): Promise<SantaGroup[]> {
  try {
    const snap = await getDocs(collection(db, 'groups'));
    return snap.docs
      .map((d) => mapSantaGroup(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'groups');
  }
}

export async function listManagedGroupsForUser(
  userId: string,
  userEmail?: string
): Promise<SantaGroup[]> {
  try {
    const emailHash = userEmail ? await sha256Hex(userEmail.trim().toLowerCase()) : '';
    const queries = [
      getDocs(query(collection(db, 'groups'), where('ownerId', '==', userId))),
      getDocs(query(collection(db, 'groups'), where('managerIds', 'array-contains', userId))),
    ];
    if (emailHash && emailHash !== userId) {
      queries.push(
        getDocs(query(collection(db, 'groups'), where('managerIds', 'array-contains', emailHash)))
      );
    }
    const snaps = await Promise.all(queries);
    const map = new Map<string, SantaGroup>();
    snaps.forEach((snap) => {
      snap.docs.forEach((d) => map.set(d.id, mapSantaGroup(d.id, d.data() as Record<string, unknown>)));
    });
    return Array.from(map.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'groups');
  }
}

export async function listDiscoverableGroups(): Promise<SantaGroup[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'groups'), where('visibility', '==', 'discoverable'))
    );
    return snap.docs
      .map((d) => mapSantaGroup(d.id, d.data() as Record<string, unknown>))
      .filter((g) => g.status !== 'COMPLETED_ARCHIVED')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

export async function fetchSantaGroup(groupId: string): Promise<SantaGroup | null> {
  try {
    const snap = await getDoc(doc(db, 'groups', groupId));
    if (!snap.exists()) return null;
    return mapSantaGroup(snap.id, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Resolves a Group Invitation Link (/g/{slug}/invite?code={code}) using the privacy-preserving
 * /groupSlugIndex/{slug} collection. Never auto-authenticates as an existing participant!
 */
export async function resolveGroupInviteLink(
  slug: string,
  rawCode: string
): Promise<{ ok: true; group: SantaGroup } | { ok: false; reason: string }> {
  const cleanSlug = slug.trim().toLowerCase();
  const cleanCode = rawCode.trim().toLowerCase();
  if (!cleanSlug || !cleanCode) {
    return { ok: false, reason: 'This group invitation link is incomplete.' };
  }
  try {
    const idxSnap = await getDoc(doc(db, 'groupSlugIndex', cleanSlug));
    if (!idxSnap.exists()) {
      return { ok: false, reason: 'This Secret Santa group invitation was not found.' };
    }
    const idx = idxSnap.data();
    const expectedHash = String(idx.inviteCodeHash || '');
    const actualHash = await sha256Hex(cleanCode);
    if (!expectedHash || actualHash !== expectedHash) {
      return {
        ok: false,
        reason: 'This group invitation code is invalid or was regenerated by the Head Elf.',
      };
    }
    const group = await fetchSantaGroup(String(idx.groupId));
    if (!group) {
      return { ok: false, reason: 'The Secret Santa group no longer exists.' };
    }
    if (group.status === 'COMPLETED_ARCHIVED') {
      return { ok: false, reason: 'This Secret Santa group has been archived.' };
    }
    if (group.status !== 'REGISTRATION_OPEN' || group.isMatched) {
      return {
        ok: false,
        reason: `Registration for "${group.name}" is currently closed.`,
      };
    }
    return { ok: true, group };
  } catch {
    return { ok: false, reason: 'Could not verify the group invitation right now.' };
  }
}

export async function regenerateGroupInviteCode(
  actor: PlatformUser,
  group: SantaGroup
): Promise<{ inviteCode: string; inviteUrl: string }> {
  const nextCode = generateSecureTokenHex(10).toUpperCase();
  const nextHash = await sha256Hex(nextCode.toLowerCase());
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', group.id), {
    inviteCode: nextCode,
    inviteCodeRevokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'groupSlugIndex', group.slug), {
    groupId: group.id,
    slug: group.slug,
    inviteCodeHash: nextHash,
    name: group.name.slice(0, 120),
    theme: group.theme,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: group.id,
      action: 'INVITE_REGENERATED',
      actor,
      targetType: 'invitation',
      targetId: group.id,
      targetLabel: group.name,
      reason: 'Regenerated group invitation link code (old group link invalidated).',
      writeGroupLog: true,
    });
    return {
      inviteCode: nextCode,
      inviteUrl: buildGroupInviteUrl(window.location.origin, group.slug, nextCode),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `groups/${group.id}`);
  }
}

export async function generateGroupPersonalInvitation(params: {
  actor: PlatformUser;
  group: SantaGroup;
  label: string;
  expiresInDays?: number;
}): Promise<{ rawToken: string; tokenHash: string; inviteUrl: string }> {
  const rawToken = generateSecureTokenHex(32);
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + (params.expiresInDays ?? 30) * 86400_000);
  const cleanLabel = params.label.trim().slice(0, 100) || 'Secret Santa Guest';

  const inviteDoc = {
    eventId: params.group.id,
    label: cleanLabel,
    status: 'pending',
    participantKey: '',
    isRecovery: false,
    recoveryParticipantKey: '',
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'invitations', tokenHash), inviteDoc);
  batch.set(doc(db, 'groups', params.group.id, 'invitations', tokenHash), inviteDoc);
  batch.update(doc(db, 'groups', params.group.id), {
    invitedCount: Math.min(500, params.group.invitedCount + 1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: params.group.id,
      action: 'INVITE_CREATED',
      actor: params.actor,
      targetType: 'invitation',
      targetId: tokenHash.slice(0, 16),
      targetLabel: cleanLabel,
      reason: `Issued personal invitation link for ${cleanLabel}.`,
      writeGroupLog: true,
    });
    return {
      rawToken,
      tokenHash,
      inviteUrl: buildPersonalInviteUrl(window.location.origin, rawToken),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `groups/${params.group.id}/invitations/${tokenHash}`);
  }
}

export async function listGroupInvitations(groupId: string): Promise<InvitationRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'groups', groupId, 'invitations'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          tokenHash: d.id,
          eventId: String(data.eventId || groupId),
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
    handleFirestoreError(err, OperationType.LIST, `groups/${groupId}/invitations`);
  }
}

export async function revokeGroupInvitation(
  actor: PlatformUser,
  groupId: string,
  tokenHash: string,
  label: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', groupId, 'invitations', tokenHash), {
    status: 'revoked',
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'invitations', tokenHash), {
    status: 'revoked',
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
    await appendAuditLogs({
      groupId,
      action: 'INVITE_REVOKED',
      actor,
      targetType: 'invitation',
      targetId: tokenHash.slice(0, 16),
      targetLabel: label,
      reason: 'Revoked unused personal invitation link.',
      writeGroupLog: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}/invitations/${tokenHash}`);
  }
}

export async function upsertGroupMembership(
  groupId: string,
  profile: ParticipantProfile,
  userId = ''
): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'members', profile.id);
  const addressComplete = Boolean(
    profile.address.line1.trim() &&
      profile.address.city.trim() &&
      profile.address.state.trim() &&
      profile.address.postalCode.trim()
  );
  const profileComplete = Boolean(profile.name.trim() && profile.hobbies.length > 0);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        groupId,
        userId,
        participantKey: profile.id,
        displayName: profile.name.trim().slice(0, 100),
        avatarId: profile.avatarId,
        status: 'JOINED',
        profileComplete,
        addressComplete,
        deliveryDispatched: false,
        joinedAt: serverTimestamp(),
        withdrawnAt: null,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: profile.name.trim().slice(0, 100),
        avatarId: profile.avatarId,
        status: 'JOINED',
        profileComplete,
        addressComplete,
        withdrawnAt: null,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-blocking if group doc wasn't initialized yet for legacy default event
  }
}

export async function listGroupMembers(groupId: string): Promise<GroupMembership[]> {
  try {
    const snap = await getDocs(collection(db, 'groups', groupId, 'members'));
    return snap.docs
      .map((d) => mapMembership(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `groups/${groupId}/members`);
  }
}

export async function removeGroupMemberPreMatch(
  actor: PlatformUser,
  group: SantaGroup,
  member: GroupMembership,
  reason = ''
): Promise<void> {
  if (group.isMatched) {
    throw new Error('Cannot remove participants after matching has been executed.');
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', group.id, 'members', member.id), {
    status: 'REMOVED',
    withdrawnAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'participants', member.participantKey));
  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: group.id,
      action: 'MEMBER_REMOVED',
      actor,
      targetType: 'member',
      targetId: member.participantKey.slice(0, 16),
      targetLabel: member.displayName,
      reason: reason.trim() || 'Removed participant before matching.',
      writeGroupLog: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `groups/${group.id}/members/${member.id}`);
  }
}

export async function leaveGroupAsParticipant(
  group: SantaGroup,
  participantKey: string
): Promise<{ ok: boolean; message: string }> {
  const memberRef = doc(db, 'groups', group.id, 'members', participantKey);
  const snap = await getDoc(memberRef);
  const deliveryDispatched = Boolean(snap.exists() && snap.data().deliveryDispatched);
  const policy = evaluateParticipantLeavePolicy({
    groupStatus: group.status,
    isMatched: group.isMatched,
    deliveryDispatched,
  });

  if (!policy.canSelfLeave) {
    return { ok: false, message: policy.message };
  }

  if (snap.exists()) {
    await updateDoc(memberRef, {
      status: 'WITHDRAWN',
      withdrawnAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  removeParticipantGroupSession(group.id);
  return { ok: true, message: 'You have left this Secret Santa group.' };
}

export async function submitGroupJoinRequest(params: {
  groupId: string;
  userId?: string;
  requesterName: string;
  requesterEmail: string;
  note: string;
}): Promise<void> {
  const reqId = `jr_${Date.now()}_${generateSecureTokenHex(4)}`;
  try {
    await setDoc(doc(db, 'groups', params.groupId, 'joinRequests', reqId), {
      groupId: params.groupId,
      userId: params.userId || '',
      requesterName: params.requesterName.trim().slice(0, 100),
      requesterEmail: params.requesterEmail.trim().slice(0, 160),
      note: params.note.trim().slice(0, 240),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `groups/${params.groupId}/joinRequests/${reqId}`);
  }
}

export async function listGroupJoinRequests(groupId: string): Promise<GroupJoinRequest[]> {
  try {
    const snap = await getDocs(collection(db, 'groups', groupId, 'joinRequests'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          groupId: String(data.groupId || groupId),
          userId: String(data.userId || ''),
          requesterName: String(data.requesterName || 'Guest'),
          requesterEmail: String(data.requesterEmail || ''),
          note: String(data.note || ''),
          status: (data.status as GroupJoinRequest['status']) || 'pending',
          reviewedBy: data.reviewedBy ? String(data.reviewedBy) : undefined,
          createdAt: toDateSafe(data.createdAt, new Date()),
          updatedAt: toDateSafe(data.updatedAt, new Date()),
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `groups/${groupId}/joinRequests`);
  }
}

export async function reviewGroupJoinRequest(params: {
  actor: PlatformUser;
  group: SantaGroup;
  request: GroupJoinRequest;
  decision: 'approved' | 'declined';
}): Promise<{ inviteUrl?: string }> {
  await updateDoc(doc(db, 'groups', params.group.id, 'joinRequests', params.request.id), {
    status: params.decision,
    reviewedBy: params.actor.email.slice(0, 160),
    updatedAt: serverTimestamp(),
  });

  let inviteUrl: string | undefined;
  if (params.decision === 'approved') {
    const inv = await generateGroupPersonalInvitation({
      actor: params.actor,
      group: params.group,
      label: params.request.requesterName,
    });
    inviteUrl = inv.inviteUrl;
    await appendAuditLogs({
      groupId: params.group.id,
      action: 'MEMBER_APPROVED',
      actor: params.actor,
      targetType: 'member',
      targetId: params.request.id,
      targetLabel: params.request.requesterName,
      reason: 'Approved discoverable group join request and issued personal invite link.',
      writeGroupLog: true,
    });
  }
  return { inviteUrl };
}

export async function postGroupAnnouncement(params: {
  actor: PlatformUser;
  groupId: string;
  title: string;
  body: string;
  kind: 'announcement' | 'reminder';
}): Promise<GroupAnnouncement> {
  const annId = `ann_${Date.now()}_${generateSecureTokenHex(4)}`;
  try {
    await setDoc(doc(db, 'groups', params.groupId, 'announcements', annId), {
      groupId: params.groupId,
      title: params.title.trim().slice(0, 120),
      body: params.body.trim().slice(0, 600),
      kind: params.kind,
      authorUid: params.actor.id,
      authorName: params.actor.displayName.slice(0, 100),
      authorRole: params.actor.role,
      createdAt: serverTimestamp(),
    });
    await appendAuditLogs({
      groupId: params.groupId,
      action: params.kind === 'reminder' ? 'REMINDER_SENT' : 'ANNOUNCEMENT_POSTED',
      actor: params.actor,
      targetType: 'group',
      targetId: annId,
      targetLabel: params.title.trim().slice(0, 120),
      reason: params.kind === 'reminder' ? 'Sent group reminder.' : 'Posted group announcement.',
      writeGroupLog: true,
    });
    return {
      id: annId,
      groupId: params.groupId,
      title: params.title.trim().slice(0, 120),
      body: params.body.trim().slice(0, 600),
      kind: params.kind,
      authorUid: params.actor.id,
      authorName: params.actor.displayName.slice(0, 100),
      authorRole: params.actor.role,
      createdAt: new Date(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `groups/${params.groupId}/announcements/${annId}`);
  }
}

export async function listGroupAnnouncements(groupId: string): Promise<GroupAnnouncement[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'groups', groupId, 'announcements'), where('groupId', '==', groupId))
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          groupId: String(data.groupId || groupId),
          title: String(data.title || ''),
          body: String(data.body || ''),
          kind: (data.kind === 'reminder' ? 'reminder' : 'announcement') as 'announcement' | 'reminder',
          authorUid: String(data.authorUid || ''),
          authorName: String(data.authorName || 'Head Elf'),
          authorRole: (data.authorRole as PlatformRole) || 'ORGANISER',
          createdAt: toDateSafe(data.createdAt, new Date()),
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

/**
 * Executes exclusion-aware cryptographic Secret Santa matching for a specific SantaGroup.
 * Works for both Admins and authorized Organisers (fetches joined members via /groups/{id}/members
 * and per-key /participants/{key} without requiring list access on /participants).
 * NEVER returns assignment pairs to the Organiser UI!
 */
export async function runGroupMatchingWithExclusions(
  actor: PlatformUser,
  group: SantaGroup
): Promise<{ matchedCount: number }> {
  if (group.isMatched) {
    throw new Error('This group has already been matched. Admin approval is required to reset.');
  }

  const members = (await listGroupMembers(group.id)).filter((m) => m.status === 'JOINED');
  const profiles: ParticipantProfile[] = [];

  for (const m of members) {
    const p = await fetchParticipantProfile(m.participantKey);
    if (p && p.hasJoined && p.eventId === group.id) {
      profiles.push(p);
    }
  }

  if (profiles.length < 2) {
    throw new Error(
      `Need at least 2 joined participants to run Secret Santa matching (currently ${profiles.length}).`
    );
  }

  // Server-side validation of pairing exclusions + derangement
  const derangement = generateConstrainedDerangement(profiles, group.pairingExclusions);
  if (!derangement.ok) {
    throw new Error(derangement.error);
  }
  const recipients = derangement.recipients;

  // Gather shareable dislikes per participant (readable by participant key)
  const dislikesByKey = new Map<string, GiftDislikesShareable | null>();
  await Promise.all(
    profiles.map(async (p) => {
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

  const publicIds = new Map<string, string>();
  const rosterEntries: PublicRosterEntry[] = [];
  for (const p of profiles) {
    const pubId = await sha256Hex(`pub:${p.id}`);
    publicIds.set(p.id, pubId);
    rosterEntries.push({ publicId: pubId, name: p.name, avatarId: p.avatarId });
  }

  const assignmentIds = await Promise.all(
    profiles.map(() => sha256Hex(generateSecureTokenHex(32)))
  );

  const batch = writeBatch(db);
  profiles.forEach((giver, index) => {
    const recipient = recipients[index];
    const assignmentId = assignmentIds[index];
    const giverPublicId = publicIds.get(giver.id) || '';

    batch.set(doc(db, 'matches', giver.id), {
      eventId: group.id,
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

    batch.set(doc(db, 'incomingAssignments', recipient.id), {
      eventId: group.id,
      recipientKey: recipient.id,
      incomingAssignmentId: assignmentId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'santaReveals', recipient.id), {
      eventId: group.id,
      recipientKey: recipient.id,
      santaPublicId: giverPublicId,
      santaName: giver.name,
      santaAvatarId: giver.avatarId,
      santaHobbies: giver.hobbies,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  batch.set(doc(db, 'eventRosters', group.id), {
    eventId: group.id,
    entries: rosterEntries,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'events', group.id), {
    isMatched: true,
    matchedAt: serverTimestamp(),
    registrationOpen: false,
    participantCount: profiles.length,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'groups', group.id), {
    status: 'MATCHED',
    isMatched: true,
    matchedAt: serverTimestamp(),
    memberCount: profiles.length,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    await appendAuditLogs({
      groupId: group.id,
      action: 'MATCH_TRIGGERED',
      actor,
      targetType: 'group',
      targetId: group.id,
      targetLabel: group.name,
      reason: `Matched ${profiles.length} participants with ${group.pairingExclusions.length} exclusion rule(s).`,
      writeGroupLog: true,
    });
    return { matchedCount: profiles.length };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `matches/${group.id}`);
  }
}

/**
 * BREAK-GLASS AUDITED EMERGENCY ACCESS (Admin-Only).
 * Routine Admin screens NEVER expose private Secret Santa mappings.
 * Requires an explicit non-empty justification reason and writes an immutable
 * BREAK_GLASS_ASSIGNMENT_VIEW audit entry BEFORE reading /matches for that group.
 */
export async function breakGlassInspectAssignments(params: {
  actor: PlatformUser;
  group: SantaGroup;
  reason: string;
}): Promise<BreakGlassAssignmentRow[]> {
  if (params.actor.role !== 'ADMIN') {
    throw new Error('Break-glass assignment inspection is strictly restricted to Supreme Santa Admins.');
  }
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 10) {
    throw new Error('Please provide a clear support reason (at least 10 characters) for audit logging.');
  }

  // 1. Write mandatory immutable audit entry FIRST
  await appendAuditLogs({
    groupId: params.group.id,
    action: 'BREAK_GLASS_ASSIGNMENT_VIEW',
    actor: params.actor,
    targetType: 'assignment',
    targetId: params.group.id,
    targetLabel: params.group.name,
    reason: cleanReason,
    writeGroupLog: true,
  });

  // 2. Fetch matches & participants for this group only
  try {
    const [matchesSnap, partsSnap] = await Promise.all([
      getDocs(query(collection(db, 'matches'), where('eventId', '==', params.group.id))),
      getDocs(query(collection(db, 'participants'), where('eventId', '==', params.group.id))),
    ]);
    const nameByKey = new Map<string, string>();
    partsSnap.docs.forEach((d) => nameByKey.set(d.id, String(d.data().name || 'Participant')));

    return matchesSnap.docs.map((d) => {
      const data = d.data();
      const giverKey = String(data.giverKey || d.id);
      return {
        giverKey,
        giverName: nameByKey.get(giverKey) || `Participant (${giverKey.slice(0, 6)})`,
        recipientName: String(data.recipientName || 'Recipient'),
        outgoingAssignmentId: String(data.outgoingAssignmentId || ''),
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `matches/${params.group.id}`);
  }
}

export async function fetchPlatformConfig(): Promise<PlatformConfig> {
  try {
    const snap = await getDoc(doc(db, 'platformConfig', 'global'));
    if (!snap.exists()) return buildDefaultPlatformConfig();
    const d = snap.data();
    const def = buildDefaultPlatformConfig();
    return {
      id: 'global',
      maxGroupsPerOrganiser: Number(d.maxGroupsPerOrganiser ?? def.maxGroupsPerOrganiser),
      defaultMaxParticipants: Number(d.defaultMaxParticipants ?? def.defaultMaxParticipants),
      permittedBudgetMin: Number(d.permittedBudgetMin ?? def.permittedBudgetMin),
      permittedBudgetMax: Number(d.permittedBudgetMax ?? def.permittedBudgetMax),
      defaultTimezone: String(d.defaultTimezone || def.defaultTimezone),
      defaultCurrency: (d.defaultCurrency as GroupCurrency) || def.defaultCurrency,
      allowDiscoverableGroups:
        d.allowDiscoverableGroups === undefined ? true : Boolean(d.allowDiscoverableGroups),
      globalGamesEnabled: {
        ...def.globalGamesEnabled,
        ...(typeof d.globalGamesEnabled === 'object' && d.globalGamesEnabled
          ? (d.globalGamesEnabled as Partial<PlatformConfig['globalGamesEnabled']>)
          : {}),
      },
      updatedBy: String(d.updatedBy || def.updatedBy),
      updatedAt: toDateSafe(d.updatedAt, new Date()),
    };
  } catch {
    return buildDefaultPlatformConfig();
  }
}

export async function savePlatformConfig(
  actor: PlatformUser,
  config: Omit<PlatformConfig, 'id' | 'updatedBy' | 'updatedAt'>
): Promise<void> {
  if (actor.role !== 'ADMIN') {
    throw new Error('Only Supreme Santa Admins can update platform-wide settings.');
  }
  try {
    await setDoc(doc(db, 'platformConfig', 'global'), {
      maxGroupsPerOrganiser: Math.max(1, Math.min(100, Math.round(config.maxGroupsPerOrganiser))),
      defaultMaxParticipants: Math.max(2, Math.min(500, Math.round(config.defaultMaxParticipants))),
      permittedBudgetMin: Math.max(0, Math.round(config.permittedBudgetMin)),
      permittedBudgetMax: Math.max(
        Math.round(config.permittedBudgetMin),
        Math.round(config.permittedBudgetMax)
      ),
      defaultTimezone: config.defaultTimezone.trim().slice(0, 64) || 'Asia/Kolkata',
      defaultCurrency: config.defaultCurrency,
      allowDiscoverableGroups: Boolean(config.allowDiscoverableGroups),
      globalGamesEnabled: config.globalGamesEnabled,
      updatedBy: actor.email.slice(0, 160),
      updatedAt: serverTimestamp(),
    });
    await appendAuditLogs({
      groupId: '',
      action: 'PLATFORM_CONFIG_UPDATED',
      actor,
      targetType: 'config',
      targetId: 'global',
      targetLabel: 'Platform Configuration',
      reason: 'Updated global Secret Santa platform defaults and limits.',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'platformConfig/global');
  }
}

export async function listPlatformAuditLogs(): Promise<PlatformAuditLog[]> {
  try {
    const snap = await getDocs(collection(db, 'platformAuditLogs'));
    return snap.docs
      .map((d) => mapAuditLog(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 150);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'platformAuditLogs');
  }
}

export async function listGroupAuditLogs(groupId: string): Promise<PlatformAuditLog[]> {
  try {
    const snap = await getDocs(collection(db, 'groups', groupId, 'auditLogs'));
    return snap.docs
      .map((d) => mapAuditLog(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `groups/${groupId}/auditLogs`);
  }
}

/**
 * Aggregate Delivery Overview for Organisers/Admins (strictly aggregate counts — ZERO sender/recipient identities).
 */
export async function fetchGroupAggregateDeliveryOverview(groupId: string): Promise<{
  totalMembers: number;
  profilesComplete: number;
  addressesComplete: number;
  dispatchedCount: number;
  deliveredCount: number;
  receivedCount: number;
  problemCount: number;
}> {
  const members = (await listGroupMembers(groupId)).filter((m) => m.status === 'JOINED');
  let dispatchedCount = 0;
  let deliveredCount = 0;
  let receivedCount = 0;
  let problemCount = 0;

  try {
    const [progSnap, ackSnap] = await Promise.all([
      getDocs(query(collection(db, 'deliveryProgress'), where('eventId', '==', groupId))),
      getDocs(query(collection(db, 'deliveryAcknowledgments'), where('eventId', '==', groupId))),
    ]);
    progSnap.docs.forEach((d) => {
      const stage = String(d.data().stage || '');
      if (stage === 'dispatched' || stage === 'delivered') dispatchedCount++;
      if (stage === 'delivered') deliveredCount++;
    });
    ackSnap.docs.forEach((d) => {
      const st = String(d.data().status || '');
      if (st === 'received') receivedCount++;
      if (st === 'problem') problemCount++;
    });
  } catch {
    // Organiser may not have list access to deliveryProgress if non-Admin; gracefully fall back to member flags
    dispatchedCount = members.filter((m) => m.deliveryDispatched).length;
  }

  return {
    totalMembers: members.length,
    profilesComplete: members.filter((m) => m.profileComplete).length,
    addressesComplete: members.filter((m) => m.addressComplete).length,
    dispatchedCount,
    deliveredCount,
    receivedCount,
    problemCount,
  };
}

// =========================================================================
// Multi-Group Participant Session Index (enables joining & switching across
// multiple Secret Santa groups cleanly in one browser session)
// =========================================================================

export function readSavedParticipantGroups(): ParticipantGroupSummary[] {
  try {
    const raw = window.sessionStorage.getItem(PARTICIPANT_GROUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<
      Omit<ParticipantGroupSummary, 'recipientRevealAt' | 'senderRevealAt' | 'joinedAt'> & {
        recipientRevealAt: string;
        senderRevealAt: string | null;
        joinedAt: string;
      }
    >;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      recipientRevealAt: new Date(item.recipientRevealAt),
      senderRevealAt: item.senderRevealAt ? new Date(item.senderRevealAt) : null,
      joinedAt: new Date(item.joinedAt),
    }));
  } catch {
    return [];
  }
}

export function saveParticipantGroupSession(summary: ParticipantGroupSummary): ParticipantGroupSummary[] {
  const existing = readSavedParticipantGroups().filter((g) => g.groupId !== summary.groupId);
  const next = [summary, ...existing].slice(0, 20);
  try {
    window.sessionStorage.setItem(PARTICIPANT_GROUPS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

export function removeParticipantGroupSession(groupId: string): ParticipantGroupSummary[] {
  const next = readSavedParticipantGroups().filter((g) => g.groupId !== groupId);
  try {
    window.sessionStorage.setItem(PARTICIPANT_GROUPS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
