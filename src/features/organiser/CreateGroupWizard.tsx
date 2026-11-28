import React, { useState } from 'react';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import {
  GiftExchangeMode,
  GroupCurrency,
  GroupGamesConfig,
  GroupVisibility,
  PairingExclusion,
  PlatformConfig,
  PlatformUser,
  SantaGroup,
} from '../../types/rbac';
import { ThemeId } from '../../types/secretSanta';
import {
  buildDefaultGamesConfig,
  createSantaGroup,
} from '../../services/rbacService';
import { currencySymbolFromCode } from '../../utils/rbacLogic';
import { playChimeSound, playPopSound } from '../../utils/sound';

interface CreateGroupWizardProps {
  actor: PlatformUser;
  platformConfig?: PlatformConfig;
  onCreated: (group: SantaGroup) => void;
  onCancel?: () => void;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export const CreateGroupWizard: React.FC<CreateGroupWizardProps> = ({
  actor,
  platformConfig,
  onCreated,
  onCancel,
}) => {
  const now = Date.now();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basics & Theme
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState<ThemeId>('santa');
  const [visibility, setVisibility] = useState<GroupVisibility>('private');
  const [maxParticipants, setMaxParticipants] = useState(
    platformConfig?.defaultMaxParticipants ?? 40
  );
  const [initialStatus, setInitialStatus] = useState<'REGISTRATION_OPEN' | 'DRAFT'>(
    'REGISTRATION_OPEN'
  );

  // Step 2: Budget, Schedule & Exchange
  const [budgetMode, setBudgetMode] = useState<'fixed' | 'range'>('fixed');
  const [currencyCode, setCurrencyCode] = useState<GroupCurrency>(
    platformConfig?.defaultCurrency ?? 'INR'
  );
  const [minAmount, setMinAmount] = useState(1000);
  const [maxAmount, setMaxAmount] = useState(1500);
  const [budgetAnnouncement, setBudgetAnnouncement] = useState(
    'Thoughtful festive gifts — handmade touches always welcome!'
  );
  const [timezone, setTimezone] = useState(platformConfig?.defaultTimezone || 'Asia/Kolkata');
  const [registrationDeadline, setRegistrationDeadline] = useState(
    toDatetimeLocal(new Date(now + 10 * 86400_000))
  );
  const [matchingAt, setMatchingAt] = useState(toDatetimeLocal(new Date(now + 11 * 86400_000)));
  const [recipientRevealAt, setRecipientRevealAt] = useState(
    toDatetimeLocal(new Date(now + 12 * 86400_000))
  );
  const [includeSenderReveal, setIncludeSenderReveal] = useState(true);
  const [senderRevealAt, setSenderRevealAt] = useState(
    toDatetimeLocal(new Date(now + 24 * 86400_000))
  );
  const [giftExchangeAt, setGiftExchangeAt] = useState(
    toDatetimeLocal(new Date(now + 22 * 86400_000))
  );
  const [exchangeMode, setExchangeMode] = useState<GiftExchangeMode>('delivery');
  const [exchangeLocation, setExchangeLocation] = useState('');

  // Step 3: Pairing Exclusions & Games
  const [exclusions, setExclusions] = useState<PairingExclusion[]>([]);
  const [exMemberA, setExMemberA] = useState('');
  const [exMemberB, setExMemberB] = useState('');
  const [exReason, setExReason] = useState('');
  const [gamesConfig, setGamesConfig] = useState<GroupGamesConfig>(buildDefaultGamesConfig);

  const handleAddExclusion = () => {
    const a = exMemberA.trim();
    const b = exMemberB.trim();
    if (!a || !b || a.toLowerCase() === b.toLowerCase()) return;
    setExclusions((prev) => [
      ...prev,
      {
        id: `ex_${Date.now()}_${prev.length}`,
        memberA: a,
        memberB: b,
        reason: exReason.trim() || undefined,
      },
    ]);
    setExMemberA('');
    setExMemberB('');
    setExReason('');
    playPopSound();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Please enter a festive group name (at least 2 characters).');
      setStep(1);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createSantaGroup(actor, {
        name: name.trim(),
        description: description.trim(),
        theme,
        visibility,
        maxParticipants,
        budgetMode,
        currencyCode,
        minAmount,
        maxAmount: budgetMode === 'fixed' ? minAmount : Math.max(minAmount, maxAmount),
        budgetAnnouncement,
        timezone,
        registrationDeadline: new Date(registrationDeadline),
        matchingAt: new Date(matchingAt),
        recipientRevealAt: new Date(recipientRevealAt),
        senderRevealAt: includeSenderReveal ? new Date(senderRevealAt) : null,
        giftExchangeAt: new Date(giftExchangeAt),
        exchangeMode,
        exchangeLocation,
        pairingExclusions: exclusions,
        gamesConfig,
        initialStatus,
      });
      playChimeSound();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create Santa Group.');
    } finally {
      setSubmitting(false);
    }
  };

  const themeOptions: { id: ThemeId; emoji: string; label: string; vibe: string }[] = [
    { id: 'santa', emoji: '🎄', label: 'Classic Santa', vibe: 'Snowy village & crimson magic' },
    { id: 'chocolate', emoji: '🍫', label: 'Cocoa Wonderland', vibe: 'Warm truffles & golden foil' },
    { id: 'funny', emoji: '🤪', label: 'Christmas Chaos', vibe: 'Playful elves & festive humor' },
  ];

  const currencySymbol = currencySymbolFromCode(currencyCode);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h3 className="font-display text-xl font-bold text-slate-900">
            🎄 Create a Santa Group
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Set up your Secret Santa rules, budget, reveal schedule, and workshop games.
          </p>
        </div>

        {/* Clean Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          {[
            { num: 1 as const, label: '1. Identity' },
            { num: 2 as const, label: '2. Budget & Dates' },
            { num: 3 as const, label: '3. Rules & Games' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                step === s.num
                  ? 'bg-slate-900 text-white'
                  : step > s.num
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 font-medium">
          {error}
        </div>
      )}

      {/* STEP 1: IDENTITY & THEME */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Group Name *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Design Studio Secret Santa 2026"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Description / Welcome Note
              </label>
              <textarea
                rows={2}
                maxLength={400}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Share what makes this exchange special, dress code, or gift ideas..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Group Theme & Festive World
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themeOptions.map((opt) => {
                const selected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setTheme(opt.id);
                      playPopSound();
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-400 text-slate-900'
                    }`}
                  >
                    <div className="text-2xl mb-1">{opt.emoji}</div>
                    <div className="font-bold text-sm">{opt.label}</div>
                    <div
                      className={`text-xs mt-0.5 ${
                        selected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {opt.vibe}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Group Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as GroupVisibility)}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="private">Private (Invite Link Only)</option>
                {(platformConfig?.allowDiscoverableGroups ?? true) && (
                  <option value="discoverable">Discoverable (Request to Join)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Maximum Participants
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="number"
                  min={2}
                  max={500}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 pl-9 pr-3 text-sm font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Initial Launch State
              </label>
              <select
                value={initialStatus}
                onChange={(e) =>
                  setInitialStatus(e.target.value as 'REGISTRATION_OPEN' | 'DRAFT')
                }
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="REGISTRATION_OPEN">Open Registration Immediately</option>
                <option value="DRAFT">Save as Draft First</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: BUDGET, SCHEDULE & EXCHANGE */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Budget */}
          <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Wallet className="w-4 h-4 text-amber-700" />
                Gift Budget Rules
              </div>
              <span className="text-xs font-semibold text-amber-900 font-mono-tabular">
                {budgetMode === 'fixed'
                  ? `Target: ${currencySymbol}${minAmount.toLocaleString()}`
                  : `Range: ${currencySymbol}${minAmount.toLocaleString()} – ${currencySymbol}${Math.max(minAmount, maxAmount).toLocaleString()}`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Budget Type</label>
                <select
                  value={budgetMode}
                  onChange={(e) => setBudgetMode(e.target.value as 'fixed' | 'range')}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="fixed">Fixed Amount</option>
                  <option value="range">Min–Max Range</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Currency</label>
                <select
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value as GroupCurrency)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {budgetMode === 'fixed' ? 'Target Amount' : 'Minimum'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={minAmount}
                  onChange={(e) => setMinAmount(Number(e.target.value))}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                />
              </div>
              {budgetMode === 'range' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Maximum</label>
                  <input
                    type="number"
                    min={minAmount}
                    max={1000000}
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(Number(e.target.value))}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Budget Note</label>
              <input
                type="text"
                maxLength={240}
                value={budgetAnnouncement}
                onChange={(e) => setBudgetAnnouncement(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Calendar className="w-4 h-4 text-rose-600" />
                Schedule & Reveal Timers
              </div>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                aria-label="Timezone"
                className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono-tabular"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Registration Deadline
                </label>
                <input
                  type="datetime-local"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Planned Matching Date
                </label>
                <input
                  type="datetime-local"
                  value={matchingAt}
                  onChange={(e) => setMatchingAt(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-rose-700 mb-1">
                  Recipient Reveal Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={recipientRevealAt}
                  onChange={(e) => setRecipientRevealAt(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-rose-300 bg-white px-3 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-amber-700 mb-1">
                  Gift Exchange / Delivery Deadline
                </label>
                <input
                  type="datetime-local"
                  value={giftExchangeAt}
                  onChange={(e) => setGiftExchangeAt(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-amber-300 bg-white px-3 text-sm font-mono-tabular"
                />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-purple-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSenderReveal}
                    onChange={(e) => setIncludeSenderReveal(e.target.checked)}
                    className="w-4 h-4 accent-purple-600"
                  />
                  Schedule Secret Santa Sender Reveal
                </label>
                {includeSenderReveal && (
                  <input
                    type="datetime-local"
                    value={senderRevealAt}
                    onChange={(e) => setSenderRevealAt(e.target.value)}
                    className="min-h-[38px] rounded-xl border border-purple-300 bg-white px-3 text-sm font-mono-tabular"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Exchange Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gift Exchange Mode
              </label>
              <select
                value={exchangeMode}
                onChange={(e) => setExchangeMode(e.target.value as GiftExchangeMode)}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="delivery">Delivery (Doorstep / Courier)</option>
                <option value="in-person">In-Person Celebration</option>
                <option value="hybrid">Hybrid (In-Person + Delivery)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Exchange Location / Shipping Note
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  maxLength={200}
                  value={exchangeLocation}
                  onChange={(e) => setExchangeLocation(e.target.value)}
                  placeholder="e.g. Studio Lounge Floor 4 or Home Addresses"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: EXCLUSIONS & GAMES */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Pairing Exclusions */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                Optional Pairing Exclusions
              </h4>
              <p className="text-xs text-slate-500">
                Prevent spouses, partners, or close teammates from drawing each other. Match names exactly as they will register.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={exMemberA}
                onChange={(e) => setExMemberA(e.target.value)}
                placeholder="Person A name"
                className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              />
              <input
                type="text"
                value={exMemberB}
                onChange={(e) => setExMemberB(e.target.value)}
                placeholder="Person B name"
                className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              />
              <input
                type="text"
                value={exReason}
                onChange={(e) => setExReason(e.target.value)}
                placeholder="Reason (optional)"
                className="min-h-[38px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
              />
              <button
                type="button"
                onClick={handleAddExclusion}
                className="min-h-[38px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Rule
              </button>
            </div>

            {exclusions.length > 0 && (
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {exclusions.map((ex) => (
                  <div
                    key={ex.id}
                    className="px-3 py-2 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-800">
                      {ex.memberA} ↔ {ex.memberB}
                      {ex.reason && <span className="text-slate-500"> · {ex.reason}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExclusions((prev) => prev.filter((x) => x.id !== ex.id))}
                      className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                      aria-label="Remove exclusion"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Games & Workshop Toggles */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Gamepad2 className="w-4 h-4 text-emerald-600" />
              Games & Festive Workshop Features
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
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
                  className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 px-3 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(gamesConfig[key])}
                    onChange={(e) =>
                      setGamesConfig((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="w-4 h-4 accent-rose-600"
                  />
                  <span className="font-medium text-slate-800 text-xs sm:text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <div>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="min-h-[42px] px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[42px] px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && name.trim().length < 2) {
                  setError('Please enter a group name first.');
                  return;
                }
                setError(null);
                setStep((s) => (s === 1 ? 2 : 3));
              }}
              className="min-h-[42px] px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Creating Group...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Launch Santa Group
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
