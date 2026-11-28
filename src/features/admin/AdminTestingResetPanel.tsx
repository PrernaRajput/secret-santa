/**
 * PRE-PUBLISH TESTING ONLY — EASY TO REMOVE BEFORE LAUNCH.
 *
 * Self-contained Admin tab giving the organizer one-click resets for any
 * daily game or workshop feature (event-wide or for a single participant).
 */
import React, { useState } from 'react';
import {
  AlertTriangle,
  FlaskConical,
  Mail,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { ParticipantProfile } from '../../types/secretSanta';
import {
  ADMIN_RESET_TARGETS,
  adminResetFeatureTargets,
  adminSendDummySantaLetter,
  AdminResetTargetId,
  ALL_FEATURE_RESET_IDS,
  DAILY_GAME_RESET_IDS,
} from '../../services/adminTestingResetService';
import { DEFAULT_EVENT_ID } from '../../services/firebase';
import { playChimeSound, playPopSound } from '../../utils/sound';

interface AdminTestingResetPanelProps {
  participants: ParticipantProfile[];
  isLiveEvent: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onSuccess: (message: string) => void;
  onError: (err: unknown, fallback: string) => void;
  onRefreshLists: () => Promise<void>;
}

export const AdminTestingResetPanel: React.FC<AdminTestingResetPanelProps> = ({
  participants,
  isLiveEvent,
  busy,
  setBusy,
  onSuccess,
  onError,
  onRefreshLists,
}) => {
  const [scopeKey, setScopeKey] = useState<string>('ALL');
  const [confirmBulk, setConfirmBulk] = useState<'daily' | 'all' | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [dummySantaMessage, setDummySantaMessage] = useState<string>(
    "Ho ho ho! 🎅✨ Your Secret Santa here from the North Pole! Quick clue before my elves wrap your surprise: sweet treats or cozy desk goodies? Reply right here!"
  );

  const selectedParticipant =
    scopeKey === 'ALL' ? null : participants.find((p) => p.id === scopeKey) || null;
  const scopeLabel = selectedParticipant ? selectedParticipant.name : 'all participants';

  const handleSendDummySanta = async () => {
    setBusy(true);
    setActiveTargetId('dummy-santa-letter');
    try {
      const res = await adminSendDummySantaLetter({
        eventId: DEFAULT_EVENT_ID,
        participantKey: selectedParticipant?.id,
        body: dummySantaMessage,
        isLiveEvent,
      });
      playChimeSound();
      if (res.sentCount === 0) {
        onSuccess(
          isLiveEvent
            ? `No matched incoming mailbox thread found for ${scopeLabel}. Run Secret Santa Matching first.`
            : `Open "Letters from Your Secret Santa" first to preview in local mode.`
        );
      } else {
        onSuccess(
          `Sent a live dummy Secret Santa letter to ${res.sentCount} mailbox${res.sentCount === 1 ? '' : 'es'} (${scopeLabel})!`
        );
      }
    } catch (err) {
      onError(err, 'Could not send dummy Secret Santa letter.');
    } finally {
      setBusy(false);
      setActiveTargetId(null);
    }
  };

  const runReset = async (
    targets: AdminResetTargetId[],
    label: string,
    buttonKey: string
  ) => {
    setBusy(true);
    setActiveTargetId(buttonKey);
    try {
      const res = await adminResetFeatureTargets({
        targets,
        eventId: DEFAULT_EVENT_ID,
        participantKey: selectedParticipant?.id,
        isLiveEvent,
      });
      await onRefreshLists();
      playChimeSound();
      const docSummary = isLiveEvent
        ? ` (${res.deletedDocs} database record${res.deletedDocs === 1 ? '' : 's'} cleared)`
        : ' (local test cache cleared)';
      onSuccess(`Reset ${label} for ${scopeLabel}${docSummary}.`);
    } catch (err) {
      onError(err, `Failed to reset ${label}.`);
    } finally {
      setBusy(false);
      setActiveTargetId(null);
      setConfirmBulk(null);
    }
  };

  const dailyGames = ADMIN_RESET_TARGETS.filter((t) => t.category === 'daily-games');
  const workshopFeatures = ADMIN_RESET_TARGETS.filter((t) => t.category === 'workshop-features');

  return (
    <div className="space-y-5">
      {/* Temporary Pre-Publish Testing Notice */}
      <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
          <FlaskConical className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs sm:text-sm text-amber-950">
          <p className="font-display font-bold text-sm sm:text-base">
            Pre-Publish Testing Reset Lab
          </p>
          <p className="text-amber-900/85">
            Reset any daily game or Workshop feature data to re-test it cleanly without clearing your
            participants or Secret Santa matches. Ask me to remove this tab whenever you&apos;re
            ready to publish!
          </p>
        </div>
      </div>

      {/* Scope Selector + Bulk Reset Actions */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-[220px]">
            <label
              htmlFor="admin-reset-scope"
              className="text-xs font-bold uppercase tracking-wider text-slate-600 inline-flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Reset Scope
            </label>
            <select
              id="admin-reset-scope"
              value={scopeKey}
              onChange={(e) => {
                setScopeKey(e.target.value);
                setConfirmBulk(null);
              }}
              disabled={busy}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
            >
              <option value="ALL">
                All Participants (Event-Wide · {participants.length} registered)
              </option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  Only {p.name} ({p.id.slice(0, 8)}…)
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                playPopSound();
                setConfirmBulk((curr) => (curr === 'daily' ? null : 'daily'));
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All Daily Games
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                playPopSound();
                setConfirmBulk((curr) => (curr === 'all' ? null : 'all'));
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset All Workshop Data
            </button>
          </div>
        </div>

        {/* Inline Confirmation Banner for Bulk Resets */}
        {confirmBulk && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2 text-xs sm:text-sm text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                {confirmBulk === 'daily'
                  ? `Reset all 6 daily games (Hidden Elf, Wheel, Advent, Quiz, Gingerbread & Snow Globe) for ${scopeLabel}?`
                  : `Reset ALL 11 Workshop games & feature datasets (mailbox, delivery, guesses, dislikes, thank-you & daily games) for ${scopeLabel}? Participants and matches stay intact.`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmBulk(null)}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runReset(
                    confirmBulk === 'daily' ? DAILY_GAME_RESET_IDS : ALL_FEATURE_RESET_IDS,
                    confirmBulk === 'daily' ? 'all daily games' : 'all Workshop data',
                    `bulk-${confirmBulk}`
                  )
                }
                className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {busy && activeTargetId === `bulk-${confirmBulk}`
                  ? 'Resetting...'
                  : 'Confirm Reset'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Realtime Test: Send Dummy Letter from Secret Santa */}
      <div className="rounded-2xl bg-indigo-50/70 border border-indigo-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-indigo-950">
                Send Dummy Letter from Secret Santa (Realtime Test)
              </p>
              <p className="text-xs text-indigo-800/80">
                Drops a live message from &quot;Your Secret Santa 🎅&quot; into {scopeLabel}&apos;s incoming mailbox.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={dummySantaMessage}
            onChange={(e) => setDummySantaMessage(e.target.value)}
            maxLength={500}
            disabled={busy}
            aria-label="Dummy Secret Santa message text"
            className="flex-1 min-h-[40px] rounded-xl border border-indigo-200 bg-white px-3 text-xs sm:text-sm text-slate-900"
          />
          <button
            type="button"
            disabled={busy || !dummySantaMessage.trim()}
            onClick={() => void handleSendDummySanta()}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {busy && activeTargetId === 'dummy-santa-letter'
              ? 'Sending...'
              : 'Send Dummy Santa Letter'}
          </button>
        </div>
      </div>

      {/* Section 1: Daily Games */}
      <div className="space-y-2.5">
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-600 inline-flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Daily Games &amp; Collectibles
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dailyGames.map((item) => {
            const isItemBusy = busy && activeTargetId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shrink-0"
                    aria-hidden="true"
                  >
                    {item.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-slate-900 leading-snug">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-600 leading-snug mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runReset([item.id], item.label, item.id)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isItemBusy ? 'animate-spin' : ''}`} />
                  {isItemBusy ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Exchange & Workshop Features */}
      <div className="space-y-2.5">
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-600">
          Workshop &amp; Exchange Feature Data
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {workshopFeatures.map((item) => {
            const isItemBusy = busy && activeTargetId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xl shrink-0"
                    aria-hidden="true"
                  >
                    {item.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-slate-900 leading-snug">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-600 leading-snug mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runReset([item.id], item.label, item.id)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isItemBusy ? 'animate-spin' : ''}`} />
                  {isItemBusy ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
