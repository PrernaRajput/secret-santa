import { describe, expect, it } from 'vitest';
import {
  buildSafeQuizShareText,
  extractShareableDislikes,
  formatBudgetGuide,
  getAdventDayStatus,
  getDailyElfChallenge,
  getDeliveryStageInfo,
  getEventLocalDateKey,
  isGiftPreferencesEditable,
  isMailboxWindowOpen,
  isSenderIdentityRevealAuthorized,
  moderateAnonymousMessage,
  normalizeDeliveryStage,
  pickWeightedWheelPrize,
  rehydrateGingerbreadDesign,
  scoreNaughtyOrNiceQuiz,
  serializeGingerbreadDesign,
  validateDeliveryTransition,
  validateSantaGuess,
} from '../workshopLogic';
import { SecretSantaEvent } from '../../types/secretSanta';

function makeEvent(overrides: Partial<SecretSantaEvent> = {}): SecretSantaEvent {
  const base = new Date('2026-12-10T10:00:00Z');
  return {
    id: 'test-event',
    name: 'Secret Santa 2026',
    timezone: 'Asia/Kolkata',
    registrationOpen: true,
    registrationDeadline: new Date('2026-12-12T10:00:00Z'),
    gifteeRevealAt: new Date('2026-12-14T10:00:00Z'),
    giftDeadline: new Date('2026-12-23T10:00:00Z'),
    santaIdentityRevealAt: new Date('2026-12-25T10:00:00Z'),
    isMatched: true,
    matchedAt: base,
    participantCount: 5,
    createdBy: 'admin',
    budget: {
      mode: 'fixed',
      currency: '₹',
      minAmount: 1000,
      maxAmount: 1000,
      announcement: 'Handmade touches welcome!',
    },
    mailboxEnabled: true,
    mailboxOpenAt: new Date('2026-12-01T00:00:00Z'),
    mailboxCloseAt: new Date('2026-12-31T23:59:59Z'),
    guessingEnabled: true,
    maxGuesses: 3,
    allowDuplicateGuesses: false,
    adventEnabled: true,
    adventStartAt: new Date('2026-12-01T00:00:00Z'),
    adventEndAt: new Date('2026-12-26T00:00:00Z'),
    adventAllowCatchUp: true,
    wheelEnabled: true,
    elfChallengeEnabled: true,
    quizEnabled: true,
    quizAllowRetake: true,
    deliveryTrackingEnabled: true,
    allowSharedTrackingLink: false,
    thankYouEnabled: true,
    snowGlobeRevealEnabled: true,
    giftPreferencesCutoffAt: new Date('2026-12-14T10:00:00Z'),
    ...overrides,
  };
}

describe('Phase 2 Santa Workshop Logic', () => {
  it('formats fixed and range gift budget guides cleanly', () => {
    expect(
      formatBudgetGuide({
        mode: 'fixed',
        currency: '₹',
        minAmount: 1000,
        maxAmount: 1000,
        announcement: '',
      })
    ).toContain('₹1,000');

    expect(
      formatBudgetGuide({
        mode: 'range',
        currency: '₹',
        minAmount: 500,
        maxAmount: 1500,
        announcement: '',
      })
    ).toContain('₹500–₹1,500');
  });

  it('moderates anonymous mailbox messages against profanity, phone numbers, and emails', () => {
    expect(moderateAnonymousMessage('Do you prefer dark chocolate or coffee?').ok).toBe(true);
    expect(moderateAnonymousMessage('   ').ok).toBe(false);
    expect(moderateAnonymousMessage('Call me at +91 98112 34091').ok).toBe(false);
    expect(moderateAnonymousMessage('Email me at secret@example.com').ok).toBe(false);
    expect(moderateAnonymousMessage('You are an idiot').ok).toBe(false);
  });

  it('enforces mailbox open/close window and enabled toggle', () => {
    const evt = makeEvent();
    expect(isMailboxWindowOpen(evt, new Date('2026-12-15T00:00:00Z')).open).toBe(true);
    expect(isMailboxWindowOpen(evt, new Date('2027-01-05T00:00:00Z')).open).toBe(false);
    expect(isMailboxWindowOpen(makeEvent({ mailboxEnabled: false }), new Date('2026-12-15T00:00:00Z')).open).toBe(
      false
    );
  });

  it('validates Santa guesses with maxGuesses, no self-guess, no duplicates, and neutral reactions', () => {
    const evt = makeEvent({ maxGuesses: 2, allowDuplicateGuesses: false });
    const roster = ['pub-a', 'pub-b', 'pub-c'];

    // Self-guess blocked
    expect(
      validateSantaGuess({
        event: evt,
        existingGuesses: [],
        guessedPublicId: 'pub-a',
        selfPublicId: 'pub-a',
        validRosterPublicIds: roster,
      }).ok
    ).toBe(false);

    // Valid guess returns neutral playful reaction
    const g1 = validateSantaGuess({
      event: evt,
      existingGuesses: [],
      guessedPublicId: 'pub-b',
      selfPublicId: 'pub-a',
      validRosterPublicIds: roster,
    });
    expect(g1.ok).toBe(true);
    expect(g1.reaction).toBeTruthy();

    // Duplicate blocked
    const dup = validateSantaGuess({
      event: evt,
      existingGuesses: [
        {
          guessedPublicId: 'pub-b',
          guessedName: 'B',
          guessedAvatarId: 'holly-princess',
          reaction: g1.reaction!,
          submittedAtIso: new Date().toISOString(),
        },
      ],
      guessedPublicId: 'pub-b',
      selfPublicId: 'pub-a',
      validRosterPublicIds: roster,
    });
    expect(dup.ok).toBe(false);

    // Max guesses cap enforced
    const overLimit = validateSantaGuess({
      event: evt,
      existingGuesses: [
        {
          guessedPublicId: 'pub-b',
          guessedName: 'B',
          guessedAvatarId: 'holly-princess',
          reaction: 'r1',
          submittedAtIso: new Date().toISOString(),
        },
        {
          guessedPublicId: 'pub-c',
          guessedName: 'C',
          guessedAvatarId: 'holly-princess',
          reaction: 'r2',
          submittedAtIso: new Date().toISOString(),
        },
      ],
      guessedPublicId: 'pub-c',
      selfPublicId: 'pub-a',
      validRosterPublicIds: roster,
    });
    expect(overLimit.ok).toBe(false);

    // Sender identity strictly blocked before santaIdentityRevealAt
    expect(isSenderIdentityRevealAuthorized(evt, new Date('2026-12-20T00:00:00Z'))).toBe(false);
    expect(isSenderIdentityRevealAuthorized(evt, new Date('2026-12-25T10:00:01Z'))).toBe(true);
  });

  it('enforces monotonic forward-only delivery stage transitions with idempotency', () => {
    expect(validateDeliveryTransition('preparing', 'shopping').ok).toBe(true);
    expect(validateDeliveryTransition('shopping', 'shopping')).toEqual({
      ok: true,
      idempotent: true,
    });
    expect(validateDeliveryTransition('dispatched', 'wrapped').ok).toBe(false);
    expect(validateDeliveryTransition('delivered', 'preparing').ok).toBe(false);
  });

  it('normalizes delivery stages from DB IDs and display labels without throwing', () => {
    expect(normalizeDeliveryStage('preparing')).toBe('preparing');
    expect(normalizeDeliveryStage('shopping')).toBe('shopping');
    expect(normalizeDeliveryStage('wrapped')).toBe('wrapped');
    expect(normalizeDeliveryStage('dispatched')).toBe('dispatched');
    expect(normalizeDeliveryStage('delivered')).toBe('delivered');

    expect(normalizeDeliveryStage('Gift Ordered')).toBe('shopping');
    expect(normalizeDeliveryStage('Out for Delivery')).toBe('dispatched');
    expect(normalizeDeliveryStage('Delivered')).toBe('delivered');
    expect(normalizeDeliveryStage('Gift Wrapped')).toBe('wrapped');
    expect(normalizeDeliveryStage('Preparing Gift')).toBe('preparing');

    expect(normalizeDeliveryStage(null)).toBe('preparing');
    expect(normalizeDeliveryStage(undefined)).toBe('preparing');
    expect(normalizeDeliveryStage('unknown-stage')).toBe('preparing');

    expect(getDeliveryStageInfo('shopping').label).toBe('Gift Ordered');
    expect(getDeliveryStageInfo('dispatched').label).toBe('Out for Delivery');
    expect(getDeliveryStageInfo('delivered').label).toBe('Delivered');
    expect(getDeliveryStageInfo('invalid' as never).id).toBe('preparing');
  });

  it('gates Advent doors strictly against server calendar date and catch-up setting', () => {
    const evt = makeEvent({
      adventStartAt: new Date('2026-12-01T00:00:00Z'),
      adventAllowCatchUp: false,
    });
    const dec5 = new Date('2026-12-05T12:00:00Z');
    expect(getAdventDayStatus(5, evt, dec5, new Set())).toBe('available');
    expect(getAdventDayStatus(6, evt, dec5, new Set())).toBe('locked');
    expect(getAdventDayStatus(2, evt, dec5, new Set())).toBe('missed');
    expect(getAdventDayStatus(2, evt, dec5, new Set([2]))).toBe('unlocked');

    const catchUpEvt = makeEvent({
      adventStartAt: new Date('2026-12-01T00:00:00Z'),
      adventAllowCatchUp: true,
    });
    expect(getAdventDayStatus(2, catchUpEvt, dec5, new Set())).toBe('available');
  });

  it('selects valid weighted prizes on Santa Wheel across boundaries', () => {
    const low = pickWeightedWheelPrize(0);
    const high = pickWeightedWheelPrize(0.9999);
    expect(low.id).toBeTruthy();
    expect(high.id).toBeTruthy();
  });

  it('scores Naughty or Nice quiz across all 4 verdict brackets and emits PII-free share text', () => {
    const angel = scoreNaughtyOrNiceQuiz([0, 0, 0, 0, 0]);
    expect(angel.nicePercent).toBe(98);
    expect(angel.naughtyPercent).toBe(2);
    expect(angel.stampLabel).toBe('CERTIFIED NICE');

    const mostlyNice = scoreNaughtyOrNiceQuiz([0, 1, 1, 1, 1]);
    expect(mostlyNice.nicePercent).toBeGreaterThanOrEqual(68);
    expect(mostlyNice.nicePercent).toBeLessThan(85);
    expect(mostlyNice.stampLabel).toBe('MOSTLY NICE');

    const mischief = scoreNaughtyOrNiceQuiz([1, 2, 1, 2, 1]);
    expect(mischief.nicePercent).toBeGreaterThanOrEqual(45);
    expect(mischief.nicePercent).toBeLessThan(68);
    expect(mischief.stampLabel).toBe('SUSPICIOUS ELF');

    const chaos = scoreNaughtyOrNiceQuiz([2, 3, 3, 3, 3]);
    expect(chaos.nicePercent).toBeLessThan(45);
    expect(chaos.nicePercent + chaos.naughtyPercent).toBe(100);
    expect(chaos.stampLabel).toBe('NAUGHTY LEGEND');

    const share = buildSafeQuizShareText('Meera', angel);
    expect(share).toContain('Meera');
    expect(share).toContain('[Entertainment only]');
  });

  it('generates deterministic daily elf challenge and local date key', () => {
    const dateKey = getEventLocalDateKey(new Date('2026-12-18T12:00:00Z'), 'Asia/Kolkata');
    expect(dateKey).toBe('2026-12-18');
    const c1 = getDailyElfChallenge(dateKey, 'event-1');
    const c2 = getDailyElfChallenge(dateKey, 'event-1');
    expect(c1.challengeId).toBe(c2.challengeId);
    expect(c1.spotId).toBe(c2.spotId);
  });

  it('serializes and rehydrates structured gingerbread designs safely without raw SVG injection', () => {
    const clean = serializeGingerbreadDesign({
      eventId: 'evt-1',
      participantKey: 'key-1',
      shape: 'reindeer',
      icingColor: 'chocolate',
      decorations: [
        { id: 'd1', type: 'sprinkles', x: 120, y: -10, scale: 3, rotation: 90 },
        { id: 'd2', type: 'svg-glasses-sparkle', x: 50, y: 32, scale: 1.1, rotation: 0 },
        { id: 'd3', type: 'svg-bauble-gold-red', x: 64, y: 68, scale: 0.95, rotation: -12 },
      ],
      isPublicProfileDecor: true,
    });
    expect(clean.decorations[0].x).toBe(95);
    expect(clean.decorations[0].y).toBe(5);
    expect(clean.decorations[0].scale).toBe(1.6);
    expect(clean.decorations[0].rotation).toBe(45);
    expect(clean.decorations[1].type).toBe('svg-glasses-sparkle');
    expect(clean.decorations[2].type).toBe('svg-bauble-gold-red');

    const rehydrated = rehydrateGingerbreadDesign(clean, 'evt-1', 'key-1');
    expect(rehydrated.decorations).toHaveLength(3);
    expect(rehydrated.decorations[1].type).toBe('svg-glasses-sparkle');

    const fallback = rehydrateGingerbreadDesign({ invalid: true }, 'evt-1', 'key-1');
    expect(fallback.shape).toBe('person');
    expect(fallback.decorations).toEqual([]);
  });

  it('enforces explicit opt-in for dietary restrictions and cutoff lock on gift dislikes', () => {
    const withoutDietaryOptIn = extractShareableDislikes({
      dislikedCategories: ['Mugs'],
      dietaryRestrictions: ['Peanuts'],
      dislikedColors: ['Neon'],
      alreadyOwned: ['Headphones'],
      nonFoodNotes: '  Prefer cozy items  ',
      generalNotes: '  No coffee mugs please  ',
      shareWithSanta: true,
      shareDietaryWithSanta: false,
    });
    expect(withoutDietaryOptIn?.dietaryRestrictions).toEqual([]);
    expect(withoutDietaryOptIn?.dislikedCategories).toEqual(['Mugs']);
    expect(withoutDietaryOptIn?.nonFoodNotes).toBe('Prefer cozy items');
    expect(withoutDietaryOptIn?.generalNotes).toBe('No coffee mugs please');

    const withDietaryOptIn = extractShareableDislikes({
      dislikedCategories: ['Mugs'],
      dietaryRestrictions: ['Peanuts', 'Eggless'],
      dislikedColors: ['Neon', 'Mustard'],
      alreadyOwned: ['Kindle'],
      nonFoodNotes: 'Unscented only',
      generalNotes: '',
      shareWithSanta: true,
      shareDietaryWithSanta: true,
    });
    expect(withDietaryOptIn?.dietaryRestrictions).toEqual(['Peanuts', 'Eggless']);
    expect(withDietaryOptIn?.dislikedColors).toEqual(['Neon', 'Mustard']);

    const optedOutEntirely = extractShareableDislikes({
      dislikedCategories: ['Mugs'],
      dietaryRestrictions: ['Peanuts'],
      dislikedColors: [],
      alreadyOwned: [],
      nonFoodNotes: '',
      generalNotes: '',
      shareWithSanta: false,
      shareDietaryWithSanta: true,
    });
    expect(optedOutEntirely).toBeNull();

    const evt = makeEvent({ giftPreferencesCutoffAt: new Date('2026-12-14T10:00:00Z') });
    expect(isGiftPreferencesEditable(evt, new Date('2026-12-14T09:59:00Z'))).toBe(true);
    expect(isGiftPreferencesEditable(evt, new Date('2026-12-14T10:00:00Z'))).toBe(true);
    expect(isGiftPreferencesEditable(evt, new Date('2026-12-14T10:01:00Z'))).toBe(false);
  });
});
