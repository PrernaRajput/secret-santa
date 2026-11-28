import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  Flag,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  AnonymousConversationMeta,
  AnonymousMessage,
  MailboxRole,
  SecretSantaEvent,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { MAILBOX_SUGGESTED_QUESTIONS } from '../../data/workshopContent';
import { formatFriendlyFirestoreError } from '../../services/firebase';
import {
  markMailboxRead,
  reportAnonymousMessage,
  sendAnonymousMessage,
  subscribeToAnonymousConversation,
} from '../../services/workshopService';
import { isMailboxWindowOpen } from '../../utils/workshopLogic';
import { playMailboxWhooshSound, playPopSound } from '../../utils/sound';

// PRE-PUBLISH TESTING ONLY — remove dummy auto-seed before launch.
const DUMMY_SECRET_SANTA_GREETING =
  "Ho ho ho! 🎅✨ Your Secret Santa here from the North Pole! I'm finalizing your surprise — quick clue: do you prefer cozy hot-chocolate & desk goodies, or sweet treats & fun collectibles? Reply right here and my elves will wrap it up!";

interface AnonymousMailboxViewProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  role: MailboxRole;
  assignmentId: string;
  recipientDisplayName?: string;
  serverNow: Date;
  liveMode: boolean;
}

export const AnonymousMailboxView: React.FC<AnonymousMailboxViewProps> = ({
  theme,
  event,
  role,
  assignmentId,
  recipientDisplayName,
  serverNow,
  liveMode,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [messages, setMessages] = useState<AnonymousMessage[]>([]);
  const [hasSyncedSnapshot, setHasSyncedSnapshot] = useState(false);
  const [meta, setMeta] = useState<AnonymousConversationMeta | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [flyingEnvelope, setFlyingEnvelope] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const seedingRef = useRef(false);

  const windowCheck = liveMode
    ? isMailboxWindowOpen(event, serverNow)
    : { open: true };

  useEffect(() => {
    setHasSyncedSnapshot(false);
    setError(null);
    const unsub = subscribeToAnonymousConversation(
      assignmentId,
      liveMode,
      (list) => {
        setMessages(list);
        setHasSyncedSnapshot(true);
      },
      setMeta,
      (errMsg) => setError(errMsg)
    );
    return () => unsub();
  }, [assignmentId, liveMode]);

  // PRE-PUBLISH TESTING ONLY — Auto-seed one festive dummy message from Secret Santa
  // the first time the recipient opens an empty "Letters from Your Secret Santa" inbox.
  useEffect(() => {
    if (role !== 'recipient') return;
    if (!hasSyncedSnapshot || messages.length > 0 || !windowCheck.open) return;
    if (!assignmentId || seedingRef.current) return;
    if (liveMode && !/^[a-f0-9]{64}$/.test(assignmentId)) return;

    const seedFlagKey = `ss_p2_dummy_santa_seeded_${assignmentId}`;
    try {
      if (window.sessionStorage.getItem(seedFlagKey)) return;
      window.sessionStorage.setItem(seedFlagKey, '1');
    } catch {
      // continue even if sessionStorage is unavailable
    }

    seedingRef.current = true;
    void sendAnonymousMessage({
      event,
      assignmentId,
      senderRole: 'santa',
      rawBody: DUMMY_SECRET_SANTA_GREETING,
      serverNow,
      liveMode,
    })
      .catch(() => {
        // Non-blocking pre-publish seed failure
      })
      .finally(() => {
        seedingRef.current = false;
      });
  }, [assignmentId, event, hasSyncedSnapshot, liveMode, messages.length, role, serverNow, windowCheck.open]);

  useEffect(() => {
    if (messages.length > 0) {
      void markMailboxRead(assignmentId, role, liveMode);
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages.length, assignmentId, role, liveMode]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || sending) return;
    setError(null);
    setSending(true);
    try {
      const res = await sendAnonymousMessage({
        event,
        assignmentId,
        senderRole: role,
        rawBody: draft,
        serverNow,
        liveMode,
      });
      if (!res.ok) {
        setError(res.error || 'Could not send message.');
        return;
      }
      playMailboxWhooshSound();
      setFlyingEnvelope(true);
      window.setTimeout(() => setFlyingEnvelope(false), 750);
      setDraft('');
    } catch (err) {
      setError(
        formatFriendlyFirestoreError(
          err,
          'Could not deliver your letter right now. Please make sure the mailbox is open and try again.'
        ).message
      );
    } finally {
      setSending(false);
    }
  };

  const handleReport = async (msgId: string) => {
    setReportingId(msgId);
    try {
      await reportAnonymousMessage({
        assignmentId,
        messageId: msgId,
        reason: 'Participant flagged message for organizer review',
        liveMode,
      });
    } finally {
      setReportingId(null);
    }
  };

  const isSantaView = role === 'santa';
  const hasUnreadFlag =
    (isSantaView && (meta?.unreadForSanta || 0) > 0) ||
    (!isSantaView && (meta?.unreadForRecipient || 0) > 0);

  return (
    <div className="space-y-5">
      {/* Header Banner + Animated 3D Red Mailbox Illustration */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 ${
          isSantaView
            ? 'bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-rose-200'
            : 'bg-gradient-to-r from-indigo-50 via-sky-50 to-amber-50 border-indigo-200'
        }`}
      >
        {/* Stylized SVG Red Mailbox with Rising Flag & Flying Envelope */}
        <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-md" aria-hidden="true">
            {/* Post */}
            <rect x="44" y="64" width="12" height="32" rx="3" fill="#78350f" />
            {/* Snow mound */}
            <ellipse cx="50" cy="95" rx="34" ry="5" fill="#e0f2fe" />
            {/* Mailbox Body */}
            <path d="M18 42 C18 24 34 18 52 18 L76 18 C84 18 88 26 88 42 L88 66 L18 66 Z" fill="#dc2626" />
            <path d="M18 42 C18 24 32 18 42 18 C52 18 56 26 56 42 L56 66 L18 66 Z" fill="#991b1b" />
            {/* Snow Cap */}
            <path d="M22 25 C34 14 68 14 84 24 C78 29 64 25 52 29 C40 25 28 29 22 25 Z" fill="#ffffff" />
            {/* Little Gold Flag */}
            <motion.g
              animate={{ rotate: hasUnreadFlag || flyingEnvelope ? -68 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              style={{ originX: '72px', originY: '48px' }}
            >
              <rect x="70" y="30" width="4" height="22" rx="2" fill="#f59e0b" />
              <polygon points="74,30 88,34 74,40" fill="#fbbf24" />
            </motion.g>
            {/* Slot */}
            <rect x="24" y="38" width="24" height="6" rx="3" fill="#450a0a" />
          </svg>

          <AnimatePresence>
            {flyingEnvelope && (
              <motion.span
                initial={{ opacity: 0, x: -30, y: 20, scale: 0.7, rotate: -15 }}
                animate={{ opacity: 1, x: 16, y: -26, scale: 1.15, rotate: 12 }}
                exit={{ opacity: 0, x: 40, y: -42, scale: 0.5 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
                className="absolute text-2xl pointer-events-none"
                aria-hidden="true"
              >
                ✉️
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center sm:text-left space-y-1 flex-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700">
            <Mail className="w-3.5 h-3.5" />
            {isSantaView ? 'My Secret Mission · Sender View' : 'Incoming Magic · Recipient View'}
          </div>
          <h2 className={`font-display text-2xl font-bold ${cfg.cardText}`}>
            {isSantaView
              ? `Message ${recipientDisplayName || 'Your Giftee'} Anonymously`
              : 'Letters from Your Secret Santa 💌'}
          </h2>
          <p className={`text-xs sm:text-sm ${cfg.mutedText}`}>
            {isSantaView
              ? 'Ask for gift hints! Your recipient will ONLY see "Your Secret Santa 🎅" — never your name.'
              : 'Chat directly with your Secret Santa while keeping their identity 100% hidden until Reveal Day.'}
          </p>
        </div>
      </div>

      {/* Role Separation Safeguard Note */}
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>
          Identity protected: Messages route through an opaque North Pole thread ID. Phone numbers &amp; emails are automatically blocked.
        </span>
      </div>

      {/* Letter-Paper Thread View */}
      <div
        className="rounded-3xl border border-amber-200 bg-[#fffdf7] p-4 sm:p-5 min-h-[260px] max-h-[380px] overflow-y-auto space-y-3 shadow-inner"
        style={{
          backgroundImage:
            'repeating-linear-gradient(transparent, transparent 29px, rgba(217,119,6,0.08) 30px)',
        }}
      >
        {messages.length === 0 ? (
          <div className="py-12 text-center space-y-2 text-amber-900/75">
            <span className="text-4xl block" aria-hidden="true">📮</span>
            <p className="font-display font-bold text-base">No secret letters yet!</p>
            <p className="text-xs max-w-sm mx-auto">
              {isSantaView
                ? 'Tap a suggested question below or send your first anonymous hint request.'
                : 'When your Secret Santa writes to you, their festive envelopes will appear here.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderRole === role;
            const authorLabel =
              msg.senderRole === 'santa'
                ? isMine
                  ? 'You (as Secret Santa 🎅)'
                  : 'Your Secret Santa 🎅'
                : isMine
                  ? 'You'
                  : recipientDisplayName || 'Your Giftee 🎁';

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm border ${
                    isMine
                      ? 'bg-rose-600 text-white border-rose-700 rounded-br-sm'
                      : 'bg-white text-slate-900 border-amber-200 rounded-bl-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span
                      className={`text-[11px] font-bold ${
                        isMine ? 'text-rose-100' : 'text-rose-700'
                      }`}
                    >
                      {authorLabel}
                    </span>
                    <span
                      className={`text-[10px] font-mono-tabular ${
                        isMine ? 'text-rose-100/80' : 'text-slate-400'
                      }`}
                    >
                      {msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.body}
                  </p>
                  {!isMine && (
                    <div className="mt-1.5 flex justify-end">
                      {msg.reported ? (
                        <span className="text-[10px] font-semibold text-amber-700">
                          Flagged for organizer review
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={reportingId === msg.id}
                          onClick={() => void handleReport(msg.id)}
                          className="text-[10px] text-slate-400 hover:text-rose-600 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Flag className="w-3 h-3" />
                          Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Suggested Question Chips (Great for Santa asking clues!) */}
      {windowCheck.open && (
        <div className="space-y-2">
          <p className={`text-xs font-bold flex items-center gap-1.5 ${cfg.mutedText}`}>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Quick Festive Prompts:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MAILBOX_SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  playPopSound();
                  setDraft(q);
                }}
                className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold border transition-transform active:scale-95 cursor-pointer ${cfg.chipIdleClass}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Composer or Closed Window Notice */}
      {windowCheck.open ? (
        <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder={
              isSantaView
                ? 'Write an anonymous clue request to your giftee...'
                : 'Reply anonymously to your Secret Santa...'
            }
            aria-label="Anonymous message text"
            className={`flex-1 min-h-[46px] rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 ${cfg.inputClass}`}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className={`min-h-[46px] px-6 py-2.5 rounded-2xl font-display font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${cfg.primaryBtnClass}`}
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Drop in Mailbox'}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl bg-slate-100 border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>{windowCheck.reason}</span>
        </div>
      )}
    </div>
  );
};
