import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ClipboardPaste, CheckCircle2, X, Sparkles } from 'lucide-react';
import { ImportProvider, ParticipantAddress } from '../../types/secretSanta';
import { ADDRESS_IMPORT_PROVIDERS } from '../../data/hobbies';
import { parsePastedIndianAddress } from '../../utils/addressParser';
import { playPopSound } from '../../utils/sound';

interface AddressImportModalProps {
  provider: ImportProvider;
  onClose: () => void;
  onApplyParsedAddress: (parsed: Partial<ParticipantAddress>) => void;
}

export const AddressImportModal: React.FC<AddressImportModalProps> = ({
  provider,
  onClose,
  onApplyParsedAddress,
}) => {
  const guide = ADDRESS_IMPORT_PROVIDERS[provider];
  const [rawText, setRawText] = useState('');
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  const parsed = useMemo(() => parsePastedIndianAddress(rawText), [rawText]);

  const handlePasteFromClipboard = async () => {
    setClipboardError(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setClipboardError('Clipboard reading is unavailable here — please paste manually below.');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setClipboardError('Your clipboard looks empty. Copy your address from the app first.');
        return;
      }
      playPopSound();
      setRawText(text);
    } catch {
      setClipboardError('Browser blocked clipboard access — simply paste (Ctrl+V / Long-press) in the box below.');
    }
  };

  const hasParsedContent = Boolean(parsed.line1 || parsed.city || parsed.postalCode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-address-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 36 }}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Brand Header */}
        <div
          style={{ backgroundColor: guide.accentBg, color: guide.accentText }}
          className="px-6 py-4 flex items-center justify-between"
        >
          <div>
            <h2 id="import-address-title" className="font-display text-xl font-bold">
              Import address from {guide.name}
            </h2>
            <p className="text-xs opacity-85">
              Safe clipboard import · We never ask for your {guide.name} password
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import modal"
            className="w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <ol className="space-y-2 text-sm text-slate-700">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4" />
              Paste from Clipboard
            </button>
            <button
              type="button"
              onClick={() => {
                playPopSound();
                setRawText(guide.sampleFormat);
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Try sample format
            </button>
          </div>

          {clipboardError && (
            <p className="text-xs text-rose-600 font-medium">{clipboardError}</p>
          )}

          <div>
            <label htmlFor="paste-addr-box" className="block text-xs font-semibold text-slate-600 mb-1.5">
              Pasted {guide.name} address text
            </label>
            <textarea
              id="paste-addr-box"
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Paste your ${guide.name} delivery address here...`}
              className="w-full rounded-2xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            />
          </div>

          {/* Live Parsed Field Preview */}
          {hasParsedContent && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-1.5 text-xs text-emerald-950">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                Auto-detected fields (editable after import)
              </div>
              {parsed.line1 && (
                <p>
                  <span className="font-semibold">Address 1:</span> {parsed.line1}
                </p>
              )}
              {parsed.line2 && (
                <p>
                  <span className="font-semibold">Address 2:</span> {parsed.line2}
                </p>
              )}
              {parsed.landmark && (
                <p>
                  <span className="font-semibold">Landmark:</span> {parsed.landmark}
                </p>
              )}
              <p>
                <span className="font-semibold">City / State / PIN:</span>{' '}
                {[parsed.city, parsed.state, parsed.postalCode].filter(Boolean).join(' · ') || '—'}
              </p>
              {parsed.phone && (
                <p>
                  <span className="font-semibold">Phone:</span> {parsed.phone}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200/70 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasParsedContent}
            onClick={() => {
              playPopSound();
              onApplyParsedAddress(parsed);
              onClose();
            }}
            className="min-h-[44px] px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-sm font-semibold cursor-pointer"
          >
            Fill My Form
          </button>
        </div>
      </motion.div>
    </div>
  );
};
