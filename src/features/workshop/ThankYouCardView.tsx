import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { Heart, Lock, Send, Sparkles } from 'lucide-react';
import {
  DeliveryAcknowledgmentRecord,
  SecretSantaEvent,
  ThankYouCardRecord,
  ThankYouTemplateId,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import {
  THANK_YOU_REACTIONS,
  THANK_YOU_SUGGESTED_MESSAGES,
  THANK_YOU_TEMPLATES,
} from '../../data/workshopContent';
import {
  fetchThankYouCard,
  sendThankYouCard,
  subscribeToDeliveryAcknowledgment,
} from '../../services/workshopService';
import { playChimeSound, playPopSound } from '../../utils/sound';

interface ThankYouCardViewProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  mode: 'recipient-send' | 'santa-receive';
  assignmentId: string;
  liveMode: boolean;
  onGoToAcknowledge?: () => void;
}

export const ThankYouCardView: React.FC<ThankYouCardViewProps> = ({
  theme,
  event,
  mode,
  assignmentId,
  liveMode,
  onGoToAcknowledge,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [ack, setAck] = useState<DeliveryAcknowledgmentRecord | null>(null);
  const [existingCard, setExistingCard] = useState<ThankYouCardRecord | null>(null);
  const [templateId, setTemplateId] = useState<ThankYouTemplateId>('santa-heart');
  const [message, setMessage] = useState(THANK_YOU_SUGGESTED_MESSAGES[0]);
  const [reactions, setReactions] = useState<string[]>(['🎉', '❤️']);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = subscribeToDeliveryAcknowledgment(assignmentId, event.id, liveMode, setAck);
    fetchThankYouCard(assignmentId, liveMode).then((card) => {
      if (card) setExistingCard(card);
    });
    return () => unsub();
  }, [assignmentId, event.id, liveMode]);

  const toggleReaction = (emoji: string) => {
    playPopSound();
    setReactions((prev) =>
      prev.includes(emoji)
        ? prev.filter((e) => e !== emoji)
        : prev.length < 6
          ? [...prev, emoji]
          : prev
    );
  };

  const handleSendCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const saved = await sendThankYouCard({
        assignmentId,
        eventId: event.id,
        templateId,
        message,
        reactions,
        liveMode,
      });
      setExistingCard(saved);
      playChimeSound();
      confetti({
        particleCount: 100,
        spread: 85,
        origin: { y: 0.55 },
        colors: cfg.confettiColors,
      });
    } finally {
      setSending(false);
    }
  };

  const activeTemplate =
    THANK_YOU_TEMPLATES.find((t) => t.id === (existingCard?.templateId || templateId)) ||
    THANK_YOU_TEMPLATES[0];

  const renderAnimatedCard = (
    tmpl: (typeof THANK_YOU_TEMPLATES)[number],
    cardText: string,
    cardReactions: string[]
  ) => (
    <motion.div
      initial={{ rotateY: -12, opacity: 0.85, scale: 0.96 }}
      animate={{ rotateY: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      className={`rounded-3xl bg-gradient-to-br ${tmpl.gradient} p-6 sm:p-7 text-white shadow-2xl border-2 border-white/30 text-center space-y-4 relative overflow-hidden`}
    >
      <motion.div
        animate={{ y: [0, -8, 0], rotate: [-4, 4, -4] }}
        transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
        className="text-5xl sm:text-6xl drop-shadow-md"
        aria-hidden="true"
      >
        {tmpl.emoji}
      </motion.div>

      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
          {tmpl.title}
        </p>
        <p className="font-display text-xl sm:text-2xl font-bold leading-snug">
          &ldquo;{cardText}&rdquo;
        </p>
      </div>

      {cardReactions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {cardReactions.map((r) => (
            <motion.span
              key={r}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
              className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-lg"
            >
              {r}
            </motion.span>
          ))}
        </div>
      )}

      <p className="text-[11px] text-white/80">
        — Sent with Christmas magic through Santa&apos;s Workshop ✨
      </p>
    </motion.div>
  );

  // SANTA VIEWING RECEIVED CARD
  if (mode === 'santa-receive') {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className={`font-display text-2xl font-bold ${cfg.cardText}`}>
            Thank-You Card from Your Giftee 💝
          </h2>
          <p className={`text-xs sm:text-sm ${cfg.mutedText}`}>
            Once your giftee receives their present and sends a thank-you card, it will bloom right here!
          </p>
        </div>

        {existingCard ? (
          renderAnimatedCard(activeTemplate, existingCard.message, existingCard.reactions)
        ) : (
          <div className="rounded-3xl bg-white/80 border border-black/10 p-8 text-center space-y-2">
            <span className="text-4xl block" aria-hidden="true">💌</span>
            <p className="font-display font-bold text-base text-slate-800">
              No thank-you card yet!
            </p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Your giftee can unlock and send an animated thank-you card as soon as they confirm receiving your gift.
            </p>
          </div>
        )}
      </div>
    );
  }

  // RECIPIENT SENDING CARD (Unlocked ONLY after confirming gift receipt!)
  const unlockedByReceipt = ack?.status === 'received';

  if (!unlockedByReceipt && !existingCard) {
    return (
      <div className="rounded-3xl bg-amber-50 border-2 border-amber-200 p-6 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-bold text-amber-950">
            Animated Thank-You Cards Unlock After Delivery!
          </h2>
          <p className="text-xs sm:text-sm text-amber-900/80 max-w-md mx-auto">
            Confirm that your Christmas surprise has arrived on the Delivery Tracker first, then pick an animated holiday card for your Secret Santa!
          </p>
        </div>
        {onGoToAcknowledge && (
          <button
            type="button"
            onClick={() => {
              playPopSound();
              onGoToAcknowledge();
            }}
            className={`min-h-[44px] px-6 py-2 rounded-full font-display font-bold text-sm cursor-pointer ${cfg.primaryBtnClass}`}
          >
            Go to Delivery Acknowledgment 🎁
          </button>
        )}
      </div>
    );
  }

  if (existingCard) {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Delivered Anonymously to Your Secret Santa ✨
          </p>
          <h2 className={`font-display text-2xl font-bold ${cfg.cardText}`}>
            Your Thank-You Card Has Been Sent! 💝
          </h2>
        </div>
        {renderAnimatedCard(activeTemplate, existingCard.message, existingCard.reactions)}
      </div>
    );
  }

  return (
    <form onSubmit={handleSendCard} className="space-y-5">
      <div className="text-center space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-rose-600 inline-flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" />
          Anonymous Appreciation Card
        </p>
        <h2 className={`font-display text-2xl sm:text-3xl font-bold ${cfg.cardText}`}>
          Send an Animated Thank-You Card 💌
        </h2>
        <p className={`text-xs sm:text-sm ${cfg.mutedText}`}>
          Your card goes straight to your Secret Santa without revealing their identity early!
        </p>
      </div>

      {/* Live Animated Card Preview */}
      {renderAnimatedCard(activeTemplate, message || 'Thank you, Secret Santa!', reactions)}

      {/* Template Picker */}
      <div className="space-y-2">
        <p className={`text-xs font-bold ${cfg.cardText}`}>1. Choose an Animated Card Style</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {THANK_YOU_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => {
                playPopSound();
                setTemplateId(tmpl.id);
              }}
              className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                templateId === tmpl.id
                  ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-300 shadow-sm'
                  : 'bg-white/85 border-slate-200 hover:border-rose-300'
              }`}
            >
              <span className="text-2xl block" aria-hidden="true">{tmpl.emoji}</span>
              <span className="text-[11px] font-bold text-slate-800 block mt-1 leading-tight">
                {tmpl.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Suggested Messages + Custom Input */}
      <div className="space-y-2">
        <p className={`text-xs font-bold ${cfg.cardText}`}>2. Write Your Thank-You Message</p>
        <div className="flex flex-wrap gap-1.5">
          {THANK_YOU_SUGGESTED_MESSAGES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                playPopSound();
                setMessage(m);
              }}
              className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer ${cfg.chipIdleClass}`}
            >
              {m}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          maxLength={300}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell your Secret Santa how much you loved your gift..."
          className={`w-full rounded-2xl border px-4 py-2.5 text-sm ${cfg.inputClass}`}
        />
      </div>

      {/* Emoji Reactions */}
      <div className="space-y-2">
        <p className={`text-xs font-bold flex items-center gap-1.5 ${cfg.cardText}`}>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          3. Add Floating Emoji Reactions (up to 6)
        </p>
        <div className="flex flex-wrap gap-2">
          {THANK_YOU_REACTIONS.map((emoji) => {
            const active = reactions.includes(emoji);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => toggleReaction(emoji)}
                className={`w-10 h-10 rounded-full border text-lg flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
                  active
                    ? 'bg-amber-200 border-amber-500 shadow'
                    : 'bg-white border-slate-200 hover:bg-amber-50'
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-center pt-1">
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className={`min-h-[48px] px-7 py-2.5 rounded-full font-display font-bold text-base inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 ${cfg.primaryBtnClass}`}
        >
          <Send className="w-4 h-4" />
          {sending ? 'Delivering Card...' : 'Send Animated Thank-You Card ✨'}
        </button>
      </div>
    </form>
  );
};
