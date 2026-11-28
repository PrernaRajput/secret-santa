import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gift,
  Heart,
  Lock,
  PackageCheck,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Truck,
} from 'lucide-react';
import {
  DeliveryAcknowledgmentRecord,
  DeliveryProgressRecord,
  DeliveryStage,
  SecretSantaEvent,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { DELIVERY_STAGES } from '../../data/workshopContent';
import {
  fetchPrivateTracking,
  savePrivateTracking,
  submitDeliveryAcknowledgment,
  subscribeToDeliveryAcknowledgment,
  subscribeToDeliveryProgress,
  updateDeliveryStage,
} from '../../services/workshopService';
import { getDeliveryStageInfo } from '../../utils/workshopLogic';
import { playChimeSound, playPopSound } from '../../utils/sound';

interface DeliveryTrackerViewProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  mode: 'sender' | 'recipient';
  assignmentId: string;
  participantKey: string;
  recipientDisplayName?: string;
  liveMode: boolean;
  onOpenThankYouCard?: () => void;
}

const HEX_ASSIGNMENT_RE = /^[a-f0-9]{64}$/;

export const DeliveryTrackerView: React.FC<DeliveryTrackerViewProps> = ({
  theme,
  event,
  mode,
  assignmentId,
  participantKey,
  recipientDisplayName,
  liveMode,
  onOpenThankYouCard,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const isWaitingForLiveAssignment = liveMode && !HEX_ASSIGNMENT_RE.test(assignmentId);

  const [progress, setProgress] = useState<DeliveryProgressRecord | null>(null);
  const [ack, setAck] = useState<DeliveryAcknowledgmentRecord | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(!isWaitingForLiveAssignment);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [sharedNote, setSharedNote] = useState('');
  const [updatingStage, setUpdatingStage] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  const lastSyncedNoteRef = useRef<string | null>(null);

  // Sender-only private tracking fields (NEVER shared with recipient)
  const [courierName, setCourierName] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [savingPrivate, setSavingPrivate] = useState(false);

  // Recipient problem report fields
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [problemSummary, setProblemSummary] = useState('');
  const [submittingAck, setSubmittingAck] = useState(false);

  useEffect(() => {
    lastSyncedNoteRef.current = null;
    setSyncError(null);

    if (isWaitingForLiveAssignment) {
      setProgress(null);
      setAck(null);
      setLoadingProgress(false);
      return;
    }

    setLoadingProgress(true);
    const unsubProg = subscribeToDeliveryProgress(
      assignmentId,
      event.id,
      liveMode,
      (rec) => {
        setLoadingProgress(false);
        setSyncError(null);
        setProgress(rec);
        const serverNote = rec.sharedNote || '';
        if (lastSyncedNoteRef.current === null || lastSyncedNoteRef.current !== serverNote) {
          lastSyncedNoteRef.current = serverNote;
          setSharedNote(serverNote);
        }
      },
      (errMsg) => {
        setLoadingProgress(false);
        setSyncError(errMsg);
      }
    );
    const unsubAck = subscribeToDeliveryAcknowledgment(
      assignmentId,
      event.id,
      liveMode,
      (rec) => {
        setAck(rec);
      },
      (errMsg) => {
        setSyncError((prev) => prev || errMsg);
      }
    );
    return () => {
      unsubProg();
      unsubAck();
    };
  }, [assignmentId, event.id, isWaitingForLiveAssignment, liveMode, retryTick]);

  useEffect(() => {
    if (mode !== 'sender') return;
    let active = true;
    fetchPrivateTracking(participantKey, event.id, liveMode).then((priv) => {
      if (!active) return;
      setCourierName(priv.courierName);
      setTrackingCode(priv.trackingCode);
      setPrivateNote(priv.privateNote);
    });
    return () => {
      active = false;
    };
  }, [mode, participantKey, event.id, liveMode]);

  if (!event.deliveryTrackingEnabled) {
    return (
      <div className="rounded-3xl bg-white/90 border border-black/10 p-6 text-center space-y-2">
        <h2 className={`font-display text-2xl font-bold ${cfg.cardText}`}>
          Santa&apos;s Delivery Express 🛷
        </h2>
        <p className="text-sm text-slate-600">
          Gift delivery tracking is currently paused by the event organizer.
        </p>
      </div>
    );
  }

  if (isWaitingForLiveAssignment) {
    return (
      <div className="rounded-3xl bg-white/90 border border-amber-200 p-6 text-center space-y-2.5">
        <div className="mx-auto w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 animate-spin" />
        </div>
        <h2 className={`font-display text-xl font-bold ${cfg.cardText}`}>
          Syncing Your Live Sleigh Channel...
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {mode === 'sender'
            ? 'Your outgoing gift tracker will unlock as soon as your giftee assignment finishes syncing from Santa’s vault.'
            : 'Connecting to your live incoming gift channel from the database. Please wait a moment.'}
        </p>
      </div>
    );
  }

  const currentStage: DeliveryStage = progress?.stage || 'preparing';
  const stageInfo = getDeliveryStageInfo(currentStage);
  const currentStageIdx = Math.max(
    0,
    DELIVERY_STAGES.findIndex((s) => s.id === currentStage)
  );
  // Align fill and sleigh cleanly across the 5 equal grid column centers (0%..100% of inner 10%-90% rail)
  const railProgressPercent =
    DELIVERY_STAGES.length > 1
      ? (currentStageIdx / (DELIVERY_STAGES.length - 1)) * 100
      : 0;

  const handleAdvanceStage = async (targetStage: DeliveryStage) => {
    if (loadingProgress || !progress || updatingStage) return;
    setUpdatingStage(true);
    setStatusFeedback(null);
    setErrorFeedback(null);
    try {
      const res = await updateDeliveryStage({
        assignmentId,
        eventId: event.id,
        currentStage,
        nextStage: targetStage,
        history: progress.history,
        sharedNote,
        liveMode,
      });
      if (!res.ok) {
        setErrorFeedback(res.error || 'Could not update delivery checkpoint.');
        return;
      }
      playPopSound();
      if (res.record) {
        setProgress(res.record);
        lastSyncedNoteRef.current = res.record.sharedNote || '';
      }
      setStatusFeedback(
        targetStage === currentStage
          ? 'Saved your anonymous sleigh note for your giftee!'
          : `Sleigh checkpoint updated to "${getDeliveryStageInfo(targetStage).label}"!`
      );
    } catch {
      setErrorFeedback('Could not update delivery checkpoint right now. Please try again.');
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleSavePrivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPrivate) return;
    setSavingPrivate(true);
    setStatusFeedback(null);
    setErrorFeedback(null);
    try {
      const res = await savePrivateTracking(
        {
          eventId: event.id,
          participantKey,
          courierName,
          trackingCode,
          privateNote,
        },
        liveMode
      );
      if (!res.ok) {
        setErrorFeedback(
          res.error || 'Could not save your private courier note right now. Please try again.'
        );
        return;
      }
      playPopSound();
      setStatusFeedback('Saved your private courier reference (only you can see this).');
    } catch {
      setErrorFeedback('Could not save your private courier note right now. Please try again.');
    } finally {
      setSavingPrivate(false);
    }
  };

  const handleConfirmReceived = async () => {
    if (loadingProgress || submittingAck) return;
    setSubmittingAck(true);
    setStatusFeedback(null);
    setErrorFeedback(null);
    try {
      const res = await submitDeliveryAcknowledgment({
        assignmentId,
        eventId: event.id,
        status: 'received',
        liveMode,
      });
      if (!res.ok || !res.record) {
        setErrorFeedback(
          res.error ||
            'Could not confirm receipt right now. Please check your connection and try again.'
        );
        return;
      }
      setAck(res.record);
      setShowProblemForm(false);
      playChimeSound();
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: cfg.confettiColors,
      });
    } catch {
      setErrorFeedback('Could not confirm receipt right now. Please check your connection and try again.');
    } finally {
      setSubmittingAck(false);
    }
  };

  const handleSubmitProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingProgress || !problemSummary.trim() || submittingAck) return;
    setSubmittingAck(true);
    setStatusFeedback(null);
    setErrorFeedback(null);
    try {
      const res = await submitDeliveryAcknowledgment({
        assignmentId,
        eventId: event.id,
        status: 'problem',
        problemSummary,
        liveMode,
      });
      if (!res.ok || !res.record) {
        setErrorFeedback(
          res.error || 'Could not submit the delivery report right now. Please try again.'
        );
        return;
      }
      setAck(res.record);
      setShowProblemForm(false);
      setProblemSummary('');
      playPopSound();
      setStatusFeedback('Delivery issue sent to the organizer — your Secret Santa stays anonymous.');
    } catch {
      setErrorFeedback('Could not submit the delivery report right now. Please try again.');
    } finally {
      setSubmittingAck(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Snowy North Pole Sleigh Map */}
      <div className="rounded-3xl bg-gradient-to-b from-sky-950 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 relative overflow-hidden shadow-xl border border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
              {mode === 'sender'
                ? `Santa's Delivery Express · Sending to ${recipientDisplayName || 'Your Giftee'}`
                : "Santa's Delivery Express · Incoming Surprise"}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              {loadingProgress ? 'Syncing Sleigh Status...' : `${stageInfo.emoji} ${stageInfo.label}`}
            </h2>
          </div>

          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-sky-100">
            {loadingProgress
              ? 'Loading from database...'
              : `Checkpoint ${currentStageIdx + 1} of ${DELIVERY_STAGES.length}`}
          </span>
        </div>

        {/* Sparkling Snowy Map Route (Aligned precisely to 5 node centers: 10% -> 90%) */}
        <div className="relative pt-10 pb-2">
          <div className="relative mx-[10%]">
            {/* Track Background */}
            <div className="h-2.5 rounded-full bg-white/15 overflow-hidden relative">
              <motion.div
                initial={false}
                animate={{ width: `${Math.max(4, railProgressPercent)}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300 shadow-[0_0_16px_rgba(251,191,36,0.9)]"
              />
            </div>

            {/* Animated Miniature Reindeer Sleigh centered cleanly over active checkpoint */}
            <motion.div
              initial={false}
              animate={{ left: `${railProgressPercent}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              style={{ transform: 'translateX(-50%)' }}
              className="absolute -top-9 flex items-center gap-0.5 text-2xl sm:text-3xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] pointer-events-none select-none"
              aria-hidden="true"
            >
              <span>🛷</span>
              <span className="text-lg">🦌</span>
            </motion.div>
          </div>

          {/* 5 Checkpoint Nodes */}
          <div className="grid grid-cols-5 gap-1 mt-4">
            {DELIVERY_STAGES.map((st, idx) => {
              const reached = idx <= currentStageIdx;
              return (
                <div key={st.id} className="text-center space-y-1">
                  <div
                    className={`mx-auto w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                      reached
                        ? 'bg-amber-300 text-slate-950 border-white shadow'
                        : 'bg-white/10 text-white/50 border-white/20'
                    }`}
                  >
                    {reached ? '✓' : idx + 1}
                  </div>
                  <p
                    className={`text-[10px] sm:text-xs font-semibold leading-tight ${
                      reached ? 'text-amber-100' : 'text-slate-400'
                    }`}
                  >
                    {st.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Playful Anonymous Status Message */}
        <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-xs sm:text-sm text-sky-50 flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span>
            {mode === 'recipient'
              ? stageInfo.recipientMessage
              : `Your giftee sees: "${stageInfo.recipientMessage}"`}
          </span>
        </div>

        {progress?.sharedNote && (
          <p className="mt-2 text-xs text-amber-200/90 italic px-1">
            Santa&apos;s delivery note: &ldquo;{progress.sharedNote}&rdquo;
          </p>
        )}

        {!liveMode && (
          <p className="mt-2 text-[11px] text-sky-200/80 px-1">
            Interactive preview mode — once the organizer runs matching, live checkpoints sync automatically between Santa and giftee.
          </p>
        )}
      </div>

      {syncError && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-xs font-semibold text-amber-950 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              playPopSound();
              setRetryTick((n) => n + 1);
            }}
            className="min-h-[34px] px-3 py-1 rounded-xl bg-amber-900 hover:bg-amber-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Sync
          </button>
        </div>
      )}

      {errorFeedback && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-900 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorFeedback}</span>
        </div>
      )}

      {statusFeedback && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* SENDER CONTROLS (My Secret Mission) */}
      {mode === 'sender' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white/85 border border-black/10 p-4 sm:p-5 space-y-4">
            <div>
              <h3 className={`font-display text-lg font-bold ${cfg.cardText}`}>
                Update Sleigh Progress
              </h3>
              <p className={`text-xs ${cfg.mutedText}`}>
                Move the sleigh forward as you prep and send your gift. Your giftee receives fun anonymous progress updates!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DELIVERY_STAGES.map((st, idx) => {
                const isPastOrCurrent = idx <= currentStageIdx;
                const isCurrent = st.id === currentStage;
                return (
                  <button
                    key={st.id}
                    type="button"
                    disabled={loadingProgress || updatingStage || idx < currentStageIdx}
                    onClick={() => void handleAdvanceStage(st.id)}
                    className={`min-h-[48px] px-3.5 py-2.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer disabled:cursor-not-allowed ${
                      isCurrent
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-300/60'
                        : isPastOrCurrent
                          ? 'bg-slate-50 border-slate-200 text-slate-400'
                          : 'bg-white hover:bg-amber-50 border-slate-200 hover:border-amber-300 text-slate-900'
                    }`}
                  >
                    <span className="text-xl shrink-0" aria-hidden="true">{st.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm">{st.label}</p>
                      <p className="text-[11px] opacity-75 truncate">{st.senderPrompt}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div>
              <label
                htmlFor="delivery-shared-note"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Optional Anonymous Sleigh Note (visible to giftee — keep your identity secret!)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="delivery-shared-note"
                  type="text"
                  maxLength={240}
                  value={sharedNote}
                  onChange={(e) => setSharedNote(e.target.value)}
                  placeholder="e.g. Watch for a festive parcel arriving by Friday evening!"
                  className={`flex-1 min-h-[42px] rounded-xl border px-3.5 text-sm ${cfg.inputClass}`}
                />
                <button
                  type="button"
                  disabled={loadingProgress || updatingStage}
                  onClick={() => void handleAdvanceStage(currentStage)}
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${cfg.secondaryBtnClass}`}
                >
                  {updatingStage ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>

            {/* Recipient's Independent Receipt Status (Read-Only for Sender!) */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <PackageCheck
                  className={`w-5 h-5 shrink-0 ${
                    ack?.status === 'received'
                      ? 'text-emerald-600'
                      : ack?.status === 'problem'
                        ? 'text-rose-600'
                        : 'text-slate-400'
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Recipient Receipt Confirmation (Independent)
                  </p>
                  <p className="text-xs text-slate-600">
                    {ack?.status === 'received'
                      ? '🎉 Your giftee confirmed their Christmas surprise arrived safely!'
                      : ack?.status === 'problem'
                        ? `⚠️ Delivery issue reported: ${ack.problemSummary || 'Organizer notified.'}`
                        : 'Waiting for your giftee to tap "Yes, I received it!" once it arrives.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sender-Only Private Courier Reference Box */}
          <form
            onSubmit={handleSavePrivate}
            className="rounded-3xl bg-amber-50/75 border border-amber-200 p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-amber-950">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <h3 className="font-display font-bold text-base">
                Private Courier Tracking Vault (Only You See This)
              </h3>
            </div>
            <p className="text-xs text-amber-900/80">
              Store your Amazon/BlueDart/Delhivery order info here for your own reference. It is NEVER shared with your recipient.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                maxLength={80}
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="Courier / Store (e.g. Amazon, Blinkit)"
                className="min-h-[42px] rounded-xl border border-amber-300 bg-white px-3.5 text-sm text-slate-900"
              />
              <input
                type="text"
                maxLength={120}
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="Order ID or Tracking Number"
                className="min-h-[42px] rounded-xl border border-amber-300 bg-white px-3.5 text-sm font-mono-tabular text-slate-900"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                maxLength={240}
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                placeholder="Private reminder note..."
                className="flex-1 min-h-[42px] rounded-xl border border-amber-300 bg-white px-3.5 text-sm text-slate-900"
              />
              <button
                type="submit"
                disabled={savingPrivate}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingPrivate ? 'Saving...' : 'Save Privately'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RECIPIENT DELIVERY ACKNOWLEDGMENT (Feature 11 — Strictly Independent!) */}
      {mode === 'recipient' && (
        <div className="rounded-3xl bg-white/90 border-2 border-amber-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Gift className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className={`font-display text-xl font-bold ${cfg.cardText}`}>
                Has your Christmas surprise arrived? 🎁
              </h3>
              <p className={`text-xs sm:text-sm ${cfg.mutedText}`}>
                Confirming delivery lets your Secret Santa celebrate anonymously and unlocks Animated Thank-You Cards!
              </p>
            </div>
          </div>

          {ack?.status === 'received' ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Gift Receipt Confirmed! Santa&apos;s elves are doing a victory dance! 🎉</span>
              </div>
              {ack.adminCorrectionNote && (
                <p className="text-xs text-emerald-800">
                  Organizer note: {ack.adminCorrectionNote}
                </p>
              )}
              {onOpenThankYouCard && event.thankYouEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    onOpenThankYouCard();
                  }}
                  className={`min-h-[44px] px-5 py-2 rounded-full font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer ${cfg.primaryBtnClass}`}
                >
                  <Heart className="w-4 h-4" />
                  Send an Animated Thank-You Card 💌
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {ack?.status === 'problem' && (
                <div className="rounded-2xl bg-amber-50 border border-amber-300 p-3.5 text-xs text-amber-950 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Issue reported to the organizer:</p>
                    <p>{ack.problemSummary}</p>
                    <p className="mt-1 opacity-75">
                      Once your package arrives, you can still tap &ldquo;Yes, I received it!&rdquo; below.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={loadingProgress || submittingAck}
                  onClick={() => void handleConfirmReceived()}
                  className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-sm inline-flex items-center gap-2 shadow cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Yes, I received it! 🎁
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setShowProblemForm(false);
                    setErrorFeedback(null);
                    setStatusFeedback('No worries! Santa’s sleigh is still flying your way 🛷');
                  }}
                  className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  Not yet
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setShowProblemForm((v) => !v);
                  }}
                  className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-semibold text-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Report a delivery problem
                </button>
              </div>

              {showProblemForm && (
                <form
                  onSubmit={handleSubmitProblem}
                  className="rounded-2xl bg-rose-50/70 border border-rose-200 p-4 space-y-2.5"
                >
                  <label
                    htmlFor="delivery-problem-input"
                    className="block text-xs font-bold text-rose-900"
                  >
                    Tell the organizer what happened (your Secret Santa stays anonymous)
                  </label>
                  <textarea
                    id="delivery-problem-input"
                    rows={2}
                    maxLength={300}
                    required
                    value={problemSummary}
                    onChange={(e) => setProblemSummary(e.target.value)}
                    placeholder="e.g. Package marked delivered 2 days ago, but security desk hasn't received it..."
                    className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={loadingProgress || submittingAck || !problemSummary.trim()}
                    className="min-h-[40px] px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Send Delivery Issue to Organizer
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sleigh Checkpoint History Log */}
      {progress && progress.history.length > 0 && (
        <div className="rounded-3xl bg-white/80 border border-black/10 p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
            <Clock className="w-3.5 h-3.5" />
            <span>Sleigh Checkpoint Log</span>
          </div>
          <ol className="space-y-1.5 text-xs text-slate-700">
            {[...progress.history].reverse().slice(0, 6).map((entry, idx) => {
              const info = getDeliveryStageInfo(entry.stage);
              const ts = new Date(entry.atIso);
              const formattedTime = Number.isNaN(ts.getTime())
                ? ''
                : ts.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  });
              return (
                <li
                  key={`${entry.stage}-${entry.atIso}-${idx}`}
                  className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 border border-slate-100"
                >
                  <span className="font-semibold text-slate-900">
                    {info.emoji} {info.label}
                    {entry.note ? <span className="font-normal text-slate-600"> — {entry.note}</span> : null}
                  </span>
                  {formattedTime && (
                    <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
                      {formattedTime}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
};
