import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  Ban,
  Check,
  ExternalLink,
  Eye,
  KeyRound,
  LayoutDashboard,
  Lock,
  Plus,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  ALL_GROUP_PERMISSIONS,
  BreakGlassAssignmentRow,
  GROUP_PERMISSION_LABELS,
  GroupCurrency,
  GroupManagementGrant,
  GroupPermission,
  PlatformAuditLog,
  PlatformConfig,
  PlatformRole,
  PlatformUser,
  SantaGroup,
} from '../../types/rbac';
import {
  breakGlassInspectAssignments,
  buildDefaultPlatformConfig,
  deleteSantaGroupAdmin,
  demoteAllOrganisersToParticipant,
  ensureDefaultEventSyncedToGroup,
  fetchPlatformConfig,
  grantOrUpdateGroupManager,
  listAllGroupsAdmin,
  listGroupManagementGrants,
  listPlatformAuditLogs,
  listPlatformUsers,
  promoteUserToOrganiser,
  registerOrPromoteUserByEmail,
  revokeGroupManager,
  revokeOrganiserRole,
  savePlatformConfig,
  setUserAccountStatus,
  setUserPlatformRole,
  transferGroupOwnership,
  updateSantaGroup,
} from '../../services/rbacService';
import { LIFECYCLE_LABELS, ROLE_META } from '../../utils/rbacLogic';
import { CreateGroupWizard } from '../organiser/CreateGroupWizard';
import { playChimeSound, playPopSound } from '../../utils/sound';

export type GovernanceTabId =
  | 'overview'
  | 'all-groups'
  | 'users-roles'
  | 'organiser-access'
  | 'system-settings'
  | 'audit-logs';

interface AdminGovernancePanelsProps {
  actor: PlatformUser;
  activeSubTab: GovernanceTabId;
  activeEventId: string;
  onSelectActiveGroup: (groupId: string) => void;
  onNotice: (msg: { type: 'ok' | 'err'; text: string }) => void;
}

const THEME_EMOJI: Record<SantaGroup['theme'], string> = {
  santa: '🎄',
  chocolate: '🍫',
  funny: '🤪',
};

export const AdminGovernancePanels: React.FC<AdminGovernancePanelsProps> = ({
  actor,
  activeSubTab,
  activeEventId,
  onSelectActiveGroup,
  onNotice,
}) => {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [groups, setGroups] = useState<SantaGroup[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(buildDefaultPlatformConfig);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Create Group inline wizard toggle
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  // Promotion Modal (Exact Head Elf prompt + optional initial group grants)
  const [promoteTarget, setPromoteTarget] = useState<PlatformUser | null>(null);
  const [promoteInitialGroupIds, setPromoteInitialGroupIds] = useState<string[]>([]);

  // Ownership transfer modal
  const [transferGroup, setTransferGroup] = useState<SantaGroup | null>(null);
  const [transferNewOwnerId, setTransferNewOwnerId] = useState('');

  // Break-Glass Audited Emergency Assignment Viewer
  const [breakGlassGroup, setBreakGlassGroup] = useState<SantaGroup | null>(null);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [breakGlassRows, setBreakGlassRows] = useState<BreakGlassAssignmentRow[] | null>(null);

  // Organiser Access (Granular group grants)
  const [accessGroupId, setAccessGroupId] = useState<string>(activeEventId);
  const [groupGrants, setGroupGrants] = useState<GroupManagementGrant[]>([]);
  const [grantTargetUserId, setGrantTargetUserId] = useState('');
  const [grantPermissions, setGrantPermissions] = useState<GroupPermission[]>([
    ...ALL_GROUP_PERMISSIONS,
  ]);

  // Search filter & Pre-register user form
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ORGANISER' | 'PARTICIPANT'>('ORGANISER');
  const [newUserGroupIds, setNewUserGroupIds] = useState<string[]>([]);
  const [confirmDemoteAllOrganisers, setConfirmDemoteAllOrganisers] = useState(false);

  const loadGovernanceData = useCallback(async () => {
    setLoading(true);
    try {
      await ensureDefaultEventSyncedToGroup(actor).catch(() => null);
      const [uList, gList, logs, cfg] = await Promise.all([
        listPlatformUsers().catch(() => []),
        listAllGroupsAdmin().catch(() => []),
        listPlatformAuditLogs().catch(() => []),
        fetchPlatformConfig().catch(() => buildDefaultPlatformConfig()),
      ]);
      setUsers(uList);
      setGroups(gList);
      setAuditLogs(logs);
      setPlatformConfig(cfg);
      setAccessGroupId((prev) => {
        if (prev && gList.some((g) => g.id === prev)) return prev;
        return gList[0]?.id || '';
      });
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    void loadGovernanceData();
  }, [loadGovernanceData]);

  const loadGrantsForGroup = useCallback(async (gid: string) => {
    if (!gid) {
      setGroupGrants([]);
      return;
    }
    try {
      const list = await listGroupManagementGrants(gid);
      setGroupGrants(list);
    } catch {
      setGroupGrants([]);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'organiser-access' && accessGroupId) {
      void loadGrantsForGroup(accessGroupId);
    }
  }, [activeSubTab, accessGroupId, loadGrantsForGroup]);

  const handleConfirmPromote = async () => {
    if (!promoteTarget) return;
    setBusy(true);
    try {
      await promoteUserToOrganiser({
        actor,
        targetUser: promoteTarget,
        initialGroupIds: promoteInitialGroupIds,
        allGroups: groups,
      });
      playChimeSound();
      onNotice({
        type: 'ok',
        text: `${promoteTarget.displayName} is now a Head Elf Organiser 🧝${
          promoteInitialGroupIds.length > 0
            ? ` with management access to ${promoteInitialGroupIds.length} group(s)`
            : ''
        }.`,
      });
      setPromoteTarget(null);
      setPromoteInitialGroupIds([]);
      await loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not promote user.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeOrganiser = async (u: PlatformUser) => {
    setBusy(true);
    try {
      await revokeOrganiserRole({
        actor,
        targetUser: u,
        allUsers: users,
        allGroups: groups,
      });
      playPopSound();
      onNotice({
        type: 'ok',
        text: `Revoked Head Elf Organiser role for ${u.displayName}. Their ordinary participant memberships remain intact.`,
      });
      await loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not revoke Organiser role.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSuspend = async (u: PlatformUser) => {
    setBusy(true);
    const nextStatus = u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await setUserAccountStatus({
        actor,
        targetUser: u,
        allUsers: users,
        status: nextStatus,
      });
      playPopSound();
      onNotice({
        type: 'ok',
        text:
          nextStatus === 'SUSPENDED'
            ? `Suspended account for ${u.displayName}.`
            : `Reactivated account for ${u.displayName}.`,
      });
      await loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not update user status.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateOrPreRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;
    setBusy(true);
    try {
      const created = await registerOrPromoteUserByEmail({
        actor,
        email: newUserEmail,
        displayName: newUserName,
        role: newUserRole,
        initialGroupIds: newUserRole === 'ORGANISER' ? newUserGroupIds : [],
        allUsers: users,
        allGroups: groups,
      });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserGroupIds([]);
      playChimeSound();
      onNotice({
        type: 'ok',
        text:
          created.role === 'ORGANISER'
            ? `${created.displayName} (${created.email}) is now a Head Elf Organiser 🧝. When they sign in with Google, they will have immediate Organiser access.`
            : `Registered ${created.displayName} (${created.email}) as a Participant.`,
      });
      await loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not register or update user.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleChangeUserRole = async (u: PlatformUser, nextRole: PlatformRole) => {
    if (u.role === nextRole) return;
    setBusy(true);
    try {
      await setUserPlatformRole({
        actor,
        targetUser: u,
        nextRole,
        allUsers: users,
        allGroups: groups,
      });
      playPopSound();
      onNotice({
        type: 'ok',
        text: `Updated ${u.displayName}'s role to ${ROLE_META[nextRole].badge}.`,
      });
      await loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not change user role.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDemoteAllOrganisers = async () => {
    setBusy(true);
    try {
      const count = await demoteAllOrganisersToParticipant({
        actor,
        allUsers: users,
        allGroups: groups,
      });
      setConfirmDemoteAllOrganisers(false);
      playPopSound();
      onNotice({
        type: 'ok',
        text: `Changed ${count} Head Elf Organiser(s) back to Participant. Ordinary group memberships remain intact.`,
      });
      await loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not change Organisers to Participant.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRunBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakGlassGroup) return;
    setBusy(true);
    try {
      const rows = await breakGlassInspectAssignments({
        actor,
        group: breakGlassGroup,
        reason: breakGlassReason,
      });
      setBreakGlassRows(rows);
      playPopSound();
      onNotice({
        type: 'ok',
        text: `Audited break-glass assignment inspection logged for "${breakGlassGroup.name}".`,
      });
      void loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not run break-glass inspection.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferGroup || !transferNewOwnerId) return;
    const newOwner = users.find((u) => u.id === transferNewOwnerId);
    if (!newOwner) return;
    setBusy(true);
    try {
      await transferGroupOwnership({
        actor,
        group: transferGroup,
        newOwner,
      });
      playPopSound();
      onNotice({
        type: 'ok',
        text: `Transferred ownership of "${transferGroup.name}" to ${newOwner.displayName}.`,
      });
      setTransferGroup(null);
      setTransferNewOwnerId('');
      await loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not transfer ownership.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleGrantManager = async (e: React.FormEvent) => {
    e.preventDefault();
    const grp = groups.find((g) => g.id === accessGroupId);
    const target = users.find((u) => u.id === grantTargetUserId);
    if (!grp || !target) return;
    setBusy(true);
    try {
      await grantOrUpdateGroupManager({
        actor,
        group: grp,
        targetUser: target,
        permissions: grantPermissions,
      });
      playPopSound();
      onNotice({
        type: 'ok',
        text: `Granted ${target.displayName} management access to "${grp.name}".`,
      });
      setGrantTargetUserId('');
      await loadGrantsForGroup(grp.id);
      await loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not grant group management access.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await savePlatformConfig(actor, {
        maxGroupsPerOrganiser: platformConfig.maxGroupsPerOrganiser,
        defaultMaxParticipants: platformConfig.defaultMaxParticipants,
        permittedBudgetMin: platformConfig.permittedBudgetMin,
        permittedBudgetMax: platformConfig.permittedBudgetMax,
        defaultTimezone: platformConfig.defaultTimezone,
        defaultCurrency: platformConfig.defaultCurrency,
        allowDiscoverableGroups: platformConfig.allowDiscoverableGroups,
        globalGamesEnabled: platformConfig.globalGamesEnabled,
      });
      playPopSound();
      onNotice({ type: 'ok', text: 'Saved global Secret Santa platform configuration.' });
      await loadGovernanceData();
    } catch (err) {
      onNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not save system settings.',
      });
    } finally {
      setBusy(false);
    }
  };

  const adminCount = users.filter((u) => u.role === 'ADMIN' && u.status === 'ACTIVE').length;
  const organiserCount = users.filter((u) => u.role === 'ORGANISER' && u.status === 'ACTIVE').length;
  const activeGroupsCount = groups.filter((g) => g.status !== 'COMPLETED_ARCHIVED').length;
  const matchedGroupsCount = groups.filter((g) => g.isMatched).length;

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-400" />
        Loading Supreme Santa governance data...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Groups', value: groups.length, sub: `${activeGroupsCount} active` },
              { label: 'Matched Exchanges', value: matchedGroupsCount, sub: 'Time-locked reveals' },
              { label: 'Head Elf Organisers', value: organiserCount, sub: `${adminCount} Supreme Santas` },
              { label: 'Registered Accounts', value: users.length, sub: `${auditLogs.length} audit logs` },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="text-xs font-semibold text-slate-500">{kpi.label}</div>
                <div className="font-mono-tabular text-2xl font-bold text-slate-900 mt-1">
                  {kpi.value}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <LayoutDashboard className="w-4 h-4 text-rose-600" />
                Role Hierarchy & Privacy Safeguards
              </div>
              <button
                type="button"
                onClick={() => void loadGovernanceData()}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {(['ADMIN', 'ORGANISER', 'PARTICIPANT'] as const).map((r) => (
                <div key={r} className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1">
                  <div className="font-bold text-slate-900">
                    {ROLE_META[r].emoji} {ROLE_META[r].title}
                  </div>
                  <p className="text-slate-600 leading-relaxed">{ROLE_META[r].summary}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              <Lock className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
              Routine admin screens hide private Secret Santa identities, anonymous mailbox contents, and delivery addresses. When genuine emergency support is required, use the audited Break-Glass action inside All Groups.
            </p>
          </div>
        </div>
      )}

      {/* ALL GROUPS */}
      {activeSubTab === 'all-groups' && (
        <div className="space-y-4">
          {showCreateWizard ? (
            <CreateGroupWizard
              actor={actor}
              platformConfig={platformConfig}
              onCreated={(created) => {
                setShowCreateWizard(false);
                setGroups((prev) => [created, ...prev]);
                onSelectActiveGroup(created.id);
                onNotice({ type: 'ok', text: `Created new Secret Santa group "${created.name}".` });
              }}
              onCancel={() => setShowCreateWizard(false)}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Search groups by name or slug..."
                  className="flex-1 min-w-[200px] min-h-[40px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowCreateWizard(true)}
                  className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create Santa Group
                </button>
              </div>

              <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {groups
                  .filter(
                    (g) =>
                      !groupSearch.trim() ||
                      g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
                      g.slug.toLowerCase().includes(groupSearch.toLowerCase())
                  )
                  .map((grp) => {
                    const isCurrentActive = grp.id === activeEventId;
                    return (
                      <div key={grp.id} className="p-4 space-y-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                              <span>
                                {THEME_EMOJI[grp.theme]} {grp.name}
                              </span>
                              {isCurrentActive && (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                  Active Workspace
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{LIFECYCLE_LABELS[grp.status].label}</span>
                              <span>·</span>
                              <span>Owner: {grp.ownerDisplayName || 'Admin'}</span>
                              <span>·</span>
                              <span className="font-mono-tabular">
                                {grp.memberCount}/{grp.maxParticipants} members
                              </span>
                              <span>·</span>
                              <span>{grp.visibility}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectActiveGroup(grp.id)}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Select Group
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTransferGroup(grp);
                                setTransferNewOwnerId('');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              Transfer Owner
                            </button>
                            {grp.isMatched && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBreakGlassGroup(grp);
                                  setBreakGlassReason('');
                                  setBreakGlassRows(null);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Break-Glass View
                              </button>
                            )}
                            {grp.status !== 'COMPLETED_ARCHIVED' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await updateSantaGroup(
                                      actor,
                                      grp,
                                      { status: 'COMPLETED_ARCHIVED' },
                                      'Archived by Supreme Santa Admin.'
                                    );
                                    onNotice({ type: 'ok', text: `Archived "${grp.name}".` });
                                    await loadGovernanceData();
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                Archive
                              </button>
                            )}
                            {confirmDeleteGroupId === grp.id ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await deleteSantaGroupAdmin(
                                      actor,
                                      grp,
                                      'Confirmed permanent group deletion by Admin.'
                                    );
                                    setConfirmDeleteGroupId(null);
                                    onNotice({ type: 'ok', text: `Permanently deleted "${grp.name}".` });
                                    await loadGovernanceData();
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteGroupId(grp.id)}
                                className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}

      {/* USERS & ROLES */}
      {activeSubTab === 'users-roles' && (
        <div className="space-y-4">
          {/* Add / Pre-Register User Form */}
          <form
            onSubmit={handleCreateOrPreRegisterUser}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3"
          >
            <div>
              <h4 className="font-display font-bold text-sm text-slate-900">
                Add / Pre-Register User &amp; Assign Role
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Register any person by their Google email and assign them Head Elf Organiser or
                Participant access immediately — even before their first sign-in.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Full name (e.g. Aarav)"
                maxLength={100}
                className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              />
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Google email (e.g. aarav@gmail.com)"
                maxLength={160}
                className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'ORGANISER' | 'PARTICIPANT')}
                className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"
              >
                <option value="ORGANISER">🧝 Head Elf Organiser</option>
                <option value="PARTICIPANT">🎁 Participant</option>
              </select>
            </div>

            {newUserRole === 'ORGANISER' && groups.length > 0 && (
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-700">
                  Optional: Grant immediate management access to groups
                </span>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const checked = newUserGroupIds.includes(g.id);
                    return (
                      <label
                        key={g.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                          checked
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setNewUserGroupIds((prev) =>
                              e.target.checked
                                ? [...prev, g.id]
                                : prev.filter((id) => id !== g.id)
                            )
                          }
                          className="w-3.5 h-3.5 accent-emerald-600"
                        />
                        <span>
                          {THEME_EMOJI[g.theme]} {g.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !newUserEmail.trim()}
              className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {newUserRole === 'ORGANISER'
                ? 'Register & Grant Head Elf Organiser'
                : 'Register as Participant'}
            </button>
          </form>

          {/* Search & Bulk Role Reset */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by name or email..."
              className="flex-1 min-w-[220px] min-h-[40px] rounded-xl border border-slate-300 px-3.5 text-sm"
            />
            {organiserCount > 0 &&
              (confirmDemoteAllOrganisers ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDemoteAllOrganisers(false)}
                    className="min-h-[38px] px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDemoteAllOrganisers()}
                    className="min-h-[38px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm: Set All {organiserCount} Organiser(s) to Participant
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDemoteAllOrganisers(true)}
                  className="min-h-[38px] px-3.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-semibold cursor-pointer"
                >
                  Change All Organisers → Participant ({organiserCount})
                </button>
              ))}
          </div>

          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {users.length === 0 ? (
              <div className="p-5 text-sm text-slate-500 text-center">
                No registered users yet. Use the form above to add a user by Google email.
              </div>
            ) : (
              users
                .filter(
                  (u) =>
                    !userSearch.trim() ||
                    u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearch.toLowerCase())
                )
                .map((u) => {
                  const meta = ROLE_META[u.role];
                  const isSelf = u.id === actor.id;
                  const isPreRegistered = /^[a-f0-9]{64}$/.test(u.id);
                  return (
                    <div
                      key={u.id}
                      className="p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex flex-wrap items-center gap-2">
                          <span>{u.displayName}</span>
                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            {meta.emoji} {meta.badge}
                          </span>
                          {isPreRegistered && (
                            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                              Pre-registered (activates on Google sign-in)
                            </span>
                          )}
                          {u.status === 'SUSPENDED' && (
                            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                              Suspended
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {u.email} {isSelf ? '· (You)' : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!isSelf && u.status === 'ACTIVE' && (
                          <select
                            aria-label={`Change role for ${u.displayName}`}
                            disabled={busy}
                            value={u.role}
                            onChange={(e) =>
                              void handleChangeUserRole(u, e.target.value as PlatformRole)
                            }
                            className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 cursor-pointer"
                          >
                            <option value="PARTICIPANT">🎁 Participant</option>
                            <option value="ORGANISER">🧝 Head Elf Organiser</option>
                            {!isPreRegistered && <option value="ADMIN">🎅 Supreme Santa Admin</option>}
                          </select>
                        )}
                        {u.role === 'PARTICIPANT' && u.status === 'ACTIVE' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setPromoteTarget(u);
                              setPromoteInitialGroupIds([]);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Promote to Head Elf
                          </button>
                        )}
                        {u.role === 'ORGANISER' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRevokeOrganiser(u)}
                            className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-semibold cursor-pointer"
                          >
                            Set as Participant
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleSuspend(u)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                              u.status === 'SUSPENDED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            {u.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* ORGANISER ACCESS & GRANULAR PERMISSIONS */}
      {activeSubTab === 'organiser-access' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                Group-Scoped Management Access & Permissions
              </h4>
              <p className="text-xs text-slate-500">
                Appoint Co-Organisers / Managers to specific groups with fine-grained permissions. Revoking access preserves ordinary participant membership.
              </p>
            </div>
            <select
              value={accessGroupId}
              onChange={(e) => setAccessGroupId(e.target.value)}
              className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {THEME_EMOJI[g.theme]} {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Current Grants */}
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {groupGrants.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                No explicit management grants recorded for this group yet.
              </div>
            ) : (
              groupGrants.map((g) => (
                <div key={g.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{g.userDisplayName}</span>
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {g.role}
                      </span>
                      {!g.active && (
                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                          Revoked
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{g.userEmail}</div>
                    <div className="text-[11px] text-slate-600 mt-1.5">
                      Permissions: {g.permissions.map((p) => GROUP_PERMISSION_LABELS[p]?.label || p).join(' · ')}
                    </div>
                  </div>
                  {g.active && g.role !== 'OWNER' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        const grp = groups.find((x) => x.id === accessGroupId);
                        if (!grp) return;
                        setBusy(true);
                        try {
                          await revokeGroupManager({
                            actor,
                            group: grp,
                            targetUserId: g.userId,
                            targetLabel: g.userDisplayName,
                          });
                          onNotice({
                            type: 'ok',
                            text: `Revoked ${g.userDisplayName}'s management grant for "${grp.name}".`,
                          });
                          await loadGrantsForGroup(grp.id);
                          await loadGovernanceData();
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                    >
                      Revoke Access
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Grant / Update Manager Form */}
          <form
            onSubmit={handleGrantManager}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-4"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <KeyRound className="w-4 h-4 text-emerald-700" />
              Grant or Customize Manager Access
            </div>

            <select
              required
              value={grantTargetUserId}
              onChange={(e) => setGrantTargetUserId(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">Select a registered user...</option>
              {users
                .filter((u) => u.status === 'ACTIVE')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email}) — {ROLE_META[u.role].badge}
                  </option>
                ))}
            </select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_GROUP_PERMISSIONS.map((perm) => {
                const checked = grantPermissions.includes(perm);
                return (
                  <label
                    key={perm}
                    className="flex items-start gap-2.5 rounded-xl bg-white border border-slate-200 p-2.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setGrantPermissions((prev) =>
                          e.target.checked
                            ? Array.from(new Set([...prev, perm]))
                            : prev.filter((p) => p !== perm)
                        )
                      }
                      className="w-4 h-4 accent-emerald-600 mt-0.5"
                    />
                    <span className="text-xs">
                      <strong className="text-slate-900 block">
                        {GROUP_PERMISSION_LABELS[perm].label}
                      </strong>
                      <span className="text-slate-500">
                        {GROUP_PERMISSION_LABELS[perm].description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={busy || !grantTargetUserId || grantPermissions.length === 0}
              className="min-h-[42px] px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              Save Management Grant
            </button>
          </form>
        </div>
      )}

      {/* SYSTEM SETTINGS */}
      {activeSubTab === 'system-settings' && (
        <form onSubmit={handleSaveSystemConfig} className="space-y-5">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-4">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Settings className="w-4 h-4 text-slate-700" />
              Platform-Wide Defaults & Limits
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Max Groups per Head Elf
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={platformConfig.maxGroupsPerOrganiser}
                  onChange={(e) =>
                    setPlatformConfig((c) => ({
                      ...c,
                      maxGroupsPerOrganiser: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Default Max Participants
                </label>
                <input
                  type="number"
                  min={2}
                  max={500}
                  value={platformConfig.defaultMaxParticipants}
                  onChange={(e) =>
                    setPlatformConfig((c) => ({
                      ...c,
                      defaultMaxParticipants: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Default Currency
                </label>
                <select
                  value={platformConfig.defaultCurrency}
                  onChange={(e) =>
                    setPlatformConfig((c) => ({
                      ...c,
                      defaultCurrency: e.target.value as GroupCurrency,
                    }))
                  }
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Permitted Budget Min
                </label>
                <input
                  type="number"
                  min={0}
                  value={platformConfig.permittedBudgetMin}
                  onChange={(e) =>
                    setPlatformConfig((c) => ({
                      ...c,
                      permittedBudgetMin: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Permitted Budget Max
                </label>
                <input
                  type="number"
                  min={platformConfig.permittedBudgetMin}
                  value={platformConfig.permittedBudgetMax}
                  onChange={(e) =>
                    setPlatformConfig((c) => ({
                      ...c,
                      permittedBudgetMax: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Default Timezone
                </label>
                <input
                  type="text"
                  value={platformConfig.defaultTimezone}
                  onChange={(e) =>
                    setPlatformConfig((c) => ({ ...c, defaultTimezone: e.target.value }))
                  }
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={platformConfig.allowDiscoverableGroups}
                onChange={(e) =>
                  setPlatformConfig((c) => ({
                    ...c,
                    allowDiscoverableGroups: e.target.checked,
                  }))
                }
                className="w-4 h-4 accent-rose-600"
              />
              Allow Organisers to create Discoverable Groups (Request to Join)
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save Platform Configuration'}
          </button>
        </form>
      )}

      {/* PLATFORM AUDIT LOGS */}
      {activeSubTab === 'audit-logs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <ScrollText className="w-4 h-4 text-slate-700" />
              Immutable Platform Audit Logs ({auditLogs.length})
            </div>
            <button
              type="button"
              onClick={() => void loadGovernanceData()}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No governance audit events recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className={`px-4 py-3 text-xs flex flex-wrap items-start justify-between gap-2 ${
                    log.action === 'BREAK_GLASS_ASSIGNMENT_VIEW' ? 'bg-amber-50/70' : ''
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {log.action.replace(/_/g, ' ')} · {log.targetLabel}
                    </div>
                    {log.reason && <div className="text-slate-600 mt-0.5">{log.reason}</div>}
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Actor: {log.actorEmail} ({log.actorRole})
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono-tabular whitespace-nowrap">
                    {log.createdAt.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: PROMOTE TO HEAD ELF CONFIRMATION (EXACT UX COPY) */}
      {promoteTarget && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="font-display text-lg font-bold text-slate-900">
                  Make this person a Head Elf? 🧝
                </h4>
                <p className="text-sm text-slate-600">
                  They&apos;ll be able to create and manage Secret Santa groups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromoteTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
              <div className="font-bold text-slate-900">{promoteTarget.displayName}</div>
              <div className="text-slate-500">{promoteTarget.email}</div>
            </div>

            {groups.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Optional: Assign initial management access to existing groups
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 p-2.5">
                  {groups.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={promoteInitialGroupIds.includes(g.id)}
                        onChange={(e) =>
                          setPromoteInitialGroupIds((prev) =>
                            e.target.checked
                              ? [...prev, g.id]
                              : prev.filter((id) => id !== g.id)
                          )
                        }
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span>
                        {THEME_EMOJI[g.theme]} {g.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPromoteTarget(null)}
                className="min-h-[40px] px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmPromote()}
                className="min-h-[40px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Confirm Head Elf
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TRANSFER GROUP OWNERSHIP */}
      {transferGroup && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-display text-lg font-bold">Transfer Group Ownership</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transferring &ldquo;{transferGroup.name}&rdquo; grants full Owner rights to the selected user.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferGroup(null)}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <select
              value={transferNewOwnerId}
              onChange={(e) => setTransferNewOwnerId(e.target.value)}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">Select new group owner...</option>
              {users
                .filter((u) => u.status === 'ACTIVE')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferGroup(null)}
                className="min-h-[40px] px-4 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !transferNewOwnerId}
                onClick={() => void handleConfirmTransfer()}
                className="min-h-[40px] px-5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Transfer Ownership
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: BREAK-GLASS AUDITED EMERGENCY ASSIGNMENT VIEWER */}
      {breakGlassGroup && (
        <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white text-slate-900 shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display text-lg font-bold text-slate-900">
                    Break-Glass Assignment Access
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Emergency Admin-only view for &ldquo;{breakGlassGroup.name}&rdquo;. Every access writes a permanent audit log entry.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBreakGlassGroup(null);
                  setBreakGlassRows(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!breakGlassRows ? (
              <form onSubmit={handleRunBreakGlass} className="space-y-3">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    Routine admin workflows do not display Secret Santa pairs. Provide a clear support reason below to unlock read-only emergency inspection.
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mandatory Audit Justification (min 10 characters) *
                  </label>
                  <textarea
                    required
                    minLength={10}
                    maxLength={320}
                    rows={3}
                    value={breakGlassReason}
                    onChange={(e) => setBreakGlassReason(e.target.value)}
                    placeholder="e.g. Participant dropped out after matching due to travel emergency; verifying affected pair."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBreakGlassGroup(null)}
                    className="min-h-[40px] px-4 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || breakGlassReason.trim().length < 10}
                    className="min-h-[40px] px-5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Log Audit & Inspect
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Audit event logged (BREAK_GLASS_ASSIGNMENT_VIEW). Showing {breakGlassRows.length} assignment(s):
                </div>
                <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {breakGlassRows.map((row) => (
                    <div
                      key={row.giverKey}
                      className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-900">{row.giverName}</span>
                      <span className="text-slate-400">gifts to →</span>
                      <span className="font-bold text-rose-700">{row.recipientName}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setBreakGlassGroup(null);
                      setBreakGlassRows(null);
                    }}
                    className="min-h-[40px] px-5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Close Inspection
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
