import { describe, expect, it } from 'vitest';
import {
  buildGroupInviteUrl,
  buildPersonalInviteUrl,
  canManageGroupPolicy,
  canModifyAdminAccount,
  canTransitionGroupLifecycle,
  evaluateParticipantLeavePolicy,
  generateConstrainedDerangement,
  hasGroupPermissionPolicy,
  parseIncomingInviteLocation,
  slugifyGroupName,
} from '../rbacLogic';
import type { GroupManagementGrant, PlatformUser } from '../../types/rbac';

describe('rbacLogic — Three-Role Access Control & Group Lifecycle', () => {
  const admin: Pick<PlatformUser, 'id' | 'role' | 'status'> = {
    id: 'uid-admin',
    role: 'ADMIN',
    status: 'ACTIVE',
  };
  const organiserA: Pick<PlatformUser, 'id' | 'role' | 'status'> = {
    id: 'uid-org-a',
    role: 'ORGANISER',
    status: 'ACTIVE',
  };
  const suspendedOrganiser: Pick<PlatformUser, 'id' | 'role' | 'status'> = {
    id: 'uid-org-b',
    role: 'ORGANISER',
    status: 'SUSPENDED',
  };
  const participant: Pick<PlatformUser, 'id' | 'role' | 'status'> = {
    id: 'uid-part',
    role: 'PARTICIPANT',
    status: 'ACTIVE',
  };

  const grantForA: Pick<
    GroupManagementGrant,
    'groupId' | 'userId' | 'role' | 'active' | 'permissions'
  > = {
    groupId: 'grp-alpha',
    userId: 'uid-org-a',
    role: 'OWNER',
    active: true,
    permissions: ['GROUP_EDIT', 'INVITE_MANAGE', 'MATCH_EXECUTE'],
  };

  it('enforces platform role + group grant separation', () => {
    expect(canManageGroupPolicy(admin, null, 'grp-any')).toBe(true);
    expect(canManageGroupPolicy(organiserA, grantForA, 'grp-alpha')).toBe(true);
    expect(canManageGroupPolicy(organiserA, grantForA, 'grp-beta')).toBe(false);
    expect(
      canManageGroupPolicy(organiserA, { ...grantForA, active: false }, 'grp-alpha')
    ).toBe(false);
    expect(canManageGroupPolicy(suspendedOrganiser, grantForA, 'grp-alpha')).toBe(false);
    expect(
      canManageGroupPolicy(
        participant,
        { ...grantForA, userId: 'uid-part' },
        'grp-alpha'
      )
    ).toBe(false);
  });

  it('evaluates granular group permissions for Co-organiser support', () => {
    expect(hasGroupPermissionPolicy(admin, null, 'grp-alpha', 'DELIVERY_MONITOR')).toBe(true);
    expect(hasGroupPermissionPolicy(organiserA, grantForA, 'grp-alpha', 'MATCH_EXECUTE')).toBe(true);
    expect(hasGroupPermissionPolicy(organiserA, grantForA, 'grp-alpha', 'DELIVERY_MONITOR')).toBe(
      false
    );
  });

  it('blocks demoting or suspending the last active Admin', () => {
    const onlyOneAdmin = [admin, organiserA, participant];
    expect(canModifyAdminAccount(onlyOneAdmin, 'uid-admin', 'ORGANISER', 'ACTIVE').allowed).toBe(
      false
    );
    expect(canModifyAdminAccount(onlyOneAdmin, 'uid-admin', 'ADMIN', 'SUSPENDED').allowed).toBe(
      false
    );

    const twoAdmins = [
      admin,
      { id: 'uid-admin-2', role: 'ADMIN' as const, status: 'ACTIVE' as const },
    ];
    expect(canModifyAdminAccount(twoAdmins, 'uid-admin', 'ORGANISER', 'ACTIVE').allowed).toBe(true);
  });

  it('enforces group lifecycle state machine rules', () => {
    expect(
      canTransitionGroupLifecycle('DRAFT', 'REGISTRATION_OPEN', 'ORGANISER').ok
    ).toBe(true);
    expect(
      canTransitionGroupLifecycle('REGISTRATION_CLOSED', 'MATCHED', 'ORGANISER', {
        joinedParticipantCount: 1,
      }).ok
    ).toBe(false);
    expect(
      canTransitionGroupLifecycle('REGISTRATION_CLOSED', 'MATCHED', 'ORGANISER', {
        joinedParticipantCount: 3,
      }).ok
    ).toBe(true);
    // Organiser cannot roll back after matching without Admin approval
    expect(
      canTransitionGroupLifecycle('MATCHED', 'REGISTRATION_OPEN', 'ORGANISER').ok
    ).toBe(false);
    expect(canTransitionGroupLifecycle('MATCHED', 'REGISTRATION_OPEN', 'ADMIN').ok).toBe(true);
    // Archived groups are read-only for Organisers
    expect(
      canTransitionGroupLifecycle('COMPLETED_ARCHIVED', 'GIFT_EXCHANGE', 'ORGANISER').ok
    ).toBe(false);
  });

  it('enforces leave-group rules before match, after match, and after dispatch', () => {
    expect(
      evaluateParticipantLeavePolicy({
        groupStatus: 'REGISTRATION_OPEN',
        isMatched: false,
        deliveryDispatched: false,
      }).canSelfLeave
    ).toBe(true);

    const afterMatch = evaluateParticipantLeavePolicy({
      groupStatus: 'MATCHED',
      isMatched: true,
      deliveryDispatched: false,
    });
    expect(afterMatch.canSelfLeave).toBe(false);
    expect(afterMatch.resultingStatus).toBe('REQUIRES_ORGANISER');

    const afterDispatch = evaluateParticipantLeavePolicy({
      groupStatus: 'GIFT_EXCHANGE',
      isMatched: true,
      deliveryDispatched: true,
    });
    expect(afterDispatch.canSelfLeave).toBe(false);
    expect(afterDispatch.resultingStatus).toBe('RETAINED_COMPLETED');
  });

  it('builds and parses both group invite links and personal invite links', () => {
    const slug = slugifyGroupName('Christmas Chaos 2026!');
    expect(slug).toBe('christmas-chaos-2026');

    const grpUrl = new URL(buildGroupInviteUrl('https://santa.app', slug, 'CODE1234'));
    expect(grpUrl.pathname).toBe('/g/christmas-chaos-2026/invite');
    expect(parseIncomingInviteLocation(grpUrl.pathname, grpUrl.search)).toEqual({
      kind: 'group',
      slug: 'christmas-chaos-2026',
      code: 'CODE1234',
    });

    const personalUrl = new URL(buildPersonalInviteUrl('https://santa.app', 'abc123token'));
    expect(personalUrl.pathname).toBe('/join');
    expect(parseIncomingInviteLocation(personalUrl.pathname, personalUrl.search)).toEqual({
      kind: 'personal',
      token: 'abc123token',
    });
  });

  it('generates valid derangements respecting pairing exclusions and detects unsatisfiable constraints', () => {
    const people = [
      { id: '1', name: 'Meera' },
      { id: '2', name: 'Aarav' },
      { id: '3', name: 'Ananya' },
      { id: '4', name: 'Kabir' },
    ];
    const exclusions = [{ id: 'ex-1', memberA: 'Meera', memberB: 'Aarav' }];

    const res = generateConstrainedDerangement(people, exclusions);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.recipients.length).toBe(4);
      res.recipients.forEach((rec, i) => {
        expect(rec.id).not.toBe(people[i].id);
        const pair = `${people[i].name}::${rec.name}`;
        expect(pair).not.toBe('Meera::Aarav');
        expect(pair).not.toBe('Aarav::Meera');
      });
    }

    // Unsatisfiable 2-person exclusion
    const impossible = generateConstrainedDerangement(
      [
        { id: '1', name: 'Meera' },
        { id: '2', name: 'Aarav' },
      ],
      [{ id: 'ex-1', memberA: 'Meera', memberB: 'Aarav' }]
    );
    expect(impossible.ok).toBe(false);
  });
});
