import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { claimGoldenDetectiveCrown } from './secretSantaService';
import {
  AdventUnlockRecord,
  AnonymousConversationMeta,
  AnonymousMessage,
  DailyWheelSpinRecord,
  DeliveryAcknowledgmentRecord,
  DeliveryHistoryEntry,
  DeliveryPrivateTrackingRecord,
  DeliveryProgressRecord,
  DeliveryStage,
  ElfDiscoveryRecord,
  ElfHidingSpotId,
  GiftPreferencesRecord,
  GingerbreadDesign,
  IncomingAssignment,
  MailboxRole,
  NaughtyNiceQuizResult,
  PublicRosterEntry,
  SantaGuessItem,
  SantaGuessRecord,
  SecretSantaEvent,
  SnowGlobeConfigRecord,
  SnowGlobePlacedOrnament,
  ThankYouCardRecord,
  ThankYouTemplateId,
} from '../types/secretSanta';
import {
  ADVENT_SURPRISES,
  WHEEL_PRIZES,
} from '../data/workshopContent';
import {
  extractShareableDislikes,
  getAdventDayStatus,
  getDailyElfChallenge,
  getEventLocalDateKey,
  isGiftPreferencesEditable,
  isMailboxWindowOpen,
  moderateAnonymousMessage,
  normalizeDeliveryStage,
  pickWeightedWheelPrize,
  rehydrateGingerbreadDesign,
  serializeGingerbreadDesign,
  validateDeliveryTransition,
  validateSantaGuess,
} from '../utils/workshopLogic';
import { generateSecureTokenHex } from '../utils/crypto';

function toDateSafe(val: unknown, fallback = new Date()): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

// ---------- Tab-Scoped Interactive Sandbox Fallback (for preview before live Firestore matching) ----------

function sandboxRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(`ss_p2_${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sandboxWrite<T>(key: string, value: T): void {
  try {
    window.sessionStorage.setItem(`ss_p2_${key}`, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

// ---------- Authoritative Server Clock & Daily Elf Challenge ----------

export interface ServerWorkshopClock {
  serverNow: Date;
  dateKey: string;
  timezone: string;
  elfChallenge: ReturnType<typeof getDailyElfChallenge>;
  fromServer: boolean;
}

export async function fetchServerClockAndElf(
  timezone: string,
  eventId: string
): Promise<ServerWorkshopClock> {
  try {
    const res = await fetch(
      `/api/workshop/server-time?tz=${encodeURIComponent(timezone)}&eventId=${encodeURIComponent(eventId)}`
    );
    if (res.ok) {
      const data = await res.json();
      const rawIso = data.serverTimeIso || data.serverIso;
      const serverNow = new Date(rawIso);
      if (!Number.isNaN(serverNow.getTime())) {
        const resolvedDateKey = String(data.dateKey || getEventLocalDateKey(serverNow, timezone));
        const fallbackElf = getDailyElfChallenge(resolvedDateKey, eventId);
        const rawElf = data.elfChallenge;
        const normalizedElf = rawElf
          ? {
              challengeId: String(rawElf.challengeId || fallbackElf.challengeId),
              spotId: (rawElf.spotId || fallbackElf.spotId) as ElfHidingSpotId,
              spotLabel: String(rawElf.spotLabel || fallbackElf.spotLabel),
              spotHint: String(rawElf.spotHint || fallbackElf.spotHint),
              spotEmoji: String(rawElf.spotEmoji || fallbackElf.spotEmoji),
              reward: rawElf.reward
                ? {
                    title: String(rawElf.reward.title || fallbackElf.reward.title),
                    emoji: String(rawElf.reward.emoji || fallbackElf.reward.emoji),
                    collectibleId: String(
                      rawElf.reward.collectibleId || fallbackElf.reward.collectibleId
                    ),
                    joke: String(rawElf.reward.joke || fallbackElf.reward.joke),
                  }
                : {
                    title: String(rawElf.rewardTitle || fallbackElf.reward.title),
                    emoji: String(rawElf.rewardEmoji || fallbackElf.reward.emoji),
                    collectibleId: String(
                      rawElf.collectibleId || fallbackElf.reward.collectibleId
                    ),
                    joke: String(rawElf.rewardJoke || fallbackElf.reward.joke),
                  },
            }
          : fallbackElf;

        return {
          serverNow,
          dateKey: resolvedDateKey,
          timezone: String(data.timezone || timezone),
          elfChallenge: normalizedElf,
          fromServer: true,
        };
      }
    }
  } catch {
    // Fall back gracefully if offline or server unreachable
  }

  const now = new Date();
  const dateKey = getEventLocalDateKey(now, timezone);
  return {
    serverNow: now,
    dateKey,
    timezone,
    elfChallenge: getDailyElfChallenge(dateKey, eventId),
    fromServer: false,
  };
}

// ---------- Role-Separated Incoming Assignment & Roster ----------

export async function fetchIncomingAssignment(
  participantKey: string
): Promise<IncomingAssignment | null> {
  try {
    const snap = await getDoc(doc(db, 'incomingAssignments', participantKey));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      eventId: String(d.eventId),
      recipientKey: String(d.recipientKey),
      incomingAssignmentId: String(d.incomingAssignmentId),
    };
  } catch {
    return null;
  }
}

export function subscribeToIncomingAssignment(
  participantKey: string,
  enabled: boolean,
  onChange: (assignment: IncomingAssignment | null) => void,
  onError?: (message: string) => void
): () => void {
  if (!enabled || !/^[a-f0-9]{64}$/.test(participantKey)) {
    onChange(null);
    return () => undefined;
  }
  return onSnapshot(
    doc(db, 'incomingAssignments', participantKey),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const d = snap.data();
      onChange({
        eventId: String(d.eventId || ''),
        recipientKey: String(d.recipientKey || participantKey),
        incomingAssignmentId: String(d.incomingAssignmentId || ''),
      });
    },
    () => {
      onError?.('Could not load your incoming gift channel from the database.');
      onChange(null);
    }
  );
}

export async function fetchEventRoster(eventId: string): Promise<PublicRosterEntry[]> {
  try {
    const snap = await getDoc(doc(db, 'eventRosters', eventId));
    if (!snap.exists()) return [];
    const d = snap.data();
    if (!Array.isArray(d.entries)) return [];
    return d.entries.map((entry: Record<string, unknown>) => ({
      publicId: String(entry.publicId || ''),
      name: String(entry.name || ''),
      avatarId: String(entry.avatarId || 'santa-hat-girl'),
    }));
  } catch {
    return [];
  }
}

// ---------- Feature 1: Anonymous Santa Mailbox ----------

const SANDBOX_MAILBOX_EVENT = 'ss_sandbox_mailbox_sync';

export function notifySandboxMailboxSync(assignmentId: string): void {
  try {
    window.dispatchEvent(new CustomEvent(SANDBOX_MAILBOX_EVENT, { detail: { assignmentId } }));
  } catch {
    // ignore in non-browser contexts
  }
}

function sortMessagesChronologically(list: AnonymousMessage[]): AnonymousMessage[] {
  return [...list].sort((a, b) => {
    const diff = a.createdAt.getTime() - b.createdAt.getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

export function subscribeToAnonymousConversation(
  assignmentId: string,
  liveMode: boolean,
  onMessages: (messages: AnonymousMessage[]) => void,
  onMeta?: (meta: AnonymousConversationMeta | null) => void,
  onError?: (message: string) => void
): () => void {
  const isHexId = /^[a-f0-9]{64}$/.test(assignmentId);

  // Never fall back to localStorage while live mode is waiting for a real 64-hex assignmentId
  if (liveMode && !isHexId) {
    return () => undefined;
  }

  if (!liveMode) {
    const emitLocal = () => {
      const stored = sandboxRead<AnonymousMessage[]>(`mailbox_${assignmentId}`, []);
      onMessages(
        sortMessagesChronologically(
          stored.map((m) => ({
            ...m,
            createdAt: toDateSafe(m.createdAt),
          }))
        )
      );
      onMeta?.(null);
    };
    emitLocal();
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ assignmentId?: string }>).detail;
      if (!detail?.assignmentId || detail.assignmentId === assignmentId) {
        emitLocal();
      }
    };
    window.addEventListener(SANDBOX_MAILBOX_EVENT, handler);
    return () => window.removeEventListener(SANDBOX_MAILBOX_EVENT, handler);
  }

  // Query with single-field equality filter only (satisfies firestore.rules without requiring a composite index)
  // and sort chronologically client-side for reliable realtime onSnapshot delivery.
  const msgQuery = query(
    collection(db, 'anonymousConversations', assignmentId, 'messages'),
    where('assignmentId', '==', assignmentId)
  );

  const unsubMsgs = onSnapshot(
    msgQuery,
    (snap) => {
      const list: AnonymousMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          assignmentId: String(data.assignmentId),
          eventId: String(data.eventId),
          senderRole: data.senderRole === 'santa' ? 'santa' : 'recipient',
          body: String(data.body || ''),
          createdAt: toDateSafe(data.createdAt),
          readByOther: Boolean(data.readByOther),
          reported: Boolean(data.reported),
          reportReason: data.reportReason ? String(data.reportReason) : undefined,
        };
      });
      onMessages(sortMessagesChronologically(list));
    },
    (err) => {
      console.error('Mailbox realtime listener error:', err);
      onError?.('Could not sync live mailbox messages. Check your connection and try again.');
    }
  );

  const unsubMeta = onSnapshot(
    doc(db, 'anonymousConversations', assignmentId),
    (snap) => {
      if (!snap.exists()) {
        onMeta?.(null);
        return;
      }
      const d = snap.data();
      onMeta?.({
        assignmentId: snap.id,
        eventId: String(d.eventId),
        messageCount: Number(d.messageCount || 0),
        unreadForSanta: Number(d.unreadForSanta || 0),
        unreadForRecipient: Number(d.unreadForRecipient || 0),
        lastMessageAt: d.lastMessageAt ? toDateSafe(d.lastMessageAt) : null,
        lastSenderRole:
          d.lastSenderRole === 'santa' || d.lastSenderRole === 'recipient'
            ? d.lastSenderRole
            : null,
      });
    },
    () => {
      onMeta?.(null);
    }
  );

  return () => {
    unsubMsgs();
    unsubMeta();
  };
}

export async function sendAnonymousMessage(params: {
  event: SecretSantaEvent;
  assignmentId: string;
  senderRole: MailboxRole;
  rawBody: string;
  serverNow: Date;
  liveMode: boolean;
}): Promise<{ ok: boolean; error?: string; message?: AnonymousMessage }> {
  const { event, assignmentId, senderRole, rawBody, serverNow, liveMode } = params;

  if (liveMode) {
    const windowStatus = isMailboxWindowOpen(event, serverNow);
    if (!windowStatus.open) {
      return { ok: false, error: windowStatus.reason || 'Mailbox is currently closed.' };
    }
  }

  // Server-side moderation & rate-limiting check (falls back to identical local validator if offline)
  let sanitized = '';
  try {
    const res = await fetch('/api/workshop/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: rawBody, channelKey: `${assignmentId}_${senderRole}` }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.reason || data.error || 'Please revise your message.' };
    }
    sanitized = String(data.sanitized || rawBody.trim());
  } catch {
    const localMod = moderateAnonymousMessage(rawBody);
    if (!localMod.ok || !localMod.sanitized) {
      return { ok: false, error: localMod.reason || 'Invalid message.' };
    }
    sanitized = localMod.sanitized;
  }

  const messageId = `msg_${Date.now()}_${generateSecureTokenHex(4)}`;
  const newMsg: AnonymousMessage = {
    id: messageId,
    assignmentId,
    eventId: event.id,
    senderRole,
    body: sanitized,
    createdAt: new Date(),
    readByOther: false,
    reported: false,
  };

  if (!liveMode) {
    const existing = sandboxRead<AnonymousMessage[]>(`mailbox_${assignmentId}`, []);
    const updated = [...existing, newMsg];
    sandboxWrite(`mailbox_${assignmentId}`, updated);
    notifySandboxMailboxSync(assignmentId);
    return { ok: true, message: newMsg };
  }

  if (!/^[a-f0-9]{64}$/.test(assignmentId)) {
    return {
      ok: false,
      error: 'Your live mailbox thread is still syncing. Please wait a moment and try again.',
    };
  }

  try {
    const convRef = doc(db, 'anonymousConversations', assignmentId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) {
      await setDoc(convRef, {
        eventId: event.id,
        messageCount: 1,
        unreadForSanta: senderRole === 'recipient' ? 1 : 0,
        unreadForRecipient: senderRole === 'santa' ? 1 : 0,
        lastSenderRole: senderRole,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const cur = convSnap.data();
      await updateDoc(convRef, {
        messageCount: Math.min(500, Number(cur.messageCount || 0) + 1),
        unreadForSanta:
          senderRole === 'recipient'
            ? Math.min(500, Number(cur.unreadForSanta || 0) + 1)
            : Number(cur.unreadForSanta || 0),
        unreadForRecipient:
          senderRole === 'santa'
            ? Math.min(500, Number(cur.unreadForRecipient || 0) + 1)
            : Number(cur.unreadForRecipient || 0),
        lastSenderRole: senderRole,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await setDoc(doc(db, 'anonymousConversations', assignmentId, 'messages', messageId), {
      eventId: event.id,
      assignmentId,
      senderRole,
      body: sanitized,
      readByOther: false,
      reported: false,
      createdAt: serverTimestamp(),
    });

    return { ok: true, message: newMsg };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `anonymousConversations/${assignmentId}/messages`);
  }
}

export async function markMailboxRead(
  assignmentId: string,
  readerRole: MailboxRole,
  liveMode: boolean
): Promise<void> {
  if (!liveMode || !/^[a-f0-9]{64}$/.test(assignmentId)) return;
  try {
    const convRef = doc(db, 'anonymousConversations', assignmentId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) return;
    await updateDoc(convRef, {
      unreadForSanta: readerRole === 'santa' ? 0 : Number(snap.data().unreadForSanta || 0),
      unreadForRecipient:
        readerRole === 'recipient' ? 0 : Number(snap.data().unreadForRecipient || 0),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // non-blocking read receipt sync
  }
}

export async function reportAnonymousMessage(params: {
  assignmentId: string;
  messageId: string;
  reason: string;
  liveMode: boolean;
}): Promise<void> {
  if (!params.liveMode || !/^[a-f0-9]{64}$/.test(params.assignmentId)) {
    const existing = sandboxRead<AnonymousMessage[]>(`mailbox_${params.assignmentId}`, []);
    sandboxWrite(
      `mailbox_${params.assignmentId}`,
      existing.map((m) =>
        m.id === params.messageId ? { ...m, reported: true, reportReason: params.reason } : m
      )
    );
    notifySandboxMailboxSync(params.assignmentId);
    return;
  }
  await updateDoc(doc(db, 'anonymousConversations', params.assignmentId, 'messages', params.messageId), {
    reported: true,
    reportReason: params.reason.trim().slice(0, 200) || 'Flagged by participant',
  });
}

// ---------- Feature 2: Guess Your Santa ----------

export async function fetchMySantaGuesses(
  participantKey: string,
  eventId: string,
  liveMode: boolean
): Promise<SantaGuessRecord | null> {
  if (!liveMode) {
    const local = sandboxRead<SantaGuessRecord | null>(`guesses_${participantKey}`, null);
    return local ? { ...local, updatedAt: new Date(local.updatedAt) } : null;
  }
  try {
    const snap = await getDoc(doc(db, 'santaGuesses', participantKey));
    if (!snap.exists()) return null;
    const d = snap.data();
      return {
        eventId: String(d.eventId || eventId),
        participantKey,
        guesses: Array.isArray(d.guesses) ? (d.guesses as SantaGuessItem[]) : [],
        goldenEnvelopeOpened: Boolean(d.goldenEnvelopeOpened),
        updatedAt: toDateSafe(d.updatedAt),
      };
    } catch {
      return null;
    }
  }

export function readSandboxGoldenCrown(eventId: string, participantKey: string): boolean {
  return sandboxRead<boolean>(`golden_crown_${eventId}_${participantKey}`, false);
}

export function writeSandboxGoldenCrown(
  eventId: string,
  participantKey: string,
  unlocked: boolean
): void {
  sandboxWrite(`golden_crown_${eventId}_${participantKey}`, unlocked);
}

/**
 * Unseals The 1% Santa Secret golden envelope and permanently grants
 * the rare Golden Detective Crown avatar cosmetic for this event.
 */
export async function openGoldenSecretEnvelope(params: {
  participantKey: string;
  eventId: string;
  liveMode: boolean;
}): Promise<void> {
  const { participantKey, eventId, liveMode } = params;
  writeSandboxGoldenCrown(eventId, participantKey, true);

  if (!liveMode) {
    const existing = sandboxRead<SantaGuessRecord | null>(`guesses_${participantKey}`, null);
    if (existing) {
      sandboxWrite(`guesses_${participantKey}`, {
        ...existing,
        goldenEnvelopeOpened: true,
        updatedAt: new Date(),
      });
    }
    return;
  }

  try {
    await updateDoc(doc(db, 'santaGuesses', participantKey), {
      goldenEnvelopeOpened: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `santaGuesses/${participantKey}`);
  }

  await claimGoldenDetectiveCrown(participantKey);
}

export async function submitSantaGuess(params: {
  event: SecretSantaEvent;
  participantKey: string;
  selfPublicId: string;
  candidate: PublicRosterEntry;
  roster: PublicRosterEntry[];
  existingGuesses: SantaGuessItem[];
  liveMode: boolean;
}): Promise<{ ok: boolean; error?: string; record?: SantaGuessRecord; reaction?: string }> {
  const { event, participantKey, selfPublicId, candidate, roster, existingGuesses, liveMode } =
    params;

  const check = validateSantaGuess({
    event: liveMode ? event : { ...event, isMatched: true },
    existingGuesses,
    guessedPublicId: candidate.publicId,
    selfPublicId,
    validRosterPublicIds: roster.map((r) => r.publicId),
  });
  if (!check.ok || !check.reaction) {
    return { ok: false, error: check.reason || 'Could not submit guess.' };
  }

  const nextItem: SantaGuessItem = {
    guessedPublicId: candidate.publicId,
    guessedName: candidate.name,
    guessedAvatarId: candidate.avatarId,
    reaction: check.reaction,
    submittedAtIso: new Date().toISOString(),
  };
  const nextGuesses = [...existingGuesses, nextItem];
  const nextRecord: SantaGuessRecord = {
    eventId: event.id,
    participantKey,
    guesses: nextGuesses,
    updatedAt: new Date(),
  };

  if (!liveMode) {
    sandboxWrite(`guesses_${participantKey}`, nextRecord);
    return { ok: true, record: nextRecord, reaction: check.reaction };
  }

  try {
    const ref = doc(db, 'santaGuesses', participantKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        eventId: event.id,
        participantKey,
        guesses: nextGuesses,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        guesses: nextGuesses,
        updatedAt: serverTimestamp(),
      });
    }
    return { ok: true, record: nextRecord, reaction: check.reaction };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `santaGuesses/${participantKey}`);
  }
}

// ---------- Feature 3 & 11: Delivery Tracker & Independent Acknowledgment ----------

const SANDBOX_DELIVERY_EVENT = 'ss_sandbox_delivery_sync';

function notifySandboxDeliverySync(assignmentId: string): void {
  try {
    window.dispatchEvent(new CustomEvent(SANDBOX_DELIVERY_EVENT, { detail: { assignmentId } }));
  } catch {
    // ignore in non-browser contexts
  }
}

function sanitizeHistoryList(
  raw: unknown,
  fallback: DeliveryHistoryEntry[]
): DeliveryHistoryEntry[] {
  if (!Array.isArray(raw)) return fallback;
  const cleaned = raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      stage: normalizeDeliveryStage(entry.stage),
      note: typeof entry.note === 'string' ? entry.note.slice(0, 240) : '',
      atIso:
        typeof entry.atIso === 'string' && entry.atIso
          ? entry.atIso
          : new Date().toISOString(),
    }));
  return cleaned.length > 0 ? cleaned : fallback;
}

export function subscribeToDeliveryProgress(
  assignmentId: string,
  eventId: string,
  liveMode: boolean,
  onChange: (record: DeliveryProgressRecord) => void,
  onError?: (message: string) => void
): () => void {
  const defaultRec: DeliveryProgressRecord = {
    assignmentId,
    eventId,
    stage: 'preparing',
    history: [
      {
        stage: 'preparing',
        note: 'Santa received the mission!',
        atIso: new Date().toISOString(),
      },
    ],
    sharedNote: '',
    updatedAt: new Date(),
  };

  const isHexId = /^[a-f0-9]{64}$/.test(assignmentId);

  // Never fall back to localStorage while live mode is waiting for a real 64-hex assignmentId
  if (liveMode && !isHexId) {
    return () => undefined;
  }

  if (!liveMode) {
    const emitLocal = () => {
      const saved = sandboxRead<DeliveryProgressRecord | null>(`delivery_${assignmentId}`, null);
      if (!saved) {
        onChange(defaultRec);
        return;
      }
      onChange({
        assignmentId,
        eventId: saved.eventId || eventId,
        stage: normalizeDeliveryStage(saved.stage),
        history: sanitizeHistoryList(saved.history, defaultRec.history),
        sharedNote: String(saved.sharedNote || ''),
        updatedAt: toDateSafe(saved.updatedAt),
      });
    };
    emitLocal();
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ assignmentId?: string }>).detail;
      if (!detail?.assignmentId || detail.assignmentId === assignmentId) {
        emitLocal();
      }
    };
    window.addEventListener(SANDBOX_DELIVERY_EVENT, handler);
    return () => window.removeEventListener(SANDBOX_DELIVERY_EVENT, handler);
  }

  return onSnapshot(
    doc(db, 'deliveryProgress', assignmentId),
    (snap) => {
      if (!snap.exists()) {
        onChange(defaultRec);
        return;
      }
      const d = snap.data();
      onChange({
        assignmentId: snap.id,
        eventId: String(d.eventId || eventId),
        stage: normalizeDeliveryStage(d.stage),
        history: sanitizeHistoryList(d.history, defaultRec.history),
        sharedNote: String(d.sharedNote || ''),
        updatedAt: toDateSafe(d.updatedAt),
      });
    },
    (err) => {
      const msg = err instanceof Error && err.message.toLowerCase().includes('permission')
        ? 'Could not read live delivery status due to database permissions.'
        : 'Could not sync live delivery status from the database. Check your connection.';
      onError?.(msg);
    }
  );
}

export async function updateDeliveryStage(params: {
  assignmentId: string;
  eventId: string;
  currentStage: DeliveryStage;
  nextStage: DeliveryStage;
  history: DeliveryHistoryEntry[];
  sharedNote: string;
  liveMode: boolean;
}): Promise<{ ok: boolean; error?: string; record?: DeliveryProgressRecord }> {
  const safeCurrent = normalizeDeliveryStage(params.currentStage);
  const safeNext = normalizeDeliveryStage(params.nextStage);
  const transition = validateDeliveryTransition(safeCurrent, safeNext);
  if (!transition.ok) {
    return { ok: false, error: transition.reason };
  }

  if (params.liveMode && !/^[a-f0-9]{64}$/.test(params.assignmentId)) {
    return {
      ok: false,
      error: 'Your live gift assignment is still syncing. Please wait a moment and try again.',
    };
  }

  const cleanNote = params.sharedNote.trim().slice(0, 240);
  const nextHistory: DeliveryHistoryEntry[] = transition.idempotent
    ? params.history.slice(-20)
    : [
        ...params.history.slice(-18),
        {
          stage: safeNext,
          note: cleanNote,
          atIso: new Date().toISOString(),
        },
      ];

  const nextRec: DeliveryProgressRecord = {
    assignmentId: params.assignmentId,
    eventId: params.eventId,
    stage: safeNext,
    history: nextHistory,
    sharedNote: cleanNote,
    updatedAt: new Date(),
  };

  if (!params.liveMode) {
    sandboxWrite(`delivery_${params.assignmentId}`, nextRec);
    notifySandboxDeliverySync(params.assignmentId);
    return { ok: true, record: nextRec };
  }

  try {
    const ref = doc(db, 'deliveryProgress', params.assignmentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        eventId: params.eventId,
        assignmentId: params.assignmentId,
        stage: safeNext,
        history: nextHistory,
        sharedNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        stage: safeNext,
        history: nextHistory,
        sharedNote: cleanNote,
        updatedAt: serverTimestamp(),
      });
    }
    return { ok: true, record: nextRec };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    return {
      ok: false,
      error: msg.includes('permission')
        ? 'Delivery tracking is currently locked or paused by the event organizer.'
        : 'Could not update delivery checkpoint right now. Please try again.',
    };
  }
}

export async function fetchPrivateTracking(
  participantKey: string,
  eventId: string,
  liveMode: boolean
): Promise<DeliveryPrivateTrackingRecord> {
  const empty: DeliveryPrivateTrackingRecord = {
    eventId,
    participantKey,
    courierName: '',
    trackingCode: '',
    privateNote: '',
    updatedAt: new Date(),
  };
  if (!liveMode) {
    const saved = sandboxRead<DeliveryPrivateTrackingRecord | null>(`privtrack_${participantKey}`, null);
    return saved ? { ...saved, updatedAt: new Date(saved.updatedAt) } : empty;
  }
  if (!/^[a-f0-9]{64}$/.test(participantKey)) return empty;
  try {
    const snap = await getDoc(doc(db, 'deliveryPrivateTracking', participantKey));
    if (!snap.exists()) return empty;
    const d = snap.data();
    return {
      eventId: String(d.eventId || eventId),
      participantKey,
      courierName: String(d.courierName || ''),
      trackingCode: String(d.trackingCode || ''),
      privateNote: String(d.privateNote || ''),
      updatedAt: toDateSafe(d.updatedAt),
    };
  } catch {
    return empty;
  }
}

export async function savePrivateTracking(
  record: Omit<DeliveryPrivateTrackingRecord, 'updatedAt'>,
  liveMode: boolean
): Promise<{ ok: boolean; error?: string }> {
  const clean = {
    eventId: record.eventId,
    participantKey: record.participantKey,
    courierName: record.courierName.trim().slice(0, 80),
    trackingCode: record.trackingCode.trim().slice(0, 120),
    privateNote: record.privateNote.trim().slice(0, 240),
  };
  if (!liveMode) {
    sandboxWrite(`privtrack_${record.participantKey}`, { ...clean, updatedAt: new Date() });
    return { ok: true };
  }
  if (!/^[a-f0-9]{64}$/.test(record.participantKey)) {
    return { ok: false, error: 'Your participant session is not synced yet.' };
  }
  try {
    const ref = doc(db, 'deliveryPrivateTracking', record.participantKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { ...clean, updatedAt: serverTimestamp() });
    } else {
      await updateDoc(ref, {
        courierName: clean.courierName,
        trackingCode: clean.trackingCode,
        privateNote: clean.privateNote,
        updatedAt: serverTimestamp(),
      });
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save your private courier note right now.' };
  }
}

export function subscribeToDeliveryAcknowledgment(
  assignmentId: string,
  eventId: string,
  liveMode: boolean,
  onChange: (record: DeliveryAcknowledgmentRecord) => void,
  onError?: (message: string) => void
): () => void {
  const defaultAck: DeliveryAcknowledgmentRecord = {
    assignmentId,
    eventId,
    status: 'pending',
    acknowledgedAt: null,
    problemSummary: '',
    adminCorrectionNote: '',
    correctedBy: '',
    updatedAt: new Date(),
  };

  const isHexId = /^[a-f0-9]{64}$/.test(assignmentId);

  // Never fall back to localStorage while live mode is waiting for a real 64-hex assignmentId
  if (liveMode && !isHexId) {
    return () => undefined;
  }

  if (!liveMode) {
    const emitLocal = () => {
      const saved = sandboxRead<DeliveryAcknowledgmentRecord | null>(`ack_${assignmentId}`, null);
      onChange(
        saved
          ? {
              ...saved,
              acknowledgedAt: saved.acknowledgedAt ? new Date(saved.acknowledgedAt) : null,
              updatedAt: toDateSafe(saved.updatedAt),
            }
          : defaultAck
      );
    };
    emitLocal();
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ assignmentId?: string }>).detail;
      if (!detail?.assignmentId || detail.assignmentId === assignmentId) {
        emitLocal();
      }
    };
    window.addEventListener(SANDBOX_DELIVERY_EVENT, handler);
    return () => window.removeEventListener(SANDBOX_DELIVERY_EVENT, handler);
  }

  return onSnapshot(
    doc(db, 'deliveryAcknowledgments', assignmentId),
    (snap) => {
      if (!snap.exists()) {
        onChange(defaultAck);
        return;
      }
      const d = snap.data();
      const rawStatus = String(d.status || 'pending');
      const status: DeliveryAcknowledgmentRecord['status'] =
        rawStatus === 'received' || rawStatus === 'problem' ? rawStatus : 'pending';
      onChange({
        assignmentId: snap.id,
        eventId: String(d.eventId || eventId),
        status,
        acknowledgedAt: d.acknowledgedAt ? toDateSafe(d.acknowledgedAt) : null,
        problemSummary: String(d.problemSummary || ''),
        adminCorrectionNote: String(d.adminCorrectionNote || ''),
        correctedBy: String(d.correctedBy || ''),
        updatedAt: toDateSafe(d.updatedAt),
      });
    },
    () => {
      onError?.('Could not sync gift receipt status from the database.');
    }
  );
}

export async function submitDeliveryAcknowledgment(params: {
  assignmentId: string;
  eventId: string;
  status: 'received' | 'problem';
  problemSummary?: string;
  liveMode: boolean;
}): Promise<{ ok: boolean; error?: string; record?: DeliveryAcknowledgmentRecord }> {
  if (params.liveMode && !/^[a-f0-9]{64}$/.test(params.assignmentId)) {
    return {
      ok: false,
      error: 'Your live gift assignment is still syncing. Please wait a moment and try again.',
    };
  }

  const next: DeliveryAcknowledgmentRecord = {
    assignmentId: params.assignmentId,
    eventId: params.eventId,
    status: params.status,
    acknowledgedAt: params.status === 'received' ? new Date() : null,
    problemSummary: (params.problemSummary || '').trim().slice(0, 300),
    adminCorrectionNote: '',
    correctedBy: '',
    updatedAt: new Date(),
  };

  if (!params.liveMode) {
    sandboxWrite(`ack_${params.assignmentId}`, next);
    notifySandboxDeliverySync(params.assignmentId);
    return { ok: true, record: next };
  }

  try {
    const ref = doc(db, 'deliveryAcknowledgments', params.assignmentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        eventId: params.eventId,
        assignmentId: params.assignmentId,
        status: params.status,
        acknowledgedAt: params.status === 'received' ? serverTimestamp() : null,
        problemSummary: next.problemSummary,
        adminCorrectionNote: '',
        correctedBy: '',
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        status: params.status,
        acknowledgedAt: params.status === 'received' ? serverTimestamp() : null,
        problemSummary: next.problemSummary,
        updatedAt: serverTimestamp(),
      });
    }
    return { ok: true, record: next };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    return {
      ok: false,
      error: msg.includes('permission')
        ? 'Receipt status is already confirmed or locked by the organizer.'
        : 'Could not save your receipt confirmation right now. Please try again.',
    };
  }
}

// ---------- Feature 13: Animated Thank-You Cards ----------

export async function fetchThankYouCard(
  assignmentId: string,
  liveMode: boolean
): Promise<ThankYouCardRecord | null> {
  if (!liveMode || !/^[a-f0-9]{64}$/.test(assignmentId)) {
    const saved = sandboxRead<ThankYouCardRecord | null>(`thankyou_${assignmentId}`, null);
    return saved ? { ...saved, createdAt: new Date(saved.createdAt) } : null;
  }
  try {
    const snap = await getDoc(doc(db, 'thankYouCards', assignmentId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      assignmentId: snap.id,
      eventId: String(d.eventId),
      templateId: (d.templateId as ThankYouTemplateId) || 'santa-heart',
      message: String(d.message || ''),
      reactions: Array.isArray(d.reactions) ? d.reactions.map(String) : [],
      createdAt: toDateSafe(d.createdAt),
    };
  } catch {
    return null;
  }
}

export async function sendThankYouCard(params: {
  assignmentId: string;
  eventId: string;
  templateId: ThankYouTemplateId;
  message: string;
  reactions: string[];
  liveMode: boolean;
}): Promise<ThankYouCardRecord> {
  const cleanMsg = params.message.trim().slice(0, 300);
  const cleanReactions = params.reactions.slice(0, 8);
  const record: ThankYouCardRecord = {
    assignmentId: params.assignmentId,
    eventId: params.eventId,
    templateId: params.templateId,
    message: cleanMsg,
    reactions: cleanReactions,
    createdAt: new Date(),
  };

  if (!params.liveMode || !/^[a-f0-9]{64}$/.test(params.assignmentId)) {
    sandboxWrite(`thankyou_${params.assignmentId}`, record);
    return record;
  }

  await setDoc(doc(db, 'thankYouCards', params.assignmentId), {
    eventId: params.eventId,
    assignmentId: params.assignmentId,
    templateId: params.templateId,
    message: cleanMsg,
    reactions: cleanReactions,
    createdAt: serverTimestamp(),
  });
  return record;
}

// ---------- Feature 4: Daily Advent Surprises ----------

export async function fetchAdventUnlocks(
  participantKey: string,
  liveMode: boolean
): Promise<AdventUnlockRecord[]> {
  if (!liveMode) {
    const saved = sandboxRead<AdventUnlockRecord[]>(`advent_${participantKey}`, []);
    return saved.map((item) => ({ ...item, unlockedAt: new Date(item.unlockedAt) }));
  }

  // Fetch days 1..25 directly by scoped doc ID (participant-scoped get, never list!)
  const snaps = await Promise.all(
    ADVENT_SURPRISES.map((s) =>
      getDoc(doc(db, 'adventUnlocks', `${participantKey}_day-${s.day}`)).catch(() => null)
    )
  );
  const unlocks: AdventUnlockRecord[] = [];
  snaps.forEach((snap) => {
    if (snap && snap.exists()) {
      const d = snap.data();
      unlocks.push({
        id: snap.id,
        eventId: String(d.eventId),
        participantKey: String(d.participantKey),
        day: Number(d.day),
        rewardKind: d.rewardKind,
        collectibleId: String(d.collectibleId || ''),
        collectibleName: String(d.collectibleName || ''),
        collectibleEmoji: String(d.collectibleEmoji || ''),
        unlockedAt: toDateSafe(d.unlockedAt),
      });
    }
  });
  return unlocks.sort((a, b) => a.day - b.day);
}

export async function unlockAdventDoor(params: {
  event: SecretSantaEvent;
  participantKey: string;
  day: number;
  serverNow: Date;
  existingUnlockedDays: Set<number>;
  liveMode: boolean;
}): Promise<{ ok: boolean; error?: string; record?: AdventUnlockRecord }> {
  const status = getAdventDayStatus(
    params.day,
    params.event,
    params.serverNow,
    params.existingUnlockedDays
  );
  if (status === 'locked') {
    return { ok: false, error: `Door #${params.day} is still locked until its official calendar date!` };
  }
  if (status === 'missed') {
    return { ok: false, error: `Door #${params.day} window has passed.` };
  }
  const surprise = ADVENT_SURPRISES.find((s) => s.day === params.day);
  if (!surprise) return { ok: false, error: 'Invalid calendar door.' };

  const id = `${params.participantKey}_day-${params.day}`;
  const record: AdventUnlockRecord = {
    id,
    eventId: params.event.id,
    participantKey: params.participantKey,
    day: params.day,
    rewardKind: surprise.kind,
    collectibleId: surprise.collectibleId || '',
    collectibleName: surprise.collectibleName || '',
    collectibleEmoji: surprise.collectibleEmoji || surprise.emoji,
    unlockedAt: params.serverNow,
  };

  if (!params.liveMode) {
    const existing = sandboxRead<AdventUnlockRecord[]>(`advent_${params.participantKey}`, []);
    if (!existing.some((e) => e.day === params.day)) {
      sandboxWrite(`advent_${params.participantKey}`, [...existing, record]);
    }
    return { ok: true, record };
  }

  try {
    await setDoc(doc(db, 'adventUnlocks', id), {
      eventId: params.event.id,
      participantKey: params.participantKey,
      day: params.day,
      rewardKind: surprise.kind,
      collectibleId: record.collectibleId,
      collectibleName: record.collectibleName,
      collectibleEmoji: record.collectibleEmoji,
      unlockedAt: serverTimestamp(),
    });
    return { ok: true, record };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.message.toLowerCase().includes('permission')
          ? `Door #${params.day} is locked by the server calendar until its scheduled day.`
          : 'Could not open this Advent door right now.',
    };
  }
}

// ---------- Feature 5: Spin Santa's Wheel ----------

export async function fetchTodayWheelSpin(
  participantKey: string,
  dateKey: string,
  liveMode: boolean
): Promise<DailyWheelSpinRecord | null> {
  const spinId = `${participantKey}_${dateKey}`;
  if (!liveMode) {
    const saved = sandboxRead<DailyWheelSpinRecord | null>(`wheel_${spinId}`, null);
    return saved ? { ...saved, spunAt: new Date(saved.spunAt) } : null;
  }
  try {
    const snap = await getDoc(doc(db, 'dailyWheelSpins', spinId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      eventId: String(d.eventId),
      participantKey: String(d.participantKey),
      dateKey: String(d.dateKey),
      prizeId: String(d.prizeId),
      slotIndex: Number(d.slotIndex),
      prizeLabel: String(d.prizeLabel),
      prizeMessage: String(d.prizeMessage),
      prizeEmoji: String(d.prizeEmoji || '🎡'),
      collectibleId: String(d.collectibleId || ''),
      collectibleName: String(d.collectibleName || ''),
      spunAt: toDateSafe(d.spunAt),
    };
  } catch {
    return null;
  }
}

export async function fetchRecentWheelSpins(
  participantKey: string,
  serverNow: Date,
  timezone: string,
  liveMode: boolean
): Promise<DailyWheelSpinRecord[]> {
  // Check the past 7 event-local calendar days (scoped getDoc, zero list queries)
  const dateKeys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(serverNow.getTime() - i * 86_400_000);
    return getEventLocalDateKey(d, timezone);
  });
  const results = await Promise.all(
    dateKeys.map((dk) => fetchTodayWheelSpin(participantKey, dk, liveMode))
  );
  return results.filter((r): r is DailyWheelSpinRecord => Boolean(r));
}

export async function spinSantasWheel(params: {
  event: SecretSantaEvent;
  participantKey: string;
  dateKey: string;
  liveMode: boolean;
}): Promise<{ ok: boolean; error?: string; record?: DailyWheelSpinRecord }> {
  const existing = await fetchTodayWheelSpin(params.participantKey, params.dateKey, params.liveMode);
  if (existing) {
    return { ok: false, error: 'You already used your daily free spin today! Come back tomorrow!' };
  }

  // Ask authoritative server for weighted prize selection
  let selectedPrize = WHEEL_PRIZES[0];
  let resolvedDateKey = params.dateKey;
  try {
    const res = await fetch('/api/workshop/wheel-spin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: params.event.id,
        participantKey: params.participantKey,
        timezone: params.event.timezone,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.prize) {
        selectedPrize = data.prize;
      }
      if (data.dateKey) {
        resolvedDateKey = String(data.dateKey);
      }
    } else {
      selectedPrize = pickWeightedWheelPrize(Math.random());
    }
  } catch {
    selectedPrize = pickWeightedWheelPrize(Math.random());
  }

  const spinId = `${params.participantKey}_${resolvedDateKey}`;
  const record: DailyWheelSpinRecord = {
    id: spinId,
    eventId: params.event.id,
    participantKey: params.participantKey,
    dateKey: resolvedDateKey,
    prizeId: selectedPrize.id,
    slotIndex: selectedPrize.slotIndex,
    prizeLabel: selectedPrize.label,
    prizeMessage: selectedPrize.message,
    prizeEmoji: selectedPrize.emoji,
    collectibleId: selectedPrize.collectibleId || '',
    collectibleName: selectedPrize.collectibleName || '',
    spunAt: new Date(),
  };

  if (!params.liveMode) {
    sandboxWrite(`wheel_${spinId}`, record);
    return { ok: true, record };
  }

  try {
    await setDoc(doc(db, 'dailyWheelSpins', spinId), {
      eventId: params.event.id,
      participantKey: params.participantKey,
      dateKey: resolvedDateKey,
      prizeId: selectedPrize.id,
      slotIndex: selectedPrize.slotIndex,
      prizeLabel: selectedPrize.label,
      prizeMessage: selectedPrize.message,
      prizeEmoji: selectedPrize.emoji,
      collectibleId: record.collectibleId,
      collectibleName: record.collectibleName,
      spunAt: serverTimestamp(),
    });
    return { ok: true, record };
  } catch {
    return { ok: false, error: 'You already spun Santa’s Wheel today!' };
  }
}

// ---------- Feature 6: Naughty or Nice Meter ----------

export async function fetchQuizResult(
  participantKey: string,
  liveMode: boolean
): Promise<NaughtyNiceQuizResult | null> {
  if (!liveMode) {
    const saved = sandboxRead<NaughtyNiceQuizResult | null>(`quiz_${participantKey}`, null);
    return saved ? { ...saved, completedAt: new Date(saved.completedAt) } : null;
  }
  try {
    const snap = await getDoc(doc(db, 'quizResults', participantKey));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      eventId: String(d.eventId),
      participantKey,
      quizVersion: String(d.quizVersion),
      nicePercent: Number(d.nicePercent),
      naughtyPercent: Number(d.naughtyPercent),
      verdictTitle: String(d.verdictTitle),
      verdictSubtitle: String(d.verdictSubtitle),
      stampLabel: String(d.stampLabel),
      answers: Array.isArray(d.answers) ? d.answers.map(Number) : [],
      completedAt: toDateSafe(d.completedAt),
    };
  } catch {
    return null;
  }
}

export async function saveQuizResult(
  result: Omit<NaughtyNiceQuizResult, 'completedAt'>,
  liveMode: boolean
): Promise<NaughtyNiceQuizResult> {
  const full: NaughtyNiceQuizResult = { ...result, completedAt: new Date() };
  if (!liveMode) {
    sandboxWrite(`quiz_${result.participantKey}`, full);
    return full;
  }
  const ref = doc(db, 'quizResults', result.participantKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      ...result,
      completedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      quizVersion: result.quizVersion,
      nicePercent: result.nicePercent,
      naughtyPercent: result.naughtyPercent,
      verdictTitle: result.verdictTitle,
      verdictSubtitle: result.verdictSubtitle,
      stampLabel: result.stampLabel,
      answers: result.answers,
      completedAt: serverTimestamp(),
    });
  }
  return full;
}

// ---------- Feature 7: Find the Hidden Elf ----------

export async function fetchTodayElfDiscovery(
  participantKey: string,
  dateKey: string,
  liveMode: boolean
): Promise<ElfDiscoveryRecord | null> {
  const discoveryId = `${participantKey}_${dateKey}`;
  if (!liveMode) {
    const saved = sandboxRead<ElfDiscoveryRecord | null>(`elf_${discoveryId}`, null);
    return saved ? { ...saved, discoveredAt: new Date(saved.discoveredAt) } : null;
  }
  try {
    const snap = await getDoc(doc(db, 'elfDiscoveries', discoveryId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      eventId: String(d.eventId),
      participantKey: String(d.participantKey),
      dateKey: String(d.dateKey),
      challengeId: String(d.challengeId),
      spotId: d.spotId as ElfHidingSpotId,
      rewardTitle: String(d.rewardTitle),
      rewardEmoji: String(d.rewardEmoji || '🧝'),
      collectibleId: String(d.collectibleId || ''),
      discoveredAt: toDateSafe(d.discoveredAt),
    };
  } catch {
    return null;
  }
}

export async function recordElfDiscovery(params: {
  eventId: string;
  participantKey: string;
  dateKey: string;
  challengeId: string;
  spotId: ElfHidingSpotId;
  rewardTitle: string;
  rewardEmoji: string;
  collectibleId: string;
  liveMode: boolean;
}): Promise<ElfDiscoveryRecord> {
  const discoveryId = `${params.participantKey}_${params.dateKey}`;
  const safeRewardTitle = params.rewardTitle.trim().slice(0, 100) || 'Hidden Elf Reward';
  const safeRewardEmoji = (params.rewardEmoji || '🧝').slice(0, 16);
  const safeCollectibleId = (params.collectibleId || '').slice(0, 64);
  const safeChallengeId = params.challengeId.trim().slice(0, 80);

  const record: ElfDiscoveryRecord = {
    id: discoveryId,
    eventId: params.eventId,
    participantKey: params.participantKey,
    dateKey: params.dateKey,
    challengeId: safeChallengeId,
    spotId: params.spotId,
    rewardTitle: safeRewardTitle,
    rewardEmoji: safeRewardEmoji,
    collectibleId: safeCollectibleId,
    discoveredAt: new Date(),
  };

  if (!params.liveMode) {
    sandboxWrite(`elf_${discoveryId}`, record);
    return record;
  }

  // Idempotent check first since firestore.rules disallows updates to elfDiscoveries
  const existing = await fetchTodayElfDiscovery(params.participantKey, params.dateKey, true);
  if (existing) {
    return existing;
  }

  try {
    await setDoc(doc(db, 'elfDiscoveries', discoveryId), {
      eventId: params.eventId,
      participantKey: params.participantKey,
      dateKey: params.dateKey,
      challengeId: safeChallengeId,
      spotId: params.spotId,
      rewardTitle: safeRewardTitle,
      rewardEmoji: safeRewardEmoji,
      collectibleId: safeCollectibleId,
      discoveredAt: serverTimestamp(),
    });
    return record;
  } catch (err) {
    // Handle concurrent creation across tabs cleanly
    const raceExisting = await fetchTodayElfDiscovery(params.participantKey, params.dateKey, true);
    if (raceExisting) {
      return raceExisting;
    }
    console.error('Failed to persist Hidden Elf discovery to Firestore:', err);
    throw err;
  }
}

// ---------- Feature 8: Gingerbread Cookie Studio ----------

export async function fetchGingerbreadDesign(
  participantKey: string,
  eventId: string,
  liveMode: boolean
): Promise<GingerbreadDesign | null> {
  if (!liveMode) {
    const saved = sandboxRead<unknown>(`gingerbread_${participantKey}`, null);
    if (!saved) return null;
    return rehydrateGingerbreadDesign(saved, eventId, participantKey);
  }
  try {
    const snap = await getDoc(doc(db, 'gingerbreadDesigns', participantKey));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      ...rehydrateGingerbreadDesign(d, eventId, participantKey),
      updatedAt: toDateSafe(d.updatedAt),
    };
  } catch {
    return null;
  }
}

export async function saveGingerbreadDesign(
  design: GingerbreadDesign,
  liveMode: boolean
): Promise<GingerbreadDesign> {
  const clean = serializeGingerbreadDesign(design);
  const full: GingerbreadDesign = { ...clean, updatedAt: new Date() };
  if (!liveMode) {
    sandboxWrite(`gingerbread_${design.participantKey}`, full);
    return full;
  }
  const ref = doc(db, 'gingerbreadDesigns', design.participantKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...clean, updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, {
      shape: clean.shape,
      icingColor: clean.icingColor,
      decorations: clean.decorations,
      isPublicProfileDecor: clean.isPublicProfileDecor,
      updatedAt: serverTimestamp(),
    });
  }
  return full;
}

// ---------- Feature 10: Gift Dislikes & Restrictions ----------

export async function fetchGiftPreferences(
  participantKey: string,
  eventId: string,
  liveMode: boolean
): Promise<{ record: GiftPreferencesRecord; loadError?: string }> {
  const empty: GiftPreferencesRecord = {
    eventId,
    participantKey,
    dislikedCategories: [],
    dietaryRestrictions: [],
    dislikedColors: [],
    alreadyOwned: [],
    nonFoodNotes: '',
    generalNotes: '',
    shareWithSanta: true,
    shareDietaryWithSanta: false,
    updatedAt: new Date(),
  };

  if (!liveMode) {
    const saved = sandboxRead<GiftPreferencesRecord | null>(`prefs_${participantKey}`, null);
    return {
      record: saved ? { ...saved, updatedAt: new Date(saved.updatedAt) } : empty,
    };
  }

  try {
    const snap = await getDoc(doc(db, 'giftPreferences', participantKey));
    if (!snap.exists()) return { record: empty };
    const d = snap.data();
    return {
      record: {
        eventId: String(d.eventId || eventId),
        participantKey,
        dislikedCategories: Array.isArray(d.dislikedCategories)
          ? d.dislikedCategories.map(String)
          : [],
        dietaryRestrictions: Array.isArray(d.dietaryRestrictions)
          ? d.dietaryRestrictions.map(String)
          : [],
        dislikedColors: Array.isArray(d.dislikedColors) ? d.dislikedColors.map(String) : [],
        alreadyOwned: Array.isArray(d.alreadyOwned) ? d.alreadyOwned.map(String) : [],
        nonFoodNotes: String(d.nonFoodNotes || ''),
        generalNotes: String(d.generalNotes || ''),
        shareWithSanta: d.shareWithSanta === undefined ? true : Boolean(d.shareWithSanta),
        shareDietaryWithSanta: Boolean(d.shareDietaryWithSanta),
        updatedAt: toDateSafe(d.updatedAt),
      },
    };
  } catch {
    return {
      record: empty,
      loadError: 'Could not load previously saved guardrails. Check your connection before saving.',
    };
  }
}

export async function saveGiftPreferences(
  event: SecretSantaEvent,
  prefs: Omit<GiftPreferencesRecord, 'updatedAt'>,
  serverNow: Date,
  liveMode: boolean,
  incomingAssignmentId?: string | null
): Promise<{ ok: boolean; error?: string; record?: GiftPreferencesRecord }> {
  if (liveMode && !isGiftPreferencesEditable(event, serverNow)) {
    return {
      ok: false,
      error: 'Gift dislikes & restrictions are now locked because the cutoff deadline has passed.',
    };
  }

  const dedupeBounded = (arr: string[], maxItems: number, maxLen: number): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of arr) {
      const cleaned = raw.trim().slice(0, maxLen);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cleaned);
      if (out.length >= maxItems) break;
    }
    return out;
  };

  const clean = {
    eventId: prefs.eventId,
    participantKey: prefs.participantKey,
    dislikedCategories: dedupeBounded(prefs.dislikedCategories, 12, 60),
    dietaryRestrictions: dedupeBounded(prefs.dietaryRestrictions, 8, 60),
    dislikedColors: dedupeBounded(prefs.dislikedColors, 8, 40),
    alreadyOwned: dedupeBounded(prefs.alreadyOwned, 10, 60),
    nonFoodNotes: prefs.nonFoodNotes.trim().slice(0, 240),
    generalNotes: prefs.generalNotes.trim().slice(0, 300),
    shareWithSanta: Boolean(prefs.shareWithSanta),
    shareDietaryWithSanta: Boolean(prefs.shareDietaryWithSanta),
  };

  const full: GiftPreferencesRecord = { ...clean, updatedAt: new Date() };
  if (!liveMode) {
    sandboxWrite(`prefs_${prefs.participantKey}`, full);
    return { ok: true, record: full };
  }

  try {
    const ref = doc(db, 'giftPreferences', prefs.participantKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { ...clean, updatedAt: serverTimestamp() });
    } else {
      await updateDoc(ref, {
        dislikedCategories: clean.dislikedCategories,
        dietaryRestrictions: clean.dietaryRestrictions,
        dislikedColors: clean.dislikedColors,
        alreadyOwned: clean.alreadyOwned,
        nonFoodNotes: clean.nonFoodNotes,
        generalNotes: clean.generalNotes,
        shareWithSanta: clean.shareWithSanta,
        shareDietaryWithSanta: clean.shareDietaryWithSanta,
        updatedAt: serverTimestamp(),
      });
    }

    // If matching already ran and editing is still open before cutoff,
    // anonymously mirror sanitized guardrails to the opaque assignmentId so
    // the assigned Secret Santa sees updates (or opt-outs) immediately.
    if (event.isMatched && incomingAssignmentId && /^[a-f0-9]{64}$/.test(incomingAssignmentId)) {
      const shareable = extractShareableDislikes(clean);
      const sharedRef = doc(db, 'sharedDislikes', incomingAssignmentId);
      const sharedPayload = shareable
        ? {
            eventId: clean.eventId,
            assignmentId: incomingAssignmentId,
            isShared: true,
            dislikedCategories: shareable.dislikedCategories,
            dietaryRestrictions: shareable.dietaryRestrictions,
            dislikedColors: shareable.dislikedColors,
            alreadyOwned: shareable.alreadyOwned,
            nonFoodNotes: shareable.nonFoodNotes,
            generalNotes: shareable.generalNotes,
            updatedAt: serverTimestamp(),
          }
        : {
            eventId: clean.eventId,
            assignmentId: incomingAssignmentId,
            isShared: false,
            dislikedCategories: [],
            dietaryRestrictions: [],
            dislikedColors: [],
            alreadyOwned: [],
            nonFoodNotes: '',
            generalNotes: '',
            updatedAt: serverTimestamp(),
          };
      const sharedSnap = await getDoc(sharedRef);
      if (!sharedSnap.exists()) {
        await setDoc(sharedRef, sharedPayload);
      } else {
        await updateDoc(sharedRef, {
          isShared: sharedPayload.isShared,
          dislikedCategories: sharedPayload.dislikedCategories,
          dietaryRestrictions: sharedPayload.dietaryRestrictions,
          dislikedColors: sharedPayload.dislikedColors,
          alreadyOwned: sharedPayload.alreadyOwned,
          nonFoodNotes: sharedPayload.nonFoodNotes,
          generalNotes: sharedPayload.generalNotes,
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { ok: true, record: full };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.message.toLowerCase().includes('permission')
          ? 'Your dislikes are locked because the cutoff time passed.'
          : 'Could not save your preferences right now.',
    };
  }
}

// ---------- Feature 14: Interactive Snow Globe Ornaments ----------

export async function fetchSnowGlobeConfig(
  participantKey: string,
  eventId: string,
  liveMode: boolean
): Promise<SnowGlobeConfigRecord> {
  const empty: SnowGlobeConfigRecord = {
    eventId,
    participantKey,
    decorations: [],
    updatedAt: new Date(),
  };
  if (!liveMode) {
    const saved = sandboxRead<SnowGlobeConfigRecord | null>(`globe_${participantKey}`, null);
    return saved ? { ...saved, updatedAt: new Date(saved.updatedAt) } : empty;
  }
  try {
    const snap = await getDoc(doc(db, 'snowGlobeDecorations', participantKey));
    if (!snap.exists()) return empty;
    const d = snap.data();
    return {
      eventId: String(d.eventId || eventId),
      participantKey,
      decorations: Array.isArray(d.decorations)
        ? (d.decorations as SnowGlobePlacedOrnament[])
        : [],
      updatedAt: toDateSafe(d.updatedAt),
    };
  } catch {
    return empty;
  }
}

export async function saveSnowGlobeConfig(
  eventId: string,
  participantKey: string,
  decorations: SnowGlobePlacedOrnament[],
  liveMode: boolean
): Promise<SnowGlobeConfigRecord> {
  const clamped = decorations.slice(0, 16).map((d) => ({
    ...d,
    x: Math.round(Math.max(15, Math.min(85, d.x))),
    y: Math.round(Math.max(20, Math.min(78, d.y))),
  }));
  const record: SnowGlobeConfigRecord = {
    eventId,
    participantKey,
    decorations: clamped,
    updatedAt: new Date(),
  };
  if (!liveMode) {
    sandboxWrite(`globe_${participantKey}`, record);
    return record;
  }
  const ref = doc(db, 'snowGlobeDecorations', participantKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      eventId,
      participantKey,
      decorations: clamped,
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      decorations: clamped,
      updatedAt: serverTimestamp(),
    });
  }
  return record;
}

// ---------- Feature 12: Non-Enumerating Session Recovery Request ----------

export async function submitSessionRecoveryRequest(params: {
  eventId: string;
  requestedName: string;
  verificationHint: string;
  liveMode?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const cleanEventId =
    params.eventId && /^[a-zA-Z0-9_-]{1,128}$/.test(params.eventId.trim())
      ? params.eventId.trim()
      : 'default-secret-santa-2026';
  const cleanName = params.requestedName.trim().slice(0, 100);
  const cleanHint = params.verificationHint.trim().slice(0, 240);
  if (!cleanName) {
    return { ok: false, message: 'Please enter the name you used when joining Secret Santa.' };
  }

  let requestId = `rec_${Date.now()}_${generateSecureTokenHex(6)}`;
  let genericMessage =
    "Your request has been sent to the event organizer. Once they verify your identity, they'll send you a fresh one-time 24-hour recovery link.";

  try {
    const res = await fetch('/api/workshop/recovery-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: cleanEventId,
        requestedName: cleanName,
        verificationHint: cleanHint,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message: data.message || data.error || 'Please wait a few minutes before trying again.',
      };
    }
    if (typeof data.requestId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(data.requestId)) {
      requestId = data.requestId;
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      genericMessage = data.message.trim();
    }
  } catch {
    // Backend rate-limit helper unavailable; proceed directly to Firestore persistence
  }

  try {
    await setDoc(doc(db, 'recoveryRequests', requestId), {
      eventId: cleanEventId,
      requestedName: cleanName,
      verificationHint: cleanHint,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Session recovery request write failed:', err);
    return {
      ok: false,
      message:
        'We could not deliver your recovery request right now. Please check your internet connection and try again, or contact your organizer directly.',
    };
  }

  return { ok: true, message: genericMessage };
}
