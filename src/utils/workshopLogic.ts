import { z } from 'zod';
import type {
  DeliveryStage,
  ElfHidingSpotId,
  GiftBudgetConfig,
  GingerbreadDecorationItem,
  GingerbreadDesign,
  NaughtyNiceQuizResult,
  SantaGuessItem,
  SecretSantaEvent,
  WheelPrizeDefinition,
} from '../types/secretSanta.ts';
import {
  DELIVERY_STAGES,
  DETECTIVE_REACTIONS,
  ELF_DAILY_REWARDS,
  ELF_HIDING_SPOTS,
  NAUGHTY_NICE_QUESTIONS,
  NAUGHTY_NICE_QUIZ_VERSION,
  WHEEL_PRIZES,
} from '../data/workshopContent.ts';

/**
 * Formats an event-local calendar date key (YYYY-MM-DD) for the configured timezone
 * (defaults to Asia/Kolkata).
 */
export function getEventLocalDateKey(now: Date, timeZone = 'Asia/Kolkata'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value || '2026';
    const m = parts.find((p) => p.type === 'month')?.value || '12';
    const d = parts.find((p) => p.type === 'day')?.value || '01';
    return `${y}-${m}-${d}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function formatBudgetGuide(budget: GiftBudgetConfig): string {
  const cur = budget.currency || '₹';
  const fmt = (n: number) => n.toLocaleString('en-IN');
  if (budget.mode === 'range' && budget.maxAmount > budget.minAmount) {
    return `Santa's spending guide: ${cur}${fmt(budget.minAmount)}–${cur}${fmt(budget.maxAmount)} 🎁`;
  }
  return `Santa's spending guide: ${cur}${fmt(budget.maxAmount || budget.minAmount)} 🎁`;
}

// ---------- Mailbox Moderation & Validation ----------

const BLOCKED_TERMS = ['hate', 'kill', 'stupid', 'idiot', 'shut up', 'abuse'];
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\s-]?){9,13}/;

export const anonymousMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Please write a short festive message first.')
    .max(500, 'Keep messages under 500 characters.'),
});

export function moderateAnonymousMessage(rawBody: string): {
  ok: boolean;
  sanitized?: string;
  reason?: string;
} {
  const parsed = anonymousMessageSchema.safeParse({ body: rawBody });
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues[0]?.message || 'Invalid message.' };
  }
  const text = parsed.data.body.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  if (BLOCKED_TERMS.some((term) => lower.includes(term))) {
    return {
      ok: false,
      reason: 'Keep the Secret Mailbox festive and kind! Please rephrase your message.',
    };
  }
  if (EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text)) {
    return {
      ok: false,
      reason:
        'To protect Secret Santa anonymity, please avoid sharing phone numbers or email addresses in the mailbox.',
    };
  }
  return { ok: true, sanitized: text };
}

export function isMailboxWindowOpen(event: SecretSantaEvent, serverNow: Date): {
  open: boolean;
  reason?: string;
} {
  if (!event.mailboxEnabled) {
    return { open: false, reason: 'Santa’s Secret Mailbox is turned off by the organizer.' };
  }
  if (!event.isMatched) {
    return { open: false, reason: 'Unlocks once Secret Santa matching is complete!' };
  }
  const t = serverNow.getTime();
  if (t < event.mailboxOpenAt.getTime()) {
    return { open: false, reason: 'The Secret Mailbox window has not opened yet.' };
  }
  if (t > event.mailboxCloseAt.getTime()) {
    return { open: false, reason: 'The Secret Mailbox window has closed for this event.' };
  }
  return { open: true };
}

// ---------- Guess Your Santa Validation & Secrecy ----------

export function validateSantaGuess(params: {
  event: SecretSantaEvent;
  existingGuesses: SantaGuessItem[];
  guessedPublicId: string;
  selfPublicId: string;
  validRosterPublicIds: string[];
}): { ok: boolean; reason?: string; reaction?: string } {
  const { event, existingGuesses, guessedPublicId, selfPublicId, validRosterPublicIds } = params;
  if (!event.guessingEnabled) {
    return { ok: false, reason: 'Guess Your Santa is currently disabled by the organizer.' };
  }
  if (!event.isMatched) {
    return { ok: false, reason: 'Guessing unlocks after Secret Santa matching is complete.' };
  }
  const maxGuesses = Math.max(1, Math.min(10, event.maxGuesses || 3));
  if (existingGuesses.length >= maxGuesses) {
    return { ok: false, reason: `You have already used all ${maxGuesses} guesses!` };
  }
  if (guessedPublicId === selfPublicId) {
    return { ok: false, reason: 'You cannot guess yourself as your own Secret Santa!' };
  }
  if (!validRosterPublicIds.includes(guessedPublicId)) {
    return { ok: false, reason: 'Selected participant is not eligible in this event.' };
  }
  if (
    !event.allowDuplicateGuesses &&
    existingGuesses.some((g) => g.guessedPublicId === guessedPublicId)
  ) {
    return { ok: false, reason: 'You already guessed this detective suspect! Try someone else.' };
  }

  const reaction =
    DETECTIVE_REACTIONS[(existingGuesses.length + guessedPublicId.charCodeAt(0)) % DETECTIVE_REACTIONS.length];
  return { ok: true, reaction };
}

export function isSenderIdentityRevealAuthorized(event: SecretSantaEvent, serverNow: Date): boolean {
  return event.isMatched && serverNow.getTime() >= event.santaIdentityRevealAt.getTime();
}

export function isGifteeRevealAuthorized(event: SecretSantaEvent, serverNow: Date): boolean {
  return event.isMatched && serverNow.getTime() >= event.gifteeRevealAt.getTime();
}

/**
 * Checks whether any sealed detective guess matches the revealed Secret Santa identity.
 * Used exclusively after Secret Santa Identity Reveal is authorized to unlock The 1% Santa Secret.
 */
export function hasCorrectSantaGuess(
  guesses: SantaGuessItem[],
  santaReveal: { santaPublicId?: string; santaName: string } | null
): boolean {
  if (!santaReveal || guesses.length === 0) return false;
  const targetName = santaReveal.santaName.trim().toLowerCase();
  return guesses.some(
    (g) =>
      (Boolean(santaReveal.santaPublicId) && g.guessedPublicId === santaReveal.santaPublicId) ||
      (targetName.length > 0 && g.guessedName.trim().toLowerCase() === targetName)
  );
}

// ---------- Delivery Stage Transitions ----------

const STAGE_ORDER: Record<DeliveryStage, number> = {
  preparing: 0,
  shopping: 1,
  wrapped: 2,
  dispatched: 3,
  delivered: 4,
};

export function normalizeDeliveryStage(raw: unknown): DeliveryStage {
  if (typeof raw !== 'string') return 'preparing';
  const cleaned = raw.trim().toLowerCase();
  if (cleaned in STAGE_ORDER) {
    return cleaned as DeliveryStage;
  }
  if (cleaned.includes('order') || cleaned.includes('shop')) return 'shopping';
  if (cleaned.includes('wrap')) return 'wrapped';
  if (cleaned.includes('out for delivery') || cleaned.includes('dispatch') || cleaned.includes('ship')) {
    return 'dispatched';
  }
  if (cleaned.includes('deliver')) return 'delivered';
  return 'preparing';
}

export function validateDeliveryTransition(
  currentStage: DeliveryStage,
  nextStage: DeliveryStage
): { ok: boolean; idempotent?: boolean; reason?: string } {
  const curIdx = STAGE_ORDER[currentStage];
  const nextIdx = STAGE_ORDER[nextStage];
  if (curIdx === undefined || nextIdx === undefined) {
    return { ok: false, reason: 'Invalid delivery stage.' };
  }
  if (nextIdx === curIdx) {
    return { ok: true, idempotent: true };
  }
  if (nextIdx < curIdx) {
    return {
      ok: false,
      reason: 'Sleigh progress can only move forward along the North Pole checkpoints.',
    };
  }
  return { ok: true };
}

export function getDeliveryStageInfo(stage: DeliveryStage | unknown) {
  const normalized = normalizeDeliveryStage(stage);
  return DELIVERY_STAGES.find((s) => s.id === normalized) || DELIVERY_STAGES[0];
}

// ---------- Advent Calendar Server-Date Gate ----------

export function getAdventDayStatus(
  day: number,
  event: SecretSantaEvent,
  serverNow: Date,
  unlockedDays: Set<number>
): 'unlocked' | 'available' | 'locked' | 'missed' {
  if (unlockedDays.has(day)) return 'unlocked';
  if (!event.adventEnabled) return 'locked';

  const startMs = event.adventStartAt.getTime();
  const unlockAtMs = startMs + (day - 1) * 86_400_000;
  const nextDayMs = unlockAtMs + 86_400_000;
  const nowMs = serverNow.getTime();

  if (nowMs < unlockAtMs) {
    return 'locked';
  }
  if (!event.adventAllowCatchUp && nowMs >= nextDayMs) {
    return 'missed';
  }
  return 'available';
}

// ---------- Wheel Weighted Selection ----------

export function pickWeightedWheelPrize(randomFloat: number): WheelPrizeDefinition {
  const clamped = Math.max(0, Math.min(0.999999, randomFloat));
  const totalWeight = WHEEL_PRIZES.reduce((acc, p) => acc + p.weight, 0);
  let cursor = clamped * totalWeight;
  for (const prize of WHEEL_PRIZES) {
    cursor -= prize.weight;
    if (cursor < 0) return prize;
  }
  return WHEEL_PRIZES[0];
}

// ---------- Naughty or Nice Deterministic Scorer ----------

export function scoreNaughtyOrNiceQuiz(answers: number[]): Omit<
  NaughtyNiceQuizResult,
  'eventId' | 'participantKey' | 'completedAt'
> {
  let rawScore = 0;
  let maxScore = 0;

  NAUGHTY_NICE_QUESTIONS.forEach((q, idx) => {
    const choiceIdx = answers[idx] ?? 0;
    const option = q.options[choiceIdx] || q.options[0];
    rawScore += option.nicePoints;
    maxScore += 25;
  });

  const nicePercent = Math.max(12, Math.min(98, Math.round((rawScore / Math.max(1, maxScore)) * 100)));
  const naughtyPercent = 100 - nicePercent;

  let verdictTitle = '73% Nice, 27% Suspicious';
  let verdictSubtitle = 'Rudolph has requested additional evidence.';
  let stampLabel = 'UNDER REVIEW';

  if (nicePercent >= 85) {
    verdictTitle = 'Official North Pole Angel';
    verdictSubtitle = 'Santa wants your gift-wrapping tutorial immediately!';
    stampLabel = 'CERTIFIED NICE';
  } else if (nicePercent >= 68) {
    verdictTitle = `${nicePercent}% Nice, ${naughtyPercent}% Suspicious`;
    verdictSubtitle = 'Rudolph has requested additional evidence.';
    stampLabel = 'MOSTLY NICE';
  } else if (nicePercent >= 45) {
    verdictTitle = 'Certified Mischief Manager';
    verdictSubtitle = 'Santa has questions. The elves have receipts.';
    stampLabel = 'SUSPICIOUS ELF';
  } else {
    verdictTitle = 'CEO of Festive Chaos';
    verdictSubtitle = 'Santa put your file in the glitter-sealed drama drawer!';
    stampLabel = 'NAUGHTY LEGEND';
  }

  return {
    quizVersion: NAUGHTY_NICE_QUIZ_VERSION,
    nicePercent,
    naughtyPercent,
    verdictTitle,
    verdictSubtitle,
    stampLabel,
    answers: answers.slice(0, NAUGHTY_NICE_QUESTIONS.length),
  };
}

/**
 * Produces strictly public shareable text for the Naughty or Nice result card.
 * Guarantees no private assignment, address, phone, or participantKey ever leaks.
 */
export function buildSafeQuizShareText(
  displayName: string,
  result: Pick<NaughtyNiceQuizResult, 'nicePercent' | 'naughtyPercent' | 'verdictTitle' | 'verdictSubtitle'>
): string {
  const safeName = displayName.trim().slice(0, 50) || 'A Secret Santa Guest';
  return `${safeName}'s Santa Naughty or Nice Result: ${result.nicePercent}% Nice / ${result.naughtyPercent}% Mischief — "${result.verdictTitle}" (${result.verdictSubtitle}) [Entertainment only]`;
}

// ---------- Hidden Elf Daily Challenge ----------

export function getDailyElfChallenge(dateKey: string, eventId: string): {
  challengeId: string;
  spotId: ElfHidingSpotId;
  spotLabel: string;
  spotHint: string;
  spotEmoji: string;
  reward: (typeof ELF_DAILY_REWARDS)[number];
} {
  let hash = 0;
  const seed = `${eventId}:${dateKey}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const spot = ELF_HIDING_SPOTS[hash % ELF_HIDING_SPOTS.length];
  const reward = ELF_DAILY_REWARDS[(hash >>> 3) % ELF_DAILY_REWARDS.length];
  return {
    challengeId: `elf_${dateKey.replace(/-/g, '')}_${spot.id}`,
    spotId: spot.id,
    spotLabel: spot.label,
    spotHint: spot.hint,
    spotEmoji: spot.emoji,
    reward,
  };
}

// ---------- Gingerbread Cookie Serialization & Rehydration ----------

export const gingerbreadDecorationItemSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum([
    'sprinkles',
    'button',
    'eye',
    'bowtie',
    'santa-hat',
    'scarf',
    'choco-chip',
    'heart',
    'snowflake',
    'svg-eye-outline',
    'svg-eye-brown',
    'svg-bow-pink',
    'svg-bowtie-navy',
    'svg-hat-butterfly',
    'svg-hat-fedora',
    'svg-scarf-cozy',
    'svg-scarf-long',
    'svg-glasses-sparkle',
    'svg-glasses-retro',
    'svg-glasses-reading',
    'svg-snow-globe',
    'svg-holly',
    'svg-candy-cane',
    'svg-gift-box',
    'svg-string-lights',
    'svg-gold-star',
    'svg-ball-star',
    'svg-ball-red',
    'svg-bauble-green-red',
    'svg-bauble-gold-red',
  ]),
  x: z.number().min(5).max(95),
  y: z.number().min(5).max(95),
  scale: z.number().min(0.6).max(1.6),
  rotation: z.number().min(-45).max(45),
});

export const gingerbreadDesignSchema = z.object({
  eventId: z.string().min(1).max(128),
  participantKey: z.string().min(1).max(128),
  shape: z.enum(['person', 'tree', 'star', 'reindeer']),
  icingColor: z.enum(['white', 'pink', 'red', 'green', 'chocolate']),
  decorations: z.array(gingerbreadDecorationItemSchema).max(24),
  isPublicProfileDecor: z.boolean(),
});

export function serializeGingerbreadDesign(design: GingerbreadDesign): GingerbreadDesign {
  const clampedDecorations: GingerbreadDecorationItem[] = design.decorations
    .slice(0, 24)
    .map((item) => ({
      id: String(item.id).slice(0, 40),
      type: item.type,
      x: Math.round(Math.max(5, Math.min(95, item.x)) * 10) / 10,
      y: Math.round(Math.max(5, Math.min(95, item.y)) * 10) / 10,
      scale: Math.round(Math.max(0.6, Math.min(1.6, item.scale)) * 100) / 100,
      rotation: Math.round(Math.max(-45, Math.min(45, item.rotation))),
    }));

  return gingerbreadDesignSchema.parse({
    eventId: design.eventId,
    participantKey: design.participantKey,
    shape: design.shape,
    icingColor: design.icingColor,
    decorations: clampedDecorations,
    isPublicProfileDecor: Boolean(design.isPublicProfileDecor),
  });
}

export function rehydrateGingerbreadDesign(
  raw: unknown,
  fallbackEventId: string,
  fallbackParticipantKey: string
): GingerbreadDesign {
  const parsed = gingerbreadDesignSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return {
    eventId: fallbackEventId,
    participantKey: fallbackParticipantKey,
    shape: 'person',
    icingColor: 'white',
    decorations: [],
    isPublicProfileDecor: false,
  };
}

// ---------- Gift Dislikes Privacy Helper ----------

export function isGiftPreferencesEditable(event: SecretSantaEvent, serverNow: Date): boolean {
  return serverNow.getTime() <= event.giftPreferencesCutoffAt.getTime();
}

export function extractShareableDislikes(prefs: {
  dislikedCategories: string[];
  dietaryRestrictions: string[];
  dislikedColors: string[];
  alreadyOwned: string[];
  nonFoodNotes: string;
  generalNotes: string;
  shareWithSanta: boolean;
  shareDietaryWithSanta: boolean;
}) {
  if (!prefs.shareWithSanta) return null;
  return {
    dislikedCategories: prefs.dislikedCategories.slice(0, 12),
    dietaryRestrictions: prefs.shareDietaryWithSanta ? prefs.dietaryRestrictions.slice(0, 8) : [],
    dislikedColors: prefs.dislikedColors.slice(0, 8),
    alreadyOwned: prefs.alreadyOwned.slice(0, 10),
    nonFoodNotes: prefs.nonFoodNotes.trim().slice(0, 240),
    generalNotes: prefs.generalNotes.trim().slice(0, 300),
  };
}
