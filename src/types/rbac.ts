import type { GiftBudgetConfig, ThemeId } from './secretSanta';

export type PlatformRole = 'ADMIN' | 'ORGANISER' | 'PARTICIPANT';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export type GroupManagementRole = 'OWNER' | 'MANAGER';

export type GroupMemberStatus = 'INVITED' | 'JOINED' | 'WITHDRAWN' | 'REMOVED';

export type GroupVisibility = 'private' | 'discoverable';

export type GiftExchangeMode = 'delivery' | 'in-person' | 'hybrid';

export type GroupCurrency = 'INR' | 'USD' | 'GBP';

export type GroupLifecycleStatus =
  | 'DRAFT'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'MATCHED'
  | 'RECIPIENT_REVEAL_OPEN'
  | 'GIFT_EXCHANGE'
  | 'COMPLETED_ARCHIVED';

export type GroupPermission =
  | 'GROUP_EDIT'
  | 'INVITE_MANAGE'
  | 'MEMBER_MANAGE'
  | 'SCHEDULE_MANAGE'
  | 'MATCH_EXECUTE'
  | 'GAME_MANAGE'
  | 'ANNOUNCEMENT_SEND'
  | 'DELIVERY_MONITOR';

export const ALL_GROUP_PERMISSIONS: GroupPermission[] = [
  'GROUP_EDIT',
  'INVITE_MANAGE',
  'MEMBER_MANAGE',
  'SCHEDULE_MANAGE',
  'MATCH_EXECUTE',
  'GAME_MANAGE',
  'ANNOUNCEMENT_SEND',
  'DELIVERY_MONITOR',
];

export const GROUP_PERMISSION_LABELS: Record<
  GroupPermission,
  { label: string; description: string }
> = {
  GROUP_EDIT: {
    label: 'Edit Group Settings',
    description: 'Update name, theme, visibility, budget, and exchange details',
  },
  INVITE_MANAGE: {
    label: 'Manage Invitations',
    description: 'Generate, copy, regenerate, and revoke group & personal links',
  },
  MEMBER_MANAGE: {
    label: 'Manage Participants',
    description: 'Approve join requests, view readiness, and remove members pre-match',
  },
  SCHEDULE_MANAGE: {
    label: 'Schedule & Deadlines',
    description: 'Set registration, matching, reveal, and gift exchange times',
  },
  MATCH_EXECUTE: {
    label: 'Execute Matching',
    description: 'Run Secret Santa assignment matching when eligible',
  },
  GAME_MANAGE: {
    label: 'Configure Games',
    description: 'Enable/disable workshop games & Gingerbread Showdown deadlines',
  },
  ANNOUNCEMENT_SEND: {
    label: 'Send Announcements',
    description: 'Post group announcements and participant reminders',
  },
  DELIVERY_MONITOR: {
    label: 'Delivery Overview',
    description: 'Monitor aggregate gift dispatch and receipt counts',
  },
};

export interface PlatformUser {
  id: string; // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  role: PlatformRole;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PairingExclusion {
  id: string;
  memberA: string;
  memberB: string;
  reason?: string;
}

export interface GroupGamesConfig {
  mailboxEnabled: boolean;
  guessingEnabled: boolean;
  maxGuesses: number;
  adventEnabled: boolean;
  wheelEnabled: boolean;
  elfChallengeEnabled: boolean;
  quizEnabled: boolean;
  gingerbreadShowdownEnabled: boolean;
  gingerbreadSubmissionDeadline?: Date | null;
  gingerbreadVotingDeadline?: Date | null;
  santaStarsReward: number;
  deliveryTrackingEnabled: boolean;
  thankYouEnabled: boolean;
  snowGlobeRevealEnabled: boolean;
}

export interface SantaGroup {
  id: string;
  slug: string;
  name: string;
  description: string;
  theme: ThemeId;
  visibility: GroupVisibility;
  maxParticipants: number;
  budget: GiftBudgetConfig & { currencyCode?: GroupCurrency };
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
  inviteCode: string;
  inviteCodeRevokedAt: Date | null;
  status: GroupLifecycleStatus;
  createdBy: string;
  ownerId: string;
  ownerDisplayName: string;
  memberCount: number;
  invitedCount: number;
  isMatched: boolean;
  matchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupManagementGrant {
  id: string; // userId
  groupId: string;
  groupName?: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  role: GroupManagementRole;
  permissions: GroupPermission[];
  grantedBy: string;
  grantedAt: Date;
  revokedAt: Date | null;
  active: boolean;
}

export interface GroupMembership {
  id: string; // participantKey or userId
  groupId: string;
  userId: string; // Auth UID if signed-in, else ''
  participantKey: string;
  displayName: string;
  avatarId: string;
  status: GroupMemberStatus;
  profileComplete: boolean;
  addressComplete: boolean;
  deliveryDispatched: boolean;
  joinedAt: Date | null;
  withdrawnAt: Date | null;
  updatedAt: Date;
}

export interface GroupJoinRequest {
  id: string;
  groupId: string;
  userId: string;
  requesterName: string;
  requesterEmail: string;
  note: string;
  status: 'pending' | 'approved' | 'declined';
  reviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupAnnouncement {
  id: string;
  groupId: string;
  title: string;
  body: string;
  kind: 'announcement' | 'reminder';
  authorUid: string;
  authorName: string;
  authorRole: PlatformRole;
  createdAt: Date;
}

export type AuditActionType =
  | 'USER_PROMOTED_ORGANISER'
  | 'USER_REVOKED_ORGANISER'
  | 'USER_SUSPENDED'
  | 'USER_REACTIVATED'
  | 'GRANT_ADDED'
  | 'GRANT_UPDATED'
  | 'GRANT_REVOKED'
  | 'OWNERSHIP_TRANSFERRED'
  | 'GROUP_CREATED'
  | 'GROUP_UPDATED'
  | 'GROUP_LIFECYCLE_CHANGED'
  | 'GROUP_ARCHIVED'
  | 'GROUP_DELETED'
  | 'GROUP_DUPLICATED'
  | 'INVITE_CREATED'
  | 'INVITE_REVOKED'
  | 'INVITE_REGENERATED'
  | 'MEMBER_APPROVED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_WITHDRAWN'
  | 'MATCH_TRIGGERED'
  | 'MATCH_RESET_APPROVED'
  | 'BREAK_GLASS_ASSIGNMENT_VIEW'
  | 'PLATFORM_CONFIG_UPDATED'
  | 'ANNOUNCEMENT_POSTED'
  | 'REMINDER_SENT';

export interface PlatformAuditLog {
  id: string;
  groupId: string; // '' for platform-wide logs
  action: AuditActionType;
  actorUid: string;
  actorEmail: string;
  actorRole: PlatformRole;
  targetType: 'user' | 'group' | 'grant' | 'invitation' | 'member' | 'assignment' | 'config';
  targetId: string;
  targetLabel: string;
  reason: string;
  createdAt: Date;
}

export interface PlatformConfig {
  id: 'global';
  maxGroupsPerOrganiser: number;
  defaultMaxParticipants: number;
  permittedBudgetMin: number;
  permittedBudgetMax: number;
  defaultTimezone: string;
  defaultCurrency: GroupCurrency;
  allowDiscoverableGroups: boolean;
  globalGamesEnabled: {
    mailbox: boolean;
    guessing: boolean;
    advent: boolean;
    wheel: boolean;
    elfChallenge: boolean;
    quiz: boolean;
    gingerbreadShowdown: boolean;
    deliveryTracking: boolean;
    thankYou: boolean;
    snowGlobe: boolean;
  };
  updatedBy: string;
  updatedAt: Date;
}

export interface ParticipantGroupSummary {
  groupId: string;
  slug: string;
  name: string;
  theme: ThemeId;
  status: GroupLifecycleStatus;
  participantKey: string;
  participantName: string;
  avatarId: string;
  isMatched: boolean;
  recipientRevealAt: Date;
  senderRevealAt: Date | null;
  joinedAt: Date;
}

export interface BreakGlassAssignmentRow {
  giverKey: string;
  giverName: string;
  recipientName: string;
  outgoingAssignmentId: string;
}
