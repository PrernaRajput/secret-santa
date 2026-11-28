import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Compass,
  ExternalLink,
  Link2,
  LogOut,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { ParticipantGroupSummary, SantaGroup } from '../../types/rbac';
import {
  fetchSantaGroup,
  leaveGroupAsParticipant,
  listDiscoverableGroups,
  submitGroupJoinRequest,
} from '../../services/rbacService';
import {
  getParticipantGroupStatusLabel,
  parseIncomingInviteLocation,
} from '../../utils/rbacLogic';
import { playPopSound } from '../../utils/sound';

interface MyChristmasGroupsModalProps {
  activeGroupId: string;
  savedGroups: ParticipantGroupSummary[];
  currentUserId?: string;
  currentParticipantName?: string;
  onSelectGroup: (groupId: string) => void;
  onJoinViaParsedInvite: (parsed: { kind: 'personal'; token: string } | { kind: 'group'; slug: string; code: string }) => Promise<void>;
  onGroupsChanged: () => void;
  onClose: () => void;
}

const THEME_EMOJI: Record<SantaGroup['theme'], string> = {
  santa: '🎄',
  chocolate: '🍫',
  funny: '🤪',
};

export const MyChristmasGroupsModal: React.FC<MyChristmasGroupsModalProps> = ({
  activeGroupId,
  savedGroups,
  currentUserId = '',
  currentParticipantName = '',
  onSelectGroup,
  onJoinViaParsedInvite,
  onGroupsChanged,
  onClose,
}) => {
  const [tab, setTab] = useState<'my-groups' | 'discover' | 'join-link'>('my-groups');
  const [discoverable, setDiscoverable] = useState<SantaGroup[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Join Request Modal state for discoverable group
  const [requestGroup, setRequestGroup] = useState<SantaGroup | null>(null);
  const [reqName, setReqName] = useState(currentParticipantName);
  const [reqEmail, setReqEmail] = useState('');
  const [reqNote, setReqNote] = useState('');

  useEffect(() => {
    if (tab !== 'discover') return;
    setLoadingDiscover(true);
    listDiscoverableGroups()
      .then(setDiscoverable)
      .finally(() => setLoadingDiscover(false));
  }, [tab]);

  const handleLeave = async (summary: ParticipantGroupSummary) => {
    setBusy(true);
    setFeedback(null);
    try {
      const grp = await fetchSantaGroup(summary.groupId);
      if (!grp) {
        setFeedback({ type: 'err', text: 'Group record not found.' });
        return;
      }
      const res = await leaveGroupAsParticipant(grp, summary.participantKey);
      setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
      if (res.ok) {
        playPopSound();
        onGroupsChanged();
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to leave group right now.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitInviteUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteInput.trim();
    if (!trimmed) return;
    setFeedback(null);
    setBusy(true);
    try {
      let pathname = '/';
      let search = '';
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const u = new URL(trimmed);
        pathname = u.pathname;
        search = u.search;
      } else if (trimmed.includes('?')) {
        const [p, s] = trimmed.split('?');
        pathname = p.startsWith('/') ? p : `/${p}`;
        search = `?${s}`;
      } else if (/^[a-f0-9]{64}$/i.test(trimmed)) {
        search = `?token=${trimmed}`;
      }
      const parsed = parseIncomingInviteLocation(pathname, search);
      if (parsed.kind === 'none') {
        setFeedback({
          type: 'err',
          text: 'Paste a full Group Invitation Link (/g/slug/invite?code=...) or Personal Link (/join?token=...).',
        });
        return;
      }
      await onJoinViaParsedInvite(parsed);
      onClose();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not open that invitation link.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSendJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestGroup || !reqName.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      await submitGroupJoinRequest({
        groupId: requestGroup.id,
        userId: currentUserId,
        requesterName: reqName,
        requesterEmail: reqEmail,
        note: reqNote,
      });
      playPopSound();
      setFeedback({
        type: 'ok',
        text: `Join request sent to the Head Elf of "${requestGroup.name}"! Once approved, they will share your personal invite link.`,
      });
      setRequestGroup(null);
      setReqNote('');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not send join request.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="My Christmas Groups"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-900 via-red-900 to-slate-900 text-white flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold">
              My Christmas Groups 🎄
            </h2>
            <p className="text-xs text-rose-100/80">
              Switch between your Secret Santa exchanges or join another festive group.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close My Christmas Groups"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-navigation */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-200 flex flex-wrap gap-1.5">
          {[
            { id: 'my-groups' as const, label: `My Groups (${savedGroups.length})`, icon: Users },
            { id: 'discover' as const, label: 'Discover Groups', icon: Compass },
            { id: 'join-link' as const, label: 'Join via Link', icon: Link2 },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setFeedback(null);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {feedback && (
            <div
              role="alert"
              className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-medium border ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* TAB 1: MY JOINED GROUPS */}
          {tab === 'my-groups' && (
            <div className="space-y-3">
              {savedGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                  <div className="text-3xl">🎁</div>
                  <h3 className="font-display font-bold text-slate-900">
                    No Joined Groups Saved Yet
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Once you complete your profile in a Secret Santa group, it will appear right here so you can easily switch between office, friend, and family exchanges!
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('join-link')}
                    className="min-h-[40px] px-4 rounded-xl bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Have an Invitation Link?
                  </button>
                </div>
              ) : (
                savedGroups.map((g) => {
                  const isActive = g.groupId === activeGroupId;
                  const statusLabel = getParticipantGroupStatusLabel({
                    status: g.status,
                    isMatched: g.isMatched,
                    recipientRevealAt: g.recipientRevealAt,
                  });
                  return (
                    <div
                      key={g.groupId}
                      className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
                        isActive
                          ? 'border-rose-400 bg-rose-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                          <span>{THEME_EMOJI[g.theme]}</span>
                          <span>{g.name}</span>
                          {isActive && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{statusLabel}</span>
                          <span>·</span>
                          <span>Joined as {g.participantName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              playPopSound();
                              onSelectGroup(g.groupId);
                              onClose();
                            }}
                            className="min-h-[36px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Switch
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleLeave(g)}
                          className="min-h-[36px] px-3 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Leave
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: DISCOVERABLE GROUPS */}
          {tab === 'discover' && (
            <div className="space-y-3">
              {loadingDiscover ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  <Sparkles className="w-5 h-5 mx-auto mb-2 animate-spin text-amber-500" />
                  Finding open Secret Santa groups...
                </div>
              ) : discoverable.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  No discoverable groups are open right now. Private groups can be joined using a Group or Personal Invitation Link!
                </div>
              ) : (
                discoverable.map((grp) => (
                  <div
                    key={grp.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-display font-bold text-base text-slate-900">
                        {THEME_EMOJI[grp.theme]} {grp.name}
                      </div>
                      {grp.description && (
                        <p className="text-xs text-slate-600 mt-0.5">{grp.description}</p>
                      )}
                      <div className="text-[11px] text-slate-500 mt-1">
                        Budget: {grp.budget.currency}
                        {grp.budget.minAmount}
                        {grp.budget.mode === 'range' ? `–${grp.budget.maxAmount}` : ''} ·{' '}
                        {getParticipantGroupStatusLabel(grp)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={grp.status !== 'REGISTRATION_OPEN'}
                      onClick={() => {
                        setRequestGroup(grp);
                        setReqName(currentParticipantName);
                      }}
                      className="min-h-[38px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-45"
                    >
                      {grp.status === 'REGISTRATION_OPEN' ? 'Request to Join' : 'Closed'}
                    </button>
                  </div>
                ))
              )}

              {requestGroup && (
                <form
                  onSubmit={handleSendJoinRequest}
                  className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">
                      Request to Join &ldquo;{requestGroup.name}&rdquo;
                    </h4>
                    <button
                      type="button"
                      onClick={() => setRequestGroup(null)}
                      className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      placeholder="Your name *"
                      className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    />
                    <input
                      type="email"
                      maxLength={160}
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      placeholder="Your email (optional)"
                      className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    maxLength={240}
                    value={reqNote}
                    onChange={(e) => setReqNote(e.target.value)}
                    placeholder="Short note for the Head Elf (e.g. team or how you know the group)"
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Request
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: JOIN VIA LINK */}
          {tab === 'join-link' && (
            <form onSubmit={handleSubmitInviteUrl} className="space-y-4">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
                <p className="font-bold text-slate-900">Supports both invitation link types:</p>
                <p>
                  <strong>1. Group Invitation Link:</strong>{' '}
                  <code>/g/group-slug/invite?code=...</code> — opens that Secret Santa group so you can register your own profile &amp; wishlist.
                </p>
                <p>
                  <strong>2. Personal Invitation Link:</strong>{' '}
                  <code>/join?token=...</code> — claims your private one-time personal invitation or recovery token.
                </p>
              </div>

              <input
                type="text"
                required
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="Paste invitation link or 64-character token..."
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
              />

              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {busy ? 'Checking Link...' : 'Open Secret Santa Group'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
