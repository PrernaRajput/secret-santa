import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, KeyRound, ShieldCheck, X } from 'lucide-react';
import { submitSessionRecoveryRequest } from '../../services/workshopService';

interface SessionRecoveryModalProps {
  open: boolean;
  eventId: string;
  liveMode?: boolean;
  onClose: () => void;
}

export const SessionRecoveryModal: React.FC<SessionRecoveryModalProps> = ({
  open,
  eventId,
  liveMode,
  onClose,
}) => {
  const [requestedName, setRequestedName] = useState('');
  const [verificationHint, setVerificationHint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset form & previous confirmation whenever the dialog closes so guests can file a fresh request cleanly
  useEffect(() => {
    if (!open) {
      setRequestedName('');
      setVerificationHint('');
      setSubmitting(false);
      setResultMsg(null);
      setErrorMsg(null);
    }
  }, [open]);

  // Close cleanly on Escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedName.trim() || submitting) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await submitSessionRecoveryRequest({
        eventId,
        requestedName,
        verificationHint,
        liveMode,
      });
      if (!res.ok) {
        setErrorMsg(res.message);
      } else {
        setResultMsg(res.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!submitting) onClose();
          }}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Lost Invitation Recovery"
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#fffdf7] border-2 border-amber-300 p-6 shadow-2xl relative space-y-4"
          >
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              aria-label="Close recovery dialog"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center text-amber-950 cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl shrink-0">
                🗂️
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 inline-flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" />
                  Santa&apos;s Filing Cabinet
                </p>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Lost Your Invitation or Switched Phones?
                </h2>
              </div>
            </div>

            {resultMsg ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-950 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p>{resultMsg}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full min-h-[44px] rounded-full bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-sm cursor-pointer"
                >
                  Back to Invitation Gate
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Don&apos;t worry — your profile, matches, and collectibles are safe! Request a one-time 24-hour recovery link from your organizer.
                </p>

                <div>
                  <label
                    htmlFor="recovery-name"
                    className="block text-xs font-bold text-slate-800 mb-1"
                  >
                    Your Name (as entered in Secret Santa)
                  </label>
                  <input
                    id="recovery-name"
                    type="text"
                    required
                    maxLength={100}
                    value={requestedName}
                    onChange={(e) => setRequestedName(e.target.value)}
                    placeholder="e.g. Meera Sharma"
                    className="w-full min-h-[42px] rounded-xl border border-amber-300 bg-white px-3.5 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="recovery-hint"
                    className="block text-xs font-bold text-slate-800 mb-1"
                  >
                    How should the organizer reach &amp; verify you? (e.g. group name, WhatsApp, or city)
                  </label>
                  <textarea
                    id="recovery-hint"
                    rows={2}
                    maxLength={240}
                    value={verificationHint}
                    onChange={(e) => setVerificationHint(e.target.value)}
                    placeholder="e.g. Switched to a new phone — please send my recovery link on WhatsApp!"
                    className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>

                {errorMsg && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    For your privacy, recovery links are issued manually by the organizer after out-of-band verification and expire in 24 hours.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !requestedName.trim()}
                  className="w-full min-h-[46px] rounded-full bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Filing Request...' : 'Request Recovery Link 🔑'}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
