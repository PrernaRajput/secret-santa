import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CopyPlus,
  ExternalLink,
  Gamepad2,
  History,
  Link2,
  Lock,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldAlert,
  Shuffle,
  Trash2,
  Truck,
  UserCheck,
  UserX,
  Users,
  Wallet,
} from 'lucide-react';
import {
  GroupAnnouncement,
  GroupJoinRequest,
  GroupLifecycleStatus,
  GroupManagementGrant,
  GroupMembership,
  GroupPermission,
  PlatformAuditLog,
  PlatformConfig,
  PlatformUser,
  SantaGroup,
} from '../../types/rbac';
import { InvitationRecord } from '../../types/secretSanta';
import {
  duplicateSantaGroup,
  fetchGroupAggregateDeliveryOverview,
  fetchMyGrantForGroup,
  generateGroupPersonalInvitation,
  listGroupAnnouncements,
  listGroupAuditLogs,
  listGroupInvitations,
  listGroupJoinRequests,
  listGroupMembers,
  listManagedGroupsForUser,
  postGroupAnnouncement,
  regenerateGroupInviteCode,
  removeGroupMemberPreMatch,
  reviewGroupJoinRequest,
  revokeGroupInvitation,
  runGroupMatchingWithExclusions,
  updateSantaGroup,
} from '../../services/rbacService';
import {
  buildGroupInviteUrl,
  hasGroupPermissionPolicy,
  LIFECYCLE_LABELS,
  LIFECYCLE_ORDER,
} from '../../utils/rbacLogic';
import { CreateGroupWizard } from './CreateGroupWizard';
import { AvatarGraphic } from '../../components/avatars/AvatarGraphic';
import { playChimeSound, playPopSound } from '../../utils/sound';

interface OrganiserDashboardProps {
  actor: PlatformUser;
  platformConfig?: PlatformConfig;
  initialGroupId?: string;
  onOpenGroupInApp: (groupId: string) => void;
}

type OrganiserSection =
  | 'groups'
  | 'create'
  | 'participants'
  | 'invites'
  | 'rules'
  | 'matching'
  | 'schedule'
  | 'announcements'
  | 'games'
  | 'logs';

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const THEME_EMOJI: Record<SantaGroup['theme'], string> = {
  santa: '🎄',
  chocolate: '🍫',
  funny: '🤪',
};

export const OrganiserDashboard: React.FC<OrganiserDashboardProps> = ({
  actor,
  platformConfig,
  initialGroupId,
  onOpenGroupInApp,
}) => {
  const [section, setSection] = useState<OrganiserSection>('groups');
  const [groups, setGroups] = useState<SantaGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || '');
  const [grant, setGrant] = useState<GroupManagementGrant | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Scoped group operational data
  const [members, setMembers] = useState<GroupMembership[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [deliveryOverview, setDeliveryOverview] = useState<{
    totalMembers: number;
    profilesComplete: number;
    addressesComplete: number;
    dispatchedCount: number;
    deliveredCount: number;
    receivedCount: number;
    problemCount: number;
  } | null>(null);

  // Form states for selected group
  const [personalInviteLabel, setPersonalInviteLabel] = useState('');
  const [lastPersonalLink, setLastPersonalLink] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annKind, setAnnKind] = useState<'announcement' | 'reminder'>('announcement');

  // Editable rules/schedule state synced with selected group
  const [editBudgetMin, setEditBudgetMin] = useState(1000);
  const [editBudgetMax, setEditBudgetMax] = useState(1000);
  const [editBudgetNote, setEditBudgetNote] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editRegDeadline, setEditRegDeadline] = useState('');
  const [editMatchingAt, setEditMatchingAt] = useState('');
  const [editRecipientRevealAt, setEditRecipientRevealAt] = useState('');
  const [editSenderRevealAt, setEditSenderRevealAt] = useState('');
  const [editGiftExchangeAt, setEditGiftExchangeAt] = useState('');

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || groups[0] || null;

  const canDo = (perm: GroupPermission): boolean => {
    if (!selectedGroup) return false;
    return hasGroupPermissionPolicy(actor, grant, selectedGroup.id, perm);
  };

  const loadManagedGroups = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listManagedGroupsForUser(actor.id, actor.email);
      setGroups(list);
      setSelectedGroupId((prev) => {
        if (prev && list.some((g) => g.id === prev)) return prev;
        if (initialGroupId && list.some((g) => g.id === initialGroupId)) return initialGroupId;
        return list[0]?.id || '';
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load your managed groups.',
      });
    } finally {
      setLoading(false);
    }
  }, [actor.id, actor.email, initialGroupId]);

  useEffect(() => {
    void loadManagedGroups();
  }, [loadManagedGroups]);

  const loadSelectedGroupDetails = useCallback(async () => {
    if (!selectedGroup) return;
    setEditBudgetMin(selectedGroup.budget.minAmount);
    setEditBudgetMax(selectedGroup.budget.maxAmount);
    setEditBudgetNote(selectedGroup.budget.announcement || '');
    setEditLocation(selectedGroup.exchangeLocation || '');
    setEditRegDeadline(toDatetimeLocal(selectedGroup.registrationDeadline));
    setEditMatchingAt(toDatetimeLocal(selectedGroup.matchingAt));
    setEditRecipientRevealAt(toDatetimeLocal(selectedGroup.recipientRevealAt));
    setEditSenderRevealAt(
      selectedGroup.senderRevealAt ? toDatetimeLocal(selectedGroup.senderRevealAt) : ''
    );
    setEditGiftExchangeAt(toDatetimeLocal(selectedGroup.giftExchangeAt));

    try {
      const [gGrant, mList, invList, jrList, annList, logList, overview] = await Promise.all([
        fetchMyGrantForGroup(selectedGroup.id, actor.id, actor.email),
        listGroupMembers(selectedGroup.id).catch(() => []),
        listGroupInvitations(selectedGroup.id).catch(() => []),
        listGroupJoinRequests(selectedGroup.id).catch(() => []),
        listGroupAnnouncements(selectedGroup.id).catch(() => []),
        listGroupAuditLogs(selectedGroup.id).catch(() => []),
        fetchGroupAggregateDeliveryOverview(selectedGroup.id).catch(() => null),
      ]);
      setGrant(gGrant);
      setMembers(mList);
      setInvitations(invList);
      setJoinRequests(jrList);
      setAnnouncements(annList);
      setAuditLogs(logList);
      setDeliveryOverview(overview);
    } catch {
      // keep existing state
    }
  }, [actor.id, selectedGroup]);

  useEffect(() => {
    void loadSelectedGroupDetails();
  }, [loadSelectedGroupDetails]);

  const copyText = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    playPopSound();
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleLifecycleChange = async (nextStatus: GroupLifecycleStatus) => {
    if (!selectedGroup) return;
    setBusy(true);
    setNotice(null);
    try {
      const updated = await updateSantaGroup(actor, selectedGroup, { status: nextStatus });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      playPopSound();
      setNotice({
        type: 'ok',
        text: `Group status updated to ${LIFECYCLE_LABELS[nextStatus].label}.`,
      });
      void loadSelectedGroupDetails();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not change group status.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRulesAndSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    setBusy(true);
    setNotice(null);
    try {
      const updated = await updateSantaGroup(actor, selectedGroup, {
        budget: {
          ...selectedGroup.budget,
          minAmount: Math.max(0, Number(editBudgetMin) || 0),
          maxAmount:
            selectedGroup.budget.mode === 'fixed'
              ? Math.max(0, Number(editBudgetMin) || 0)
              : Math.max(Number(editBudgetMin) || 0, Number(editBudgetMax) || 0),
          announcement: editBudgetNote,
        },
        exchangeLocation: editLocation,
        registrationDeadline: new Date(editRegDeadline),
        matchingAt: new Date(editMatchingAt),
        recipientRevealAt: new Date(editRecipientRevealAt),
        senderRevealAt: editSenderRevealAt ? new Date(editSenderRevealAt) : null,
        giftExchangeAt: new Date(editGiftExchangeAt),
      });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      playPopSound();
      setNotice({ type: 'ok', text: 'Saved group rules, budget, and reveal schedule.' });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not save group settings.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleGame = async (key: keyof SantaGroup['gamesConfig'], value: boolean) => {
    if (!selectedGroup) return;
    setBusy(true);
    try {
      const updated = await updateSantaGroup(actor, selectedGroup, {
        gamesConfig: { ...selectedGroup.gamesConfig, [key]: value },
      });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      playPopSound();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not update game setting.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateGroupLink = async () => {
    if (!selectedGroup) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await regenerateGroupInviteCode(actor, selectedGroup);
      setGroups((prev) =>
        prev.map((g) => (g.id === selectedGroup.id ? { ...g, inviteCode: res.inviteCode } : g))
      );
      playPopSound();
      setNotice({
        type: 'ok',
        text: 'Generated a fresh Group Invitation Link. The previous link is now invalid.',
      });
      void loadSelectedGroupDetails();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not regenerate group link.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePersonalInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await generateGroupPersonalInvitation({
        actor,
        group: selectedGroup,
        label: personalInviteLabel || 'Secret Santa Guest',
      });
      setLastPersonalLink(res.inviteUrl);
      setPersonalInviteLabel('');
      playPopSound();
      setNotice({
        type: 'ok',
        text: 'Personal one-time invitation link created! Share it privately with your guest.',
      });
      void loadSelectedGroupDetails();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not create personal invite link.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRunMatching = async () => {
    if (!selectedGroup) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await runGroupMatchingWithExclusions(actor, selectedGroup);
      await loadManagedGroups();
      await loadSelectedGroupDetails();
      playChimeSound();
      setNotice({
        type: 'ok',
        text: `Secret Santa matching completed for ${res.matchedCount} participants! Private assignments remain strictly hidden to protect everyone's surprise.`,
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not execute matching.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !annTitle.trim() || !annBody.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await postGroupAnnouncement({
        actor,
        groupId: selectedGroup.id,
        title: annTitle,
        body: annBody,
        kind: annKind,
      });
      setAnnTitle('');
      setAnnBody('');
      playPopSound();
      setNotice({
        type: 'ok',
        text: annKind === 'reminder' ? 'Group reminder sent!' : 'Group announcement published!',
      });
      void loadSelectedGroupDetails();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not post announcement.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicateGroup = async (grp: SantaGroup) => {
    setBusy(true);
    setNotice(null);
    try {
      const copy = await duplicateSantaGroup(actor, grp, `${grp.name} · Next Year`);
      setGroups((prev) => [copy, ...prev]);
      setSelectedGroupId(copy.id);
      playChimeSound();
      setNotice({
        type: 'ok',
        text: `Duplicated "${grp.name}" as a fresh Draft group (no private assignments copied).`,
      });
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not duplicate group.',
      });
    } finally {
      setBusy(false);
    }
  };

  const joinedMembers = members.filter((m) => m.status === 'JOINED');
  const pendingJoinReqs = joinRequests.filter((r) => r.status === 'pending');
  const missingProfiles = joinedMembers.filter((m) => !m.profileComplete).length;
  const missingAddresses = joinedMembers.filter((m) => !m.addressComplete).length;
  const groupInviteUrl = selectedGroup
    ? buildGroupInviteUrl(window.location.origin, selectedGroup.slug, selectedGroup.inviteCode)
    : '';

  const navItems: { id: OrganiserSection; label: string; icon: React.ComponentType<{ className?: string }>; requiresGroup?: boolean }[] = [
    { id: 'groups', label: `My Groups (${groups.length})`, icon: Users },
    { id: 'create', label: 'Create Group', icon: Plus },
    { id: 'participants', label: `Participants (${joinedMembers.length})`, icon: UserCheck, requiresGroup: true },
    { id: 'invites', label: 'Invites', icon: Link2, requiresGroup: true },
    { id: 'rules', label: 'Budget & Rules', icon: Wallet, requiresGroup: true },
    { id: 'matching', label: 'Matching', icon: Shuffle, requiresGroup: true },
    { id: 'schedule', label: 'Reveal Schedule', icon: Calendar, requiresGroup: true },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, requiresGroup: true },
    { id: 'games', label: 'Games', icon: Gamepad2, requiresGroup: true },
    { id: 'logs', label: 'Activity Logs', icon: History, requiresGroup: true },
  ];

  return (
    <div className="space-y-5">
      {/* Head Elf Header & Active Group Selector */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            🧝 Head Elf · Santa Control Center
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold mt-0.5">
            {selectedGroup ? `${THEME_EMOJI[selectedGroup.theme]} ${selectedGroup.name}` : 'Your Secret Santa Groups'}
          </h3>
          {selectedGroup && (
            <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
              <span>Status: {LIFECYCLE_LABELS[selectedGroup.status].label}</span>
              <span>·</span>
              <span className="font-mono-tabular">
                {joinedMembers.length} / {selectedGroup.maxParticipants} joined
              </span>
              {grant && (
                <>
                  <span>·</span>
                  <span>Role: {grant.role}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {groups.length > 0 && (
            <select
              value={selectedGroup?.id || ''}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              aria-label="Select managed group"
              className="min-h-[38px] rounded-xl bg-white/10 border border-white/20 px-3 text-xs font-semibold text-white"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id} className="text-slate-900">
                  {THEME_EMOJI[g.theme]} {g.name}
                </option>
              ))}
            </select>
          )}
          {selectedGroup && (
            <button
              type="button"
              onClick={() => onOpenGroupInApp(selectedGroup.id)}
              className="min-h-[38px] px-3.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Group
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const disabled = item.requiresGroup && !selectedGroup;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => setSection(item.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {notice && (
        <div
          role="alert"
          className={`rounded-xl px-4 py-3 text-sm font-medium border flex items-center justify-between gap-2 ${
            notice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SECTION: MY GROUPS */}
      {section === 'groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-bold text-base text-slate-900">
              Groups You Manage
            </h4>
            <button
              type="button"
              onClick={() => setSection('create')}
              className="min-h-[38px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Santa Group
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
              Loading your authorized groups...
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
              <div className="text-3xl">🎄</div>
              <h5 className="font-display font-bold text-slate-900">No Santa Groups Yet</h5>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Create your first Secret Santa group for your friends, family, or office team — with custom budget rules, reveal dates, and festive games.
              </p>
              <button
                type="button"
                onClick={() => setSection('create')}
                className="min-h-[42px] px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create a Santa Group
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((grp) => {
                const isSelected = grp.id === selectedGroup?.id;
                const progressPct = Math.min(
                  100,
                  Math.round((grp.memberCount / Math.max(1, grp.maxParticipants)) * 100)
                );
                return (
                  <div
                    key={grp.id}
                    className={`rounded-2xl border p-4 space-y-3 transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50/70 shadow-sm'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-display font-bold text-base text-slate-900 flex items-center gap-1.5">
                          <span>{THEME_EMOJI[grp.theme]}</span>
                          <span>{grp.name}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {LIFECYCLE_LABELS[grp.status].label} · {grp.visibility} ·{' '}
                          {grp.budget.currency}
                          {grp.budget.minAmount}
                          {grp.budget.mode === 'range' ? `–${grp.budget.maxAmount}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroupId(grp.id);
                          setSection('participants');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>

                    {/* Registration Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-600 font-mono-tabular">
                        <span>Participants joined</span>
                        <span>
                          {grp.memberCount} / {grp.maxParticipants}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => onOpenGroupInApp(grp.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDuplicateGroup(grp)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CopyPlus className="w-3 h-3" />
                        Duplicate for Next Year
                      </button>
                      {grp.status !== 'COMPLETED_ARCHIVED' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setSelectedGroupId(grp.id);
                            void handleLifecycleChange('COMPLETED_ARCHIVED');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Archive className="w-3 h-3" />
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Readiness & Aggregate Delivery Overview for Selected Group */}
          {selectedGroup && deliveryOverview && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Truck className="w-4 h-4 text-emerald-700" />
                  Aggregate Readiness & Delivery Overview ({selectedGroup.name})
                </div>
                <span className="text-[11px] text-slate-500">
                  Private sender identities & gift details are never exposed
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                {[
                  { label: 'Joined', value: deliveryOverview.totalMembers },
                  { label: 'Profiles Ready', value: deliveryOverview.profilesComplete },
                  { label: 'Addresses Ready', value: deliveryOverview.addressesComplete },
                  { label: 'Gifts Dispatched', value: deliveryOverview.dispatchedCount },
                  { label: 'Gifts Confirmed', value: deliveryOverview.receivedCount },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-white border border-slate-200 p-3"
                  >
                    <div className="font-mono-tabular text-xl font-bold text-slate-900">
                      {stat.value}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION: CREATE GROUP */}
      {section === 'create' && (
        <CreateGroupWizard
          actor={actor}
          platformConfig={platformConfig}
          onCreated={(created) => {
            setGroups((prev) => [created, ...prev]);
            setSelectedGroupId(created.id);
            setSection('invites');
            setNotice({
              type: 'ok',
              text: `Created "${created.name}"! Share your invitation link below to invite participants.`,
            });
          }}
          onCancel={() => setSection('groups')}
        />
      )}

      {/* SECTION: PARTICIPANTS & JOIN REQUESTS */}
      {section === 'participants' && selectedGroup && (
        <div className="space-y-5">
          {/* Readiness Checklist */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
            <h4 className="font-bold text-sm text-slate-900">Matching Readiness Checklist</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${
                    joinedMembers.length >= 2 ? 'text-emerald-600' : 'text-amber-500'
                  }`}
                />
                <span>
                  <strong className="font-mono-tabular">{joinedMembers.length}</strong> joined (min 2)
                </span>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${
                    missingProfiles === 0 ? 'text-emerald-600' : 'text-amber-500'
                  }`}
                />
                <span>
                  <strong className="font-mono-tabular">{missingProfiles}</strong> incomplete profiles
                </span>
              </div>
              <div className="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${
                    missingAddresses === 0 ? 'text-emerald-600' : 'text-amber-500'
                  }`}
                />
                <span>
                  <strong className="font-mono-tabular">{missingAddresses}</strong> missing addresses
                </span>
              </div>
            </div>
          </div>

          {/* Pending Discoverable Join Requests */}
          {pendingJoinReqs.length > 0 && (
            <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4 space-y-3">
              <h4 className="font-bold text-sm text-amber-950">
                Pending Join Requests ({pendingJoinReqs.length})
              </h4>
              <div className="space-y-2">
                {pendingJoinReqs.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl bg-white border border-amber-200 p-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">{req.requesterName}</div>
                      <div className="text-xs text-slate-500">
                        {req.requesterEmail || 'No email'} {req.note ? `· "${req.note}"` : ''}
                      </div>
                    </div>
                    {canDo('MEMBER_MANAGE') && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const res = await reviewGroupJoinRequest({
                                actor,
                                group: selectedGroup,
                                request: req,
                                decision: 'approved',
                              });
                              if (res.inviteUrl) setLastPersonalLink(res.inviteUrl);
                              setNotice({
                                type: 'ok',
                                text: `Approved ${req.requesterName}! Personal invite link generated in Invites tab.`,
                              });
                              void loadSelectedGroupDetails();
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                        >
                          Approve & Issue Link
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await reviewGroupJoinRequest({
                                actor,
                                group: selectedGroup,
                                request: req,
                                decision: 'declined',
                              });
                              void loadSelectedGroupDetails();
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member Roster */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-900">
              Group Roster ({members.length})
            </h4>
            {members.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                No participants have joined yet. Share your Group Invitation Link or create personal invitations in the Invites tab!
              </p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarGraphic avatarId={m.avatarId} size={40} />
                      <div>
                        <div className="text-sm font-bold text-slate-900">{m.displayName}</div>
                        <div className="text-xs text-slate-500">
                          Status: {m.status} · Profile: {m.profileComplete ? 'Ready' : 'Incomplete'}{' '}
                          · Address: {m.addressComplete ? 'Ready' : 'Missing'}
                        </div>
                      </div>
                    </div>

                    {!selectedGroup.isMatched &&
                      m.status === 'JOINED' &&
                      canDo('MEMBER_MANAGE') && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await removeGroupMemberPreMatch(actor, selectedGroup, m);
                              setNotice({ type: 'ok', text: `Removed ${m.displayName} before matching.` });
                              void loadSelectedGroupDetails();
                            } catch (err) {
                              setNotice({
                                type: 'err',
                                text: err instanceof Error ? err.message : 'Could not remove participant.',
                              });
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION: INVITES (DUAL INVITE SYSTEM) */}
      {section === 'invites' && selectedGroup && (
        <div className="space-y-5">
          {/* 1. Group Invitation Link */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  1. Group Invitation Link (Shareable with Friends / Team)
                </h4>
                <p className="text-xs text-slate-500">
                  Identifies &ldquo;{selectedGroup.name}&rdquo; cleanly — never auto-authenticates as another participant.
                </p>
              </div>
              {canDo('INVITE_MANAGE') && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRegenerateGroupLink()}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate Code
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={groupInviteUrl}
                className="flex-1 min-w-[220px] min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-mono text-slate-700"
              />
              <button
                type="button"
                onClick={() => copyText(groupInviteUrl, 'group-link')}
                className="min-h-[40px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'group-link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'group-link' ? 'Copied' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* 2. Personal Account Invitation Link */}
          <form
            onSubmit={handleCreatePersonalInvite}
            className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3"
          >
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                2. Personal One-Time Invitation Link
              </h4>
              <p className="text-xs text-slate-500">
                Creates a private 256-bit one-time link (/join?token=...) for a specific guest.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                maxLength={100}
                value={personalInviteLabel}
                onChange={(e) => setPersonalInviteLabel(e.target.value)}
                placeholder="Guest name (e.g. Ananya)"
                className="flex-1 min-w-[200px] min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !canDo('INVITE_MANAGE')}
                className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Link2 className="w-3.5 h-3.5" />
                Generate Personal Link
              </button>
            </div>

            {lastPersonalLink && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs text-emerald-950 break-all">{lastPersonalLink}</code>
                <button
                  type="button"
                  onClick={() => copyText(lastPersonalLink, 'personal-link')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedKey === 'personal-link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy
                </button>
              </div>
            )}

            {invitations.length > 0 && (
              <div className="divide-y divide-slate-100 border-t border-slate-200 pt-2">
                {invitations.map((inv) => (
                  <div
                    key={inv.tokenHash}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{inv.label}</span>
                      <span className="text-slate-500 ml-2">
                        Status: {inv.status} · Created {inv.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                    {inv.status === 'pending' && canDo('INVITE_MANAGE') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await revokeGroupInvitation(actor, selectedGroup.id, inv.tokenHash, inv.label);
                            void loadSelectedGroupDetails();
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      )}

      {/* SECTION: BUDGET & RULES OR SCHEDULE */}
      {(section === 'rules' || section === 'schedule') && selectedGroup && (
        <form onSubmit={handleSaveRulesAndSchedule} className="space-y-4">
          {/* Lifecycle Progress Bar */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-900">Group Lifecycle State</h4>
              <span className="text-xs font-semibold text-slate-600">
                Current: {LIFECYCLE_LABELS[selectedGroup.status].label}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LIFECYCLE_ORDER.map((st) => {
                const isCurrent = selectedGroup.status === st;
                const isLockedBack =
                  actor.role === 'ORGANISER' &&
                  ['MATCHED', 'RECIPIENT_REVEAL_OPEN', 'GIFT_EXCHANGE'].includes(
                    selectedGroup.status
                  ) &&
                  ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(st);
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={busy || isCurrent || isLockedBack || st === 'MATCHED'}
                    onClick={() => void handleLifecycleChange(st)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      isCurrent
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {LIFECYCLE_LABELS[st].shortLabel}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              To move into Matched state, use the Matching tab. Rolling back after matching requires Supreme Santa Admin approval.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Budget {selectedGroup.budget.mode === 'fixed' ? 'Target' : 'Min'} ({selectedGroup.budget.currency})
              </label>
              <input
                type="number"
                min={0}
                value={editBudgetMin}
                onChange={(e) => setEditBudgetMin(Number(e.target.value))}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            {selectedGroup.budget.mode === 'range' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Budget Max ({selectedGroup.budget.currency})
                </label>
                <input
                  type="number"
                  min={editBudgetMin}
                  value={editBudgetMax}
                  onChange={(e) => setEditBudgetMax(Number(e.target.value))}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Budget Note</label>
              <input
                type="text"
                maxLength={240}
                value={editBudgetNote}
                onChange={(e) => setEditBudgetNote(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Exchange Location / Shipping Note</label>
              <input
                type="text"
                maxLength={200}
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Registration Deadline</label>
              <input
                type="datetime-local"
                value={editRegDeadline}
                onChange={(e) => setEditRegDeadline(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Matching Schedule</label>
              <input
                type="datetime-local"
                value={editMatchingAt}
                onChange={(e) => setEditMatchingAt(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-rose-700 mb-1">Recipient Reveal Date & Time</label>
              <input
                type="datetime-local"
                value={editRecipientRevealAt}
                onChange={(e) => setEditRecipientRevealAt(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-rose-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-700 mb-1">Gift Exchange Deadline</label>
              <input
                type="datetime-local"
                value={editGiftExchangeAt}
                onChange={(e) => setEditGiftExchangeAt(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-amber-300 px-3 text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-purple-700 mb-1">Optional Santa Sender Reveal</label>
              <input
                type="datetime-local"
                value={editSenderRevealAt}
                onChange={(e) => setEditSenderRevealAt(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-purple-300 px-3 text-sm font-mono-tabular"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || (!canDo('GROUP_EDIT') && !canDo('SCHEDULE_MANAGE'))}
            className="min-h-[44px] px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save Group Rules & Schedule'}
          </button>
        </form>
      )}

      {/* SECTION: MATCHING */}
      {section === 'matching' && selectedGroup && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Shuffle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-bold text-base text-slate-900">
                  Cryptographic Secret Santa Matching
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Automatically assigns every joined participant a secret recipient with zero self-matches and full respect for your{' '}
                  <strong>{selectedGroup.pairingExclusions.length}</strong> exclusion rule(s).
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-3.5 flex items-start gap-2.5 text-xs text-slate-700">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Guarantee:</strong> Even as Head Elf Organiser, private Santa-to-recipient pairs and anonymous mailbox messages remain completely hidden so you can participate fairly too.
              </span>
            </div>

            {selectedGroup.isMatched ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 font-semibold flex items-center justify-between gap-3">
                <span>
                  Matching completed on{' '}
                  {selectedGroup.matchedAt
                    ? selectedGroup.matchedAt.toLocaleString()
                    : 'record'}
                  ! Recipients unlock at {selectedGroup.recipientRevealAt.toLocaleString()}.
                </span>
                <span className="text-xs text-emerald-700">
                  Resetting matches requires Admin approval
                </span>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || joinedMembers.length < 2 || !canDo('MATCH_EXECUTE')}
                onClick={() => void handleRunMatching()}
                className="min-h-[46px] px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Shuffle className="w-4 h-4" />
                {busy
                  ? 'Running Exclusion-Aware Matching...'
                  : `Run Secret Santa Matching (${joinedMembers.length} Participants)`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* SECTION: ANNOUNCEMENTS & REMINDERS */}
      {section === 'announcements' && selectedGroup && (
        <div className="space-y-5">
          <form
            onSubmit={handlePostAnnouncement}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-slate-900">
                Post Group Announcement or Reminder
              </h4>
              <div className="flex items-center gap-1.5">
                {(['announcement', 'reminder'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAnnKind(k)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      annKind === k
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    {k === 'reminder' ? 'Reminder' : 'Announcement'}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              required
              maxLength={120}
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder={
                annKind === 'reminder'
                  ? 'e.g. Reminder: Complete your wishlist & address by Friday!'
                  : 'e.g. Office Holiday Exchange starts at 4 PM!'
              }
              className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
            />
            <textarea
              required
              rows={3}
              maxLength={600}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Write your festive note for everyone in this group..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !canDo('ANNOUNCEMENT_SEND')}
              className="min-h-[42px] px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {annKind === 'reminder' ? <Bell className="w-3.5 h-3.5" /> : <Megaphone className="w-3.5 h-3.5" />}
              Publish to Group Board
            </button>
          </form>

          <div className="space-y-2.5">
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-500">No announcements posted yet.</p>
            ) : (
              announcements.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {a.kind === 'reminder' ? '🔔 ' : '📣 '}
                      {a.title}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono-tabular">
                      {a.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{a.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION: GAMES & GINGERBREAD SHOWDOWN */}
      {section === 'games' && selectedGroup && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <h4 className="font-bold text-sm text-slate-900">
              Enable or Pause Group Games & Competitions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  ['mailboxEnabled', 'Anonymous Santa Mailbox'],
                  ['guessingEnabled', 'Guess Your Santa Detective Game'],
                  ['adventEnabled', 'Daily Advent Calendar'],
                  ['wheelEnabled', "Spin Santa's Daily Wheel"],
                  ['elfChallengeEnabled', 'Find the Hidden Elf'],
                  ['quizEnabled', 'Naughty or Nice Quiz'],
                  ['gingerbreadShowdownEnabled', 'Gingerbread Studio & Showdown'],
                  ['deliveryTrackingEnabled', 'Live Gift Tracking'],
                  ['thankYouEnabled', 'Animated Thank-You Cards'],
                  ['snowGlobeRevealEnabled', 'Interactive Magical Snow Globe'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-sm cursor-pointer"
                >
                  <span className="font-medium text-slate-800">{label}</span>
                  <input
                    type="checkbox"
                    disabled={busy || !canDo('GAME_MANAGE')}
                    checked={Boolean(selectedGroup.gamesConfig[key])}
                    onChange={(e) => void handleToggleGame(key, e.target.checked)}
                    className="w-4 h-4 accent-rose-600"
                  />
                </label>
              ))}
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-950 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              Fairness Guard: Gingerbread Showdown vote counts and Santa Stars are automatically tallied by the platform and cannot be manually altered.
            </div>
          </div>
        </div>
      )}

      {/* SECTION: GROUP ACTIVITY LOGS */}
      {section === 'logs' && selectedGroup && (
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900">
            Group Activity Logs ({auditLogs.length})
          </h4>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No logged activity yet for this group.</p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {auditLogs.map((log) => (
                <div key={log.id} className="px-4 py-3 text-xs flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">
                      {log.action.replace(/_/g, ' ')} · {log.targetLabel}
                    </div>
                    <div className="text-slate-600 mt-0.5">{log.reason}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      By {log.actorEmail} ({log.actorRole})
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
    </div>
  );
};
