import type {
  GroupLifecycleStatus,
  GroupManagementGrant,
  GroupPermission,
  PairingExclusion,
  PlatformRole,
  PlatformUser,
  SantaGroup,
} from '../types/rbac.ts';

export const LIFECYCLE_ORDER: GroupLifecycleStatus[] = [
  'DRAFT',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'MATCHED',
  'RECIPIENT_REVEAL_OPEN',
  'GIFT_EXCHANGE',
  'COMPLETED_ARCHIVED',
];

export const LIFECYCLE_LABELS: Record<
  GroupLifecycleStatus,
  { label: string; shortLabel: string; description: string }
> = {
  DRAFT: {
    label: 'Draft',
    shortLabel: 'Draft',
    description: 'Organiser configures budget, dates, and rules',
  },
  REGISTRATION_OPEN: {
    label: 'Registration Open',
    shortLabel: 'Registration open',
    description: 'Participants join using invitation links',
  },
  REGISTRATION_CLOSED: {
    label: 'Registration Closed',
    shortLabel: 'Registration closed',
    description: 'Membership locked and ready for matching',
  },
  MATCHED: {
    label: 'Matched',
    shortLabel: 'Reveal coming soon',
    description: 'Secret Santa assignments securely generated',
  },
  RECIPIENT_REVEAL_OPEN: {
    label: 'Recipient Reveal Open',
    shortLabel: 'Recipient revealed',
    description: 'Participants scratch & discover whom they are gifting',
  },
  GIFT_EXCHANGE: {
    label: 'Gift Exchange & Delivery',
    shortLabel: 'Gift exchange',
    description: 'Anonymous mailbox, sleigh updates, and thank-you cards active',
  },
  COMPLETED_ARCHIVED: {
    label: 'Completed / Archived',
    shortLabel: 'Archived',
    description: 'Read-only archive with memories and achievements',
  },
};

export const ROLE_META: Record<
  PlatformRole,
  { title: string; badge: string; emoji: string; summary: string }
> = {
  ADMIN: {
    title: 'Admin — Supreme Santa',
    badge: 'Supreme Santa',
    emoji: '🎅',
    summary: 'Platform-wide access, role assignment, and all groups',
  },
  ORGANISER: {
    title: 'Organiser — Head Elf',
    badge: 'Head Elf',
    emoji: '🧝',
    summary: 'Creates and manages authorized Secret Santa groups',
  },
  PARTICIPANT: {
    title: 'Participant — Secret Santa',
    badge: 'Secret Santa',
    emoji: '🎁',
    summary: 'Joins groups, exchanges gifts, and plays workshop games',
  },
};

/**
 * Pure authorization policy check mirroring backend & Firestore rules.
 * Platform role and group membership/grant are strictly evaluated separately.
 */
export function canManageGroupPolicy(
  user: Pick<PlatformUser, 'id' | 'role' | 'status'> | null | undefined,
  grant: Pick<GroupManagementGrant, 'groupId' | 'userId' | 'role' | 'active'> | null | undefined,
  groupId: string
): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'ORGANISER') return false;
  if (!grant) return false;
  return (
    grant.active === true &&
    grant.groupId === groupId &&
    grant.userId === user.id &&
    (grant.role === 'OWNER' || grant.role === 'MANAGER')
  );
}

/**
 * Evaluates a granular group management permission (GROUP_EDIT, INVITE_MANAGE, etc.).
 */
export function hasGroupPermissionPolicy(
  user: Pick<PlatformUser, 'id' | 'role' | 'status'> | null | undefined,
  grant:
    | Pick<GroupManagementGrant, 'groupId' | 'userId' | 'role' | 'active' | 'permissions'>
    | null
    | undefined,
  groupId: string,
  permission: GroupPermission
): boolean {
  if (!user || user.status !== 'ACTIVE') return false;
  if (user.role === 'ADMIN') return true;
  if (!canManageGroupPolicy(user, grant, groupId)) return false;
  return Boolean(grant?.permissions.includes(permission));
}

/**
 * Prevents accidentally demoting or suspending the platform's last active Admin.
 */
export function canModifyAdminAccount(
  allUsers: Pick<PlatformUser, 'id' | 'role' | 'status'>[],
  targetUserId: string,
  nextRole: PlatformRole,
  nextStatus: 'ACTIVE' | 'SUSPENDED'
): { allowed: boolean; reason?: string } {
  const target = allUsers.find((u) => u.id === targetUserId);
  if (!target) {
    return { allowed: false, reason: 'Target user not found.' };
  }
  const currentlyActiveAdmin = target.role === 'ADMIN' && target.status === 'ACTIVE';
  const remainsActiveAdmin = nextRole === 'ADMIN' && nextStatus === 'ACTIVE';

  if (currentlyActiveAdmin && !remainsActiveAdmin) {
    const otherActiveAdmins = allUsers.filter(
      (u) => u.id !== targetUserId && u.role === 'ADMIN' && u.status === 'ACTIVE'
    );
    if (otherActiveAdmins.length === 0) {
      return {
        allowed: false,
        reason: 'Cannot demote or suspend the last active Supreme Santa Admin on the platform.',
      };
    }
  }
  return { allowed: true };
}

const ALLOWED_TRANSITIONS: Record<GroupLifecycleStatus, GroupLifecycleStatus[]> = {
  DRAFT: ['REGISTRATION_OPEN', 'COMPLETED_ARCHIVED'],
  REGISTRATION_OPEN: ['REGISTRATION_CLOSED', 'DRAFT', 'COMPLETED_ARCHIVED'],
  REGISTRATION_CLOSED: ['REGISTRATION_OPEN', 'MATCHED', 'COMPLETED_ARCHIVED'],
  MATCHED: ['RECIPIENT_REVEAL_OPEN', 'GIFT_EXCHANGE', 'COMPLETED_ARCHIVED'],
  RECIPIENT_REVEAL_OPEN: ['GIFT_EXCHANGE', 'COMPLETED_ARCHIVED'],
  GIFT_EXCHANGE: ['COMPLETED_ARCHIVED'],
  COMPLETED_ARCHIVED: [],
};

/**
 * Validates group lifecycle state machine transitions.
 * Admins may also reopen/archive or run emergency rollback transitions when explicitly audited.
 */
export function canTransitionGroupLifecycle(
  current: GroupLifecycleStatus,
  next: GroupLifecycleStatus,
  actorRole: PlatformRole,
  ctx?: { joinedParticipantCount?: number; isMatched?: boolean }
): { ok: boolean; reason?: string } {
  if (current === next) return { ok: true };

  if (next === 'MATCHED') {
    const count = ctx?.joinedParticipantCount ?? 0;
    if (count < 2) {
      return {
        ok: false,
        reason: 'At least 2 joined participants are required before matching.',
      };
    }
  }

  if (current === 'COMPLETED_ARCHIVED' && actorRole !== 'ADMIN') {
    return {
      ok: false,
      reason: 'Archived groups are read-only. Only a Supreme Santa Admin can reopen them.',
    };
  }

  // Organisers cannot roll back MATCHED/REVEAL states without Admin approval
  if (
    actorRole === 'ORGANISER' &&
    ['MATCHED', 'RECIPIENT_REVEAL_OPEN', 'GIFT_EXCHANGE'].includes(current) &&
    ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(next)
  ) {
    return {
      ok: false,
      reason: 'Resetting or rolling back a matched group requires Admin approval.',
    };
  }

  if (actorRole === 'ADMIN') {
    return { ok: true };
  }

  const allowed = ALLOWED_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    return {
      ok: false,
      reason: `Cannot move group directly from ${LIFECYCLE_LABELS[current].label} to ${LIFECYCLE_LABELS[next].label}.`,
    };
  }

  return { ok: true };
}

/**
 * Determines whether a participant can self-leave a group according to Section 5 rules.
 */
export function evaluateParticipantLeavePolicy(params: {
  groupStatus: GroupLifecycleStatus;
  isMatched: boolean;
  deliveryDispatched: boolean;
}): {
  canSelfLeave: boolean;
  resultingStatus: 'WITHDRAWN' | 'RETAINED_COMPLETED' | 'REQUIRES_ORGANISER';
  message: string;
} {
  if (params.deliveryDispatched) {
    return {
      canSelfLeave: false,
      resultingStatus: 'RETAINED_COMPLETED',
      message:
        'A gift has already been dispatched for this exchange. Your membership is retained in history so delivery records and thank-you acknowledgments stay intact.',
    };
  }

  if (
    params.isMatched ||
    ['MATCHED', 'RECIPIENT_REVEAL_OPEN', 'GIFT_EXCHANGE', 'COMPLETED_ARCHIVED'].includes(
      params.groupStatus
    )
  ) {
    return {
      canSelfLeave: false,
      resultingStatus: 'REQUIRES_ORGANISER',
      message:
        'Matching has already been completed for this group. Please contact your Head Elf Organiser or Admin so assignments can be handled safely.',
    };
  }

  return {
    canSelfLeave: true,
    resultingStatus: 'WITHDRAWN',
    message: 'You can leave this group freely before matching starts.',
  };
}

/**
 * Generates a URL-safe slug for a Santa Group (e.g. "Christmas Chaos 2026" -> "christmas-chaos-2026").
 */
export function slugifyGroupName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'santa-group';
}

/**
 * Builds the Group Invitation Link: /g/{slug}/invite?code={inviteCode}
 * Identifies the group without auto-authenticating as any existing participant.
 */
export function buildGroupInviteUrl(origin: string, slug: string, inviteCode: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/g/${encodeURIComponent(slug)}/invite?code=${encodeURIComponent(inviteCode)}`;
}

/**
 * Builds the Personal Account Invitation Link: /join?token={rawToken}
 */
export function buildPersonalInviteUrl(origin: string, rawToken: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/join?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Parses incoming invite URL paths and query strings for both:
 * 1. Group invite link: /g/{slug}/invite?code={code}
 * 2. Personal invite link: /join?token={token} or /?token={token}
 */
export function parseIncomingInviteLocation(
  pathname: string,
  search: string
):
  | { kind: 'personal'; token: string }
  | { kind: 'group'; slug: string; code: string }
  | { kind: 'none' } {
  const params = new URLSearchParams(search);
  const rawToken = params.get('token')?.trim();
  if (rawToken) {
    return { kind: 'personal', token: rawToken };
  }

  const groupPathMatch = pathname.match(/^\/g\/([a-zA-Z0-9_-]+)\/invite\/?$/);
  const code = params.get('code')?.trim() || '';
  if (groupPathMatch && code) {
    return { kind: 'group', slug: groupPathMatch[1], code };
  }

  const groupSlugParam = params.get('group')?.trim();
  if (groupSlugParam && code) {
    return { kind: 'group', slug: groupSlugParam, code };
  }

  return { kind: 'none' };
}

/**
 * Computes an unbiased valid Secret Santa derangement respecting optional pairing exclusions
 * (e.g. partners or close teammates who shouldn't draw each other).
 * Uses randomized backtracking search over valid bipartite matchings so small & medium groups
 * always find an exact solution if one exists, or report an explicit unsatisfiable error.
 */
export function generateConstrainedDerangement<T extends { id: string; name: string }>(
  participants: T[],
  exclusions: PairingExclusion[],
  randomFn: () => number = Math.random
): { ok: true; recipients: T[] } | { ok: false; error: string } {
  const n = participants.length;
  if (n < 2) {
    return { ok: false, error: 'At least 2 joined participants are required for matching.' };
  }

  // Build exclusion lookup (symmetric by normalized name or ID)
  const forbidden = new Set<string>();
  const norm = (s: string) => s.trim().toLowerCase();
  for (const ex of exclusions) {
    const a = norm(ex.memberA);
    const b = norm(ex.memberB);
    if (!a || !b || a === b) continue;
    forbidden.add(`${a}::${b}`);
    forbidden.add(`${b}::${a}`);
  }

  const isAllowed = (giver: T, recipient: T): boolean => {
    if (giver.id === recipient.id) return false;
    const ga = norm(giver.name);
    const rb = norm(recipient.name);
    if (forbidden.has(`${ga}::${rb}`)) return false;
    if (forbidden.has(`${norm(giver.id)}::${norm(recipient.id)}`)) return false;
    return true;
  };

  // Precompute valid candidate recipient indices per giver, shuffled randomly
  const candidates: number[][] = participants.map((giver) => {
    const list: number[] = [];
    for (let j = 0; j < n; j++) {
      if (isAllowed(giver, participants[j])) {
        list.push(j);
      }
    }
    // Fisher-Yates shuffle for unbiased selection
    for (let k = list.length - 1; k > 0; k--) {
      const r = Math.floor(randomFn() * (k + 1));
      [list[k], list[r]] = [list[r], list[k]];
    }
    return list;
  });

  // Fail fast if any participant has zero allowed recipients
  for (let i = 0; i < n; i++) {
    if (candidates[i].length === 0) {
      return {
        ok: false,
        error: `Pairing exclusions leave no valid match for ${participants[i].name}. Remove or relax an exclusion rule.`,
      };
    }
  }

  // Order givers by most-constrained-first (MRV heuristic) for fast exact solving
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => candidates[a].length - candidates[b].length
  );

  const assigned = new Array<number>(n).fill(-1);
  const usedRecipient = new Array<boolean>(n).fill(false);
  let steps = 0;
  const MAX_STEPS = 50_000;

  const backtrack = (pos: number): boolean => {
    if (pos === n) return true;
    if (++steps > MAX_STEPS) return false;
    const giverIdx = order[pos];
    for (const recIdx of candidates[giverIdx]) {
      if (usedRecipient[recIdx]) continue;
      assigned[giverIdx] = recIdx;
      usedRecipient[recIdx] = true;
      if (backtrack(pos + 1)) return true;
      usedRecipient[recIdx] = false;
      assigned[giverIdx] = -1;
    }
    return false;
  };

  if (!backtrack(0)) {
    return {
      ok: false,
      error:
        'No valid Secret Santa pairing satisfies all current exclusion rules. Please relax one or more pairing exclusions.',
    };
  }

  return {
    ok: true,
    recipients: assigned.map((idx) => participants[idx]),
  };
}

/**
 * Helper to derive a friendly status badge label for Participant "My Christmas Groups" cards.
 */
export function getParticipantGroupStatusLabel(
  group: Pick<SantaGroup, 'status' | 'isMatched' | 'recipientRevealAt'>,
  now: Date = new Date()
): string {
  if (group.status === 'COMPLETED_ARCHIVED') return 'Archived · Memories';
  if (group.status === 'GIFT_EXCHANGE') return 'Gift exchange active';
  if (group.status === 'RECIPIENT_REVEAL_OPEN') return 'Recipient revealed';
  if (group.isMatched || group.status === 'MATCHED') {
    return now >= group.recipientRevealAt ? 'Recipient revealed' : 'Reveal coming soon';
  }
  if (group.status === 'REGISTRATION_CLOSED') return 'Registration closed';
  if (group.status === 'DRAFT') return 'Setting up';
  return 'Registration open';
}

export function currencySymbolFromCode(code: string): string {
  if (code === 'USD' || code === '$') return '$';
  if (code === 'GBP' || code === '£') return '£';
  return '₹';
}
