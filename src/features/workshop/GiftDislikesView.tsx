import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  EyeOff,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  GiftPreferencesRecord,
  SecretSantaEvent,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import {
  DISLIKE_CATEGORY_SUGGESTIONS,
  DISLIKE_COLOR_SUGGESTIONS,
} from '../../data/workshopContent';
import {
  fetchGiftPreferences,
  saveGiftPreferences,
} from '../../services/workshopService';
import { isGiftPreferencesEditable } from '../../utils/workshopLogic';
import { playPopSound } from '../../utils/sound';

interface GiftDislikesViewProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  participantKey: string;
  incomingAssignmentId?: string | null;
  serverNow: Date;
  liveMode: boolean;
}

function appendUniqueBounded(
  list: string[],
  raw: string,
  maxItems: number,
  maxLen: number
): string[] {
  const clean = raw.trim().slice(0, maxLen);
  if (!clean) return list;
  if (list.length >= maxItems) return list;
  if (list.some((item) => item.toLowerCase() === clean.toLowerCase())) return list;
  return [...list, clean];
}

export const GiftDislikesView: React.FC<GiftDislikesViewProps> = ({
  theme,
  event,
  participantKey,
  incomingAssignmentId,
  serverNow,
  liveMode,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [prefs, setPrefs] = useState<GiftPreferencesRecord | null>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [customDietary, setCustomDietary] = useState('');
  const [customOwned, setCustomOwned] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedTimerRef = useRef<number | null>(null);
  const editable = !liveMode || isGiftPreferencesEditable(event, serverNow);

  useEffect(() => {
    let active = true;
    setLoadWarning(null);
    fetchGiftPreferences(participantKey, event.id, liveMode).then(({ record, loadError }) => {
      if (!active) return;
      setPrefs(record);
      if (loadError) setLoadWarning(loadError);
    });
    return () => {
      active = false;
    };
  }, [participantKey, event.id, liveMode]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  if (!prefs) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        Loading your gift preferences...
      </div>
    );
  }

  const toggleItem = (
    field: 'dislikedCategories' | 'dislikedColors',
    item: string,
    max: number
  ) => {
    if (!editable) return;
    const list = prefs[field];
    const exists = list.some((x) => x.toLowerCase() === item.toLowerCase());
    if (!exists && list.length >= max) return;
    playPopSound();
    const next = exists
      ? list.filter((x) => x.toLowerCase() !== item.toLowerCase())
      : [...list, item];
    setPrefs({ ...prefs, [field]: next });
  };

  const addCustomTag = (
    field: 'dislikedCategories' | 'dislikedColors' | 'dietaryRestrictions' | 'alreadyOwned',
    raw: string,
    clearFn: () => void,
    max: number,
    maxLen: number
  ) => {
    if (!editable) return;
    const next = appendUniqueBounded(prefs[field], raw, max, maxLen);
    clearFn();
    if (next === prefs[field]) return;
    playPopSound();
    setPrefs({ ...prefs, [field]: next });
  };

  const removeTag = (
    field: 'dislikedCategories' | 'dislikedColors' | 'dietaryRestrictions' | 'alreadyOwned',
    val: string
  ) => {
    if (!editable) return;
    playPopSound();
    setPrefs({ ...prefs, [field]: prefs[field].filter((item) => item !== val) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editable || saving) return;
    setError(null);
    setSaving(true);

    // Flush any typed-but-not-yet-added custom entries so nothing is silently lost on Save
    const mergedPrefs: GiftPreferencesRecord = {
      ...prefs,
      dislikedCategories: appendUniqueBounded(prefs.dislikedCategories, customCategory, 12, 60),
      dislikedColors: appendUniqueBounded(prefs.dislikedColors, customColor, 8, 40),
      dietaryRestrictions: prefs.shareDietaryWithSanta
        ? appendUniqueBounded(prefs.dietaryRestrictions, customDietary, 8, 60)
        : prefs.dietaryRestrictions,
      alreadyOwned: appendUniqueBounded(prefs.alreadyOwned, customOwned, 10, 60),
    };

    try {
      const res = await saveGiftPreferences(
        event,
        mergedPrefs,
        serverNow,
        liveMode,
        incomingAssignmentId
      );
      if (!res.ok) {
        setError(res.error || 'Could not save preferences.');
        return;
      }
      if (res.record) {
        setPrefs(res.record);
      } else {
        setPrefs(mergedPrefs);
      }
      setCustomCategory('');
      setCustomColor('');
      setCustomDietary('');
      setCustomOwned('');
      setLoadWarning(null);
      playPopSound();

      const message = !mergedPrefs.shareWithSanta
        ? 'Saved privately! Nothing will be shown to your Secret Santa unless you check the sharing option below.'
        : event.isMatched && liveMode
          ? 'Saved & synced! Your Secret Santa’s giftee card now reflects these updated guardrails.'
          : 'Saved! Your Secret Santa will see these guardrails once matching runs.';

      setSavedBanner(message);
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
      savedTimerRef.current = window.setTimeout(() => setSavedBanner(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const customCategoriesOnly = prefs.dislikedCategories.filter(
    (c) => !DISLIKE_CATEGORY_SUGGESTIONS.some((s) => s.toLowerCase() === c.toLowerCase())
  );
  const customColorsOnly = prefs.dislikedColors.filter(
    (c) => !DISLIKE_COLOR_SUGGESTIONS.some((s) => s.toLowerCase() === c.toLowerCase())
  );

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border border-rose-200 p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 text-3xl">
          🚫
        </div>
        <div className="text-center sm:text-left space-y-1 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700 inline-flex items-center gap-1">
            <Ban className="w-3.5 h-3.5" />
            Optional Gift-Safety Guardrails
          </p>
          <h2 className={`font-display text-2xl font-bold ${cfg.cardText}`}>
            Things Santa Should Avoid 🚫
          </h2>
          <p className={`text-xs sm:text-sm ${cfg.mutedText}`}>
            Help your Secret Santa dodge awkward gifts! Everything here is optional and shared ONLY with your assigned Santa if you opt in below.
          </p>
        </div>
      </div>

      {loadWarning && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-xs font-semibold text-amber-950 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{loadWarning}</span>
        </div>
      )}

      {!editable && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-xs font-semibold text-amber-950 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Editing closed after {event.giftPreferencesCutoffAt.toLocaleString('en-IN')}.{' '}
            {prefs.shareWithSanta
              ? 'Your saved preferences remain safely shared with your Secret Santa!'
              : 'Your checklist is kept private and hidden from your Secret Santa.'}
          </span>
        </div>
      )}

      {/* 1. Disliked Categories */}
      <div className="rounded-3xl bg-white/90 border border-black/10 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display font-bold text-base text-slate-900">
            1. Gift Categories to Skip
          </h3>
          <span className="text-xs font-bold text-slate-500 font-mono-tabular">
            {prefs.dislikedCategories.length}/12
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DISLIKE_CATEGORY_SUGGESTIONS.map((item) => {
            const active = prefs.dislikedCategories.some(
              (c) => c.toLowerCase() === item.toLowerCase()
            );
            const atLimit = !active && prefs.dislikedCategories.length >= 12;
            return (
              <button
                key={item}
                type="button"
                disabled={!editable || atLimit}
                onClick={() => toggleItem('dislikedCategories', item, 12)}
                className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  active
                    ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                    : cfg.chipIdleClass
                }`}
              >
                {active ? '✕ ' : '+ '}
                {item}
              </button>
            );
          })}
        </div>

        {customCategoriesOnly.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customCategoriesOnly.map((item) => (
              <span
                key={item}
                className="px-3 py-1 rounded-full bg-rose-100 text-rose-900 text-xs font-semibold inline-flex items-center gap-1"
              >
                {item}
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeTag('dislikedCategories', item)}
                    aria-label={`Remove ${item}`}
                    className="cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {editable && (
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={60}
              disabled={prefs.dislikedCategories.length >= 12}
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomTag('dislikedCategories', customCategory, () => setCustomCategory(''), 12, 60);
                }
              }}
              placeholder={
                prefs.dislikedCategories.length >= 12
                  ? 'Category limit reached (12/12)'
                  : 'Add another category to avoid...'
              }
              className={`flex-1 min-h-[40px] rounded-xl border px-3 text-sm disabled:opacity-60 ${cfg.inputClass}`}
            />
            <button
              type="button"
              disabled={prefs.dislikedCategories.length >= 12 || !customCategory.trim()}
              onClick={() =>
                addCustomTag('dislikedCategories', customCategory, () => setCustomCategory(''), 12, 60)
              }
              className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        )}
      </div>

      {/* 2. Disliked Colors & Already Owned */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-3xl bg-white/90 border border-black/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-bold text-base text-slate-900">
              2. Colors You Dislike
            </h3>
            <span className="text-xs font-bold text-slate-500 font-mono-tabular">
              {prefs.dislikedColors.length}/8
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DISLIKE_COLOR_SUGGESTIONS.map((color) => {
              const active = prefs.dislikedColors.some(
                (c) => c.toLowerCase() === color.toLowerCase()
              );
              const atLimit = !active && prefs.dislikedColors.length >= 8;
              return (
                <button
                  key={color}
                  type="button"
                  disabled={!editable || atLimit}
                  onClick={() => toggleItem('dislikedColors', color, 8)}
                  className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {active ? '✕ ' : '+ '}
                  {color}
                </button>
              );
            })}
          </div>

          {customColorsOnly.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customColorsOnly.map((color) => (
                <span
                  key={color}
                  className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-900 text-xs font-semibold inline-flex items-center gap-1"
                >
                  {color}
                  {editable && (
                    <button
                      type="button"
                      onClick={() => removeTag('dislikedColors', color)}
                      aria-label={`Remove ${color}`}
                      className="cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {editable && (
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={40}
                disabled={prefs.dislikedColors.length >= 8}
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag('dislikedColors', customColor, () => setCustomColor(''), 8, 40);
                  }
                }}
                placeholder={
                  prefs.dislikedColors.length >= 8
                    ? 'Color limit reached (8/8)'
                    : 'e.g. Mustard, Gold...'
                }
                className={`flex-1 min-h-[38px] rounded-xl border px-3 text-xs disabled:opacity-60 ${cfg.inputClass}`}
              />
              <button
                type="button"
                disabled={prefs.dislikedColors.length >= 8 || !customColor.trim()}
                onClick={() =>
                  addCustomTag('dislikedColors', customColor, () => setCustomColor(''), 8, 40)
                }
                className="min-h-[38px] px-3 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white/90 border border-black/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-bold text-base text-slate-900">
              3. Already Owned Items
            </h3>
            <span className="text-xs font-bold text-slate-500 font-mono-tabular">
              {prefs.alreadyOwned.length}/10
            </span>
          </div>
          {prefs.alreadyOwned.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {prefs.alreadyOwned.map((item) => (
                <span
                  key={item}
                  className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 text-xs font-semibold inline-flex items-center gap-1"
                >
                  {item}
                  {editable && (
                    <button
                      type="button"
                      onClick={() => removeTag('alreadyOwned', item)}
                      aria-label={`Remove ${item}`}
                      className="cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {editable && (
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={60}
                disabled={prefs.alreadyOwned.length >= 10}
                value={customOwned}
                onChange={(e) => setCustomOwned(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag('alreadyOwned', customOwned, () => setCustomOwned(''), 10, 60);
                  }
                }}
                placeholder={
                  prefs.alreadyOwned.length >= 10
                    ? 'Limit reached (10/10)'
                    : 'e.g. AirPods case, Kindle...'
                }
                className={`flex-1 min-h-[38px] rounded-xl border px-3 text-xs disabled:opacity-60 ${cfg.inputClass}`}
              />
              <button
                type="button"
                disabled={prefs.alreadyOwned.length >= 10 || !customOwned.trim()}
                onClick={() =>
                  addCustomTag('alreadyOwned', customOwned, () => setCustomOwned(''), 10, 60)
                }
                className="min-h-[38px] px-3 rounded-xl bg-amber-900 text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Sensitive Dietary / Allergy Section with Explicit Opt-In */}
      <div className="rounded-3xl bg-emerald-50/75 border border-emerald-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display font-bold text-base text-emerald-950">
                4. Optional Dietary / Allergy Notes (Private Unless Opted In)
              </h3>
              <p className="text-xs text-emerald-900/80">
                Only share food or allergy preferences if you want your Secret Santa to see them.
              </p>
            </div>
          </div>
          {prefs.shareDietaryWithSanta && (
            <span className="text-xs font-bold text-emerald-800/70 font-mono-tabular shrink-0">
              {prefs.dietaryRestrictions.length}/8
            </span>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-xs font-bold text-emerald-950 cursor-pointer">
          <input
            type="checkbox"
            disabled={!editable}
            checked={prefs.shareDietaryWithSanta}
            onChange={(e) => setPrefs({ ...prefs, shareDietaryWithSanta: e.target.checked })}
            className="rounded border-emerald-400 text-emerald-600 disabled:opacity-60"
          />
          <span>Yes, explicitly share my dietary/allergy notes with my Secret Santa</span>
        </label>

        {prefs.shareDietaryWithSanta && (
          <div className="space-y-2.5 pt-1">
            {prefs.dietaryRestrictions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {prefs.dietaryRestrictions.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 rounded-full bg-white border border-emerald-300 text-emerald-950 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    {item}
                    {editable && (
                      <button
                        type="button"
                        onClick={() => removeTag('dietaryRestrictions', item)}
                        aria-label={`Remove ${item}`}
                        className="cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {editable && (
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={60}
                  disabled={prefs.dietaryRestrictions.length >= 8}
                  value={customDietary}
                  onChange={(e) => setCustomDietary(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTag('dietaryRestrictions', customDietary, () => setCustomDietary(''), 8, 60);
                    }
                  }}
                  placeholder={
                    prefs.dietaryRestrictions.length >= 8
                      ? 'Dietary limit reached (8/8)'
                      : 'e.g. Nut allergy, Eggless only, Vegan...'
                  }
                  className="flex-1 min-h-[40px] rounded-xl border border-emerald-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={prefs.dietaryRestrictions.length >= 8 || !customDietary.trim()}
                  onClick={() =>
                    addCustomTag('dietaryRestrictions', customDietary, () => setCustomDietary(''), 8, 60)
                  }
                  className="min-h-[40px] px-3.5 rounded-xl bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Non-food & General Notes */}
      <div className="rounded-3xl bg-white/90 border border-black/10 p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="non-food-notes" className="block text-xs font-bold text-slate-800 mb-1">
              Fragrance / Material Notes (Optional)
            </label>
            <textarea
              id="non-food-notes"
              rows={2}
              maxLength={240}
              disabled={!editable}
              value={prefs.nonFoodNotes}
              onChange={(e) => setPrefs({ ...prefs, nonFoodNotes: e.target.value })}
              placeholder="e.g. Prefer unscented skincare, cotton fabrics..."
              className={`w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-60 ${cfg.inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="general-avoid-notes" className="block text-xs font-bold text-slate-800 mb-1">
              Friendly Note for Your Santa (Optional)
            </label>
            <textarea
              id="general-avoid-notes"
              rows={2}
              maxLength={300}
              disabled={!editable}
              value={prefs.generalNotes}
              onChange={(e) => setPrefs({ ...prefs, generalNotes: e.target.value })}
              placeholder="e.g. I love cozy surprises, just no coffee mugs — my shelf is full!"
              className={`w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-60 ${cfg.inputClass}`}
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 pt-1 cursor-pointer">
          <input
            type="checkbox"
            disabled={!editable}
            checked={prefs.shareWithSanta}
            onChange={(e) => setPrefs({ ...prefs, shareWithSanta: e.target.checked })}
            className="rounded border-slate-400 text-rose-600 disabled:opacity-60"
          />
          <span>Share my &ldquo;Things to Avoid&rdquo; checklist on my Secret Santa&apos;s giftee card</span>
        </label>

        {!prefs.shareWithSanta && (
          <div className="rounded-xl bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-700 flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Sharing is off — none of these items (including dietary notes) will be shown on your Secret Santa&apos;s giftee card.
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedBanner && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {editable && (
        <div className="text-center">
          <button
            type="submit"
            disabled={saving}
            className={`min-h-[48px] px-8 py-2.5 rounded-full font-display font-bold text-base inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 ${cfg.primaryBtnClass}`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Preferences...' : 'Save Gift Guardrails ✨'}
          </button>
        </div>
      )}
    </form>
  );
};
