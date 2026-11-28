import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, MapPin, Plus, User, X, AlertCircle } from 'lucide-react';
import {
  ImportProvider,
  ParticipantAddress,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import { FestiveCharacters, ThemeCardTrim } from '../../components/themes/FestiveCharacters';
import { HOBBY_OPTIONS } from '../../data/hobbies';
import { participantFormSchema } from '../../utils/addressParser';
import { AddressImportModal } from './AddressImportModal';
import { playPopSound } from '../../utils/sound';

interface DetailsScreenProps {
  theme: ThemeId;
  initialName: string;
  initialAddress: ParticipantAddress;
  initialHobbies: string[];
  saving: boolean;
  onSubmit: (data: {
    name: string;
    address: ParticipantAddress;
    hobbies: string[];
  }) => Promise<void>;
}

const IMPORT_BUTTONS: { id: ImportProvider; label: string; styleClass: string }[] = [
  {
    id: 'blinkit',
    label: 'blinkit',
    styleClass: 'bg-[#F8CB46] hover:bg-[#f2bf2c] text-stone-950 font-extrabold border-amber-500/50',
  },
  {
    id: 'amazon',
    label: 'amazon',
    styleClass: 'bg-[#232F3E] hover:bg-[#1a2430] text-white font-bold border-slate-700',
  },
  {
    id: 'zomato',
    label: 'zomato',
    styleClass: 'bg-[#E23744] hover:bg-[#cc2a37] text-white font-extrabold italic border-rose-700',
  },
  {
    id: 'flipkart',
    label: 'Flipkart',
    styleClass: 'bg-[#2874F0] hover:bg-[#1f63d4] text-white font-bold border-blue-700',
  },
];

export const DetailsScreen: React.FC<DetailsScreenProps> = ({
  theme,
  initialName,
  initialAddress,
  initialHobbies,
  saving,
  onSubmit,
}) => {
  const cfg = THEME_CONFIGS[theme];

  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState<ParticipantAddress>(initialAddress);
  const [hobbies, setHobbies] = useState<string[]>(initialHobbies);
  const [customHobby, setCustomHobby] = useState('');
  const [hobbyToast, setHobbyToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeImportProvider, setActiveImportProvider] = useState<ImportProvider | null>(null);

  const showMaxHobbyToast = () => {
    setHobbyToast('Whoa! Santa only has room for 5 clues! 🎅');
    window.setTimeout(() => {
      setHobbyToast((prev) =>
        prev === 'Whoa! Santa only has room for 5 clues! 🎅' ? null : prev
      );
    }, 3200);
  };

  const toggleHobby = (label: string) => {
    const existsIndex = hobbies.findIndex(
      (h) => h.toLowerCase() === label.toLowerCase()
    );
    if (existsIndex >= 0) {
      playPopSound();
      setHobbies((prev) => prev.filter((_, idx) => idx !== existsIndex));
      return;
    }
    if (hobbies.length >= 5) {
      showMaxHobbyToast();
      return;
    }
    playPopSound();
    setHobbies((prev) => [...prev, label]);
  };

  const addCustomHobby = () => {
    const cleaned = customHobby.trim().replace(/\s+/g, ' ');
    if (!cleaned) return;
    if (cleaned.length > 40) {
      setHobbyToast('Keep custom hobbies under 40 characters.');
      return;
    }
    const isDuplicate = hobbies.some(
      (h) => h.toLowerCase() === cleaned.toLowerCase()
    );
    if (isDuplicate) {
      setHobbyToast(`"${cleaned}" is already in your clues!`);
      return;
    }
    if (hobbies.length >= 5) {
      showMaxHobbyToast();
      return;
    }
    playPopSound();
    setHobbies((prev) => [...prev, cleaned]);
    setCustomHobby('');
    setHobbyToast(null);
  };

  const handleApplyParsedAddress = (parsed: Partial<ParticipantAddress>) => {
    setAddress((prev) => ({
      line1: parsed.line1 || prev.line1,
      line2: parsed.line2 ?? prev.line2,
      landmark: parsed.landmark ?? prev.landmark,
      city: parsed.city || prev.city,
      state: parsed.state || prev.state,
      postalCode: parsed.postalCode || prev.postalCode,
      phone: parsed.phone ?? prev.phone,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const result = participantFormSchema.safeParse({
      name,
      address,
      hobbies,
    });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message || 'Please check your details.');
      return;
    }
    await onSubmit(result.data);
  };

  const isPresetHobby = (val: string) =>
    HOBBY_OPTIONS.some((o) => o.label.toLowerCase() === val.toLowerCase());

  const customOnlyHobbies = hobbies.filter((h) => !isPresetHobby(h));

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-3xl mx-auto flex flex-col items-center"
      >
        <FestiveCharacters theme={theme} mood="happy" compact />

        <div className={`w-full rounded-[28px] overflow-hidden -mt-3 ${cfg.cardClass}`}>
          <ThemeCardTrim theme={theme} />

          <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-7" noValidate>
            {/* Header */}
            <div className="text-center space-y-1">
              <h1 className={`font-display text-3xl sm:text-4xl font-bold ${cfg.cardText}`}>
                Your Details
              </h1>
              <p className={`text-sm ${cfg.mutedText}`}>
                Tell Santa where to send the magic &amp; drop up to 5 gift clues ✨
              </p>
            </div>

            {/* Section 1: Name & Delivery Address */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="santa-full-name"
                  className={`flex items-center gap-1.5 text-sm font-bold mb-1.5 ${cfg.cardText}`}
                >
                  <User className="w-4 h-4" />
                  Full Name *
                </label>
                <input
                  id="santa-full-name"
                  type="text"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Prerna Rajput"
                  className={`w-full min-h-[46px] rounded-2xl border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 transition-colors ${cfg.inputClass}`}
                />
              </div>

              {/* Brand Import Buttons: Blinkit, Amazon, Zomato, Flipkart */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`flex items-center gap-1.5 text-sm font-bold ${cfg.cardText}`}>
                    <MapPin className="w-4 h-4" />
                    Delivery Address *
                  </span>
                  <span className={`text-xs font-medium ${cfg.mutedText}`}>
                    Import address from:
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {IMPORT_BUTTONS.map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => {
                        playPopSound();
                        setActiveImportProvider(btn.id);
                      }}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-sm tracking-tight shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer whitespace-nowrap ${btn.styleClass}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Structured India-focused Address Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="addr-line1" className={`block text-xs font-semibold mb-1 ${cfg.mutedText}`}>
                    House / Flat / Building / Street *
                  </label>
                  <input
                    id="addr-line1"
                    type="text"
                    required
                    maxLength={200}
                    value={address.line1}
                    onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                    placeholder="Flat 402, Tower B, Sector 62"
                    className={`w-full min-h-[44px] rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 ${cfg.inputClass}`}
                  />
                </div>

                <div>
                  <label htmlFor="addr-line2" className={`block text-xs font-semibold mb-1 ${cfg.mutedText}`}>
                    Area / Colony / Sector
                  </label>
                  <input
                    id="addr-line2"
                    type="text"
                    maxLength={200}
                    value={address.line2}
                    onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                    placeholder="Golf Course Extension Road"
                    className={`w-full min-h-[44px] rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 ${cfg.inputClass}`}
                  />
                </div>

                <div>
                  <label htmlFor="addr-landmark" className={`block text-xs font-semibold mb-1 ${cfg.mutedText}`}>
                    Landmark
                  </label>
                  <input
                    id="addr-landmark"
                    type="text"
                    maxLength={120}
                    value={address.landmark}
                    onChange={(e) => setAddress({ ...address, landmark: e.target.value })}
                    placeholder="Near Metro Station / Mall"
                    className={`w-full min-h-[44px] rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 ${cfg.inputClass}`}
                  />
                </div>

                <div>
                  <label htmlFor="addr-city" className={`block text-xs font-semibold mb-1 ${cfg.mutedText}`}>
                    City *
                  </label>
                  <input
                    id="addr-city"
                    type="text"
                    required
                    maxLength={80}
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="Gurugram"
                    className={`w-full min-h-[44px] rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 ${cfg.inputClass}`}
                  />
                </div>

                <div>
                  <label htmlFor="addr-state" className={`block text-xs font-semibold mb-1 ${cfg.mutedText}`}>
                    State *
                  </label>
                  <input
                    id="addr-state"
                    type="text"
                    required
                    maxLength={80}
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    placeholder="Haryana"
                    className={`w-full min-h-[44px] rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 ${cfg.inputClass}`}
                  />
                </div>

                <div>
                  <label htmlFor="addr-pin" className={`block text-xs font-semibold mb-1 ${cfg.mutedText}`}>
                    PIN Code *
                  </label>
                  <input
                    id="addr-pin"
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={12}
                    value={address.postalCode}
                    onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                    placeholder="122011"
                    className={`w-full min-h-[44px] rounded-2xl border px-4 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 ${cfg.inputClass}`}
                  />
                </div>

                <div>
                  <label htmlFor="addr-phone" className={`block text-xs font-semibold mb-1 ${cfg.mutedText}`}>
                    Delivery Phone (optional)
                  </label>
                  <input
                    id="addr-phone"
                    type="tel"
                    maxLength={20}
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className={`w-full min-h-[44px] rounded-2xl border px-4 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 ${cfg.inputClass}`}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Hobbies & Gift Clues (1–5 Max) */}
            <div className="space-y-3 pt-2 border-t border-black/10">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className={`font-display text-xl font-bold ${cfg.cardText}`}>
                    Pick up to 5 hobbies
                  </h2>
                  <p className={`text-xs ${cfg.mutedText}`}>
                    Tap chips or type your own (max 5 clues total)
                  </p>
                </div>
                <span
                  className={`font-mono-tabular text-sm font-bold ${
                    hobbies.length === 5 ? 'text-rose-600' : cfg.cardText
                  }`}
                >
                  {hobbies.length}/5 selected
                </span>
              </div>

              {/* 6th Hobby Funny Warning Toast */}
              <AnimatePresence>
                {hobbyToast && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-2xl bg-amber-100 border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-950 text-center"
                  >
                    {hobbyToast}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Interactive Hobby Chips */}
              <div className="flex flex-wrap gap-2">
                {HOBBY_OPTIONS.map((option) => {
                  const selected = hobbies.some(
                    (h) => h.toLowerCase() === option.label.toLowerCase()
                  );
                  const reachedLimit = hobbies.length >= 5 && !selected;

                  return (
                    <motion.button
                      key={option.id}
                      type="button"
                      whileTap={{ scale: 0.93 }}
                      animate={selected ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                      transition={{ duration: 0.22 }}
                      onClick={() => toggleHobby(option.label)}
                      aria-pressed={selected}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-full border text-sm font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                        selected
                          ? cfg.chipSelectedClass
                          : reachedLimit
                            ? `${cfg.chipIdleClass} opacity-50`
                            : cfg.chipIdleClass
                      }`}
                    >
                      <span aria-hidden="true">{option.emoji}</span>
                      <span>{option.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Custom-added hobbies */}
              {customOnlyHobbies.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {customOnlyHobbies.map((custom) => (
                    <button
                      key={custom}
                      type="button"
                      onClick={() => toggleHobby(custom)}
                      className={`min-h-[38px] px-3.5 py-1 rounded-full border text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer ${cfg.chipSelectedClass}`}
                    >
                      <span>✨ {custom}</span>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Hobby Input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  maxLength={40}
                  value={customHobby}
                  onChange={(e) => setCustomHobby(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomHobby();
                    }
                  }}
                  placeholder={
                    hobbies.length >= 5
                      ? '5/5 clues picked — tap a chip to swap'
                      : 'Add a custom hobby (e.g. Matcha, Pottery)...'
                  }
                  className={`flex-1 min-h-[44px] rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 ${cfg.inputClass}`}
                />
                <button
                  type="button"
                  onClick={addCustomHobby}
                  className={`min-h-[44px] px-4 py-2 rounded-2xl font-semibold text-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${cfg.secondaryBtnClass}`}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {formError && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-1 text-center">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                disabled={saving}
                className={`w-full sm:w-auto sm:min-w-[280px] min-h-[56px] px-8 py-3.5 rounded-full font-display text-xl font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 ${cfg.primaryBtnClass}`}
              >
                {saving ? 'Saving to Santa’s list...' : 'Save & Lock My Spot'}
                {!saving && <ArrowRight className="w-5 h-5" />}
              </motion.button>
            </div>
          </form>
        </div>
      </motion.section>

      <AnimatePresence>
        {activeImportProvider && (
          <AddressImportModal
            provider={activeImportProvider}
            onClose={() => setActiveImportProvider(null)}
            onApplyParsedAddress={handleApplyParsedAddress}
          />
        )}
      </AnimatePresence>
    </>
  );
};
