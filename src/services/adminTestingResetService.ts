/**
 * PRE-PUBLISH TESTING ONLY — EASY TO REMOVE BEFORE LAUNCH.
 *
 * Allows authenticated event admins to reset any daily game or workshop feature's
 * Firestore documents (and local tab sandbox cache) either event-wide or for a
 * single participant so features can be tested repeatedly.
 */
import {
  collection,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, DEFAULT_EVENT_ID, handleFirestoreError, OperationType } from './firebase';
import { generateSecureTokenHex } from '../utils/crypto';
import { notifySandboxMailboxSync } from './workshopService';

export const WORKSHOP_DATA_RESET_EVENT = 'ss2026:workshop-data-reset';

export type AdminResetTargetId =
  | 'elf'
  | 'wheel'
  | 'advent'
  | 'quiz'
  | 'gingerbread'
  | 'snow-globe'
  | 'guesses'
  | 'dislikes'
  | 'mailbox'
  | 'delivery'
  | 'thank-you';

export interface AdminResetTargetMeta {
  id: AdminResetTargetId;
  category: 'daily-games' | 'workshop-features';
  label: string;
  emoji: string;
  description: string;
  sandboxPrefixes: string[];
}

export const ADMIN_RESET_TARGETS: AdminResetTargetMeta[] = [
  {
    id: 'elf',
    category: 'daily-games',
    label: 'Find the Hidden Elf',
    emoji: '🧝',
    description: 'Clears daily elf catches so the peeking elf & scavenger hunt reappear.',
    sandboxPrefixes: ['elf_'],
  },
  {
    id: 'wheel',
    category: 'daily-games',
    label: "Spin Santa's Wheel",
    emoji: '🎡',
    description: 'Clears daily wheel spins so participants can spin again today.',
    sandboxPrefixes: ['wheel_'],
  },
  {
    id: 'advent',
    category: 'daily-games',
    label: 'Daily Advent Surprises',
    emoji: '🎄',
    description: 'Closes all unlocked Advent cottage doors & clears Advent ornaments.',
    sandboxPrefixes: ['advent_'],
  },
  {
    id: 'quiz',
    category: 'daily-games',
    label: 'Naughty or Nice Meter',
    emoji: '🎅',
    description: 'Clears saved quiz answers & verdict stamps.',
    sandboxPrefixes: ['quiz_'],
  },
  {
    id: 'gingerbread',
    category: 'daily-games',
    label: 'Gingerbread Studio',
    emoji: '🍪',
    description: 'Clears baked gingerbread cookie shapes & toppings.',
    sandboxPrefixes: ['gingerbread_'],
  },
  {
    id: 'snow-globe',
    category: 'daily-games',
    label: 'Interactive Magical Snow Globe',
    emoji: '🔮',
    description: 'Clears placed snow globe ornaments & saved positions.',
    sandboxPrefixes: ['globe_'],
  },
  {
    id: 'guesses',
    category: 'workshop-features',
    label: 'Guess Your Santa',
    emoji: '🕵️',
    description: 'Clears submitted detective guesses, golden envelope state & Golden Detective Crown.',
    sandboxPrefixes: ['guesses_', 'golden_crown_'],
  },
  {
    id: 'dislikes',
    category: 'workshop-features',
    label: 'Things Santa Should Avoid',
    emoji: '🚫',
    description: 'Clears saved gift dislikes, allergies & shared Santa dislike mirrors.',
    sandboxPrefixes: ['prefs_'],
  },
  {
    id: 'mailbox',
    category: 'workshop-features',
    label: 'Anonymous Santa Mailbox',
    emoji: '📮',
    description: 'Clears anonymous conversations & messages between Santa and giftee.',
    sandboxPrefixes: ['mailbox_'],
  },
  {
    id: 'delivery',
    category: 'workshop-features',
    label: 'Gift Delivery & Confirmations',
    emoji: '🛷',
    description: 'Clears sleigh delivery stages, private courier notes & receipt confirmations.',
    sandboxPrefixes: ['delivery_', 'privtrack_', 'ack_'],
  },
  {
    id: 'thank-you',
    category: 'workshop-features',
    label: 'Animated Thank-You Cards',
    emoji: '💌',
    description: 'Clears sent thank-you cards so recipients can compose a fresh card.',
    sandboxPrefixes: ['thankyou_'],
  },
];

export const DAILY_GAME_RESET_IDS: AdminResetTargetId[] = ADMIN_RESET_TARGETS.filter(
  (t) => t.category === 'daily-games'
).map((t) => t.id);

export const ALL_FEATURE_RESET_IDS: AdminResetTargetId[] = ADMIN_RESET_TARGETS.map((t) => t.id);

function clearMatchingSandboxKeys(prefixes: string[], participantKey?: string) {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (!k || !k.startsWith('ss_p2_')) continue;
      const suffix = k.slice('ss_p2_'.length);
      const matchesPrefix = prefixes.some((p) => suffix.startsWith(p));
      if (!matchesPrefix) continue;
      if (participantKey && !suffix.includes(participantKey)) continue;
      keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // Ignore storage access errors
  }
}

async function commitDeletesInChunks(refs: DocumentReference[]): Promise<number> {
  if (refs.length === 0) return 0;
  // Deduplicate by full document path
  const uniqueMap = new Map<string, DocumentReference>();
  refs.forEach((ref) => uniqueMap.set(ref.path, ref));
  const uniqueRefs = Array.from(uniqueMap.values());

  const CHUNK_SIZE = 420;
  for (let i = 0; i < uniqueRefs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    uniqueRefs.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return uniqueRefs.length;
}

async function getParticipantAssignmentIds(participantKey: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const [matchSnap, incomingSnap] = await Promise.all([
    getDoc(doc(db, 'matches', participantKey)).catch(() => null),
    getDoc(doc(db, 'incomingAssignments', participantKey)).catch(() => null),
  ]);
  if (matchSnap?.exists()) {
    const outId = matchSnap.data().outgoingAssignmentId;
    if (typeof outId === 'string' && outId) ids.add(outId);
  }
  if (incomingSnap?.exists()) {
    const inId = incomingSnap.data().incomingAssignmentId;
    if (typeof inId === 'string' && inId) ids.add(inId);
  }
  return ids;
}

async function collectParticipantCollectionRefs(
  collectionName: string,
  eventId: string,
  participantKey?: string
): Promise<DocumentReference[]> {
  const snap = await getDocs(query(collection(db, collectionName), where('eventId', '==', eventId)));
  if (!participantKey) {
    return snap.docs.map((d) => d.ref);
  }
  return snap.docs
    .filter((d) => d.id === participantKey || d.data().participantKey === participantKey)
    .map((d) => d.ref);
}

async function collectAssignmentCollectionRefs(
  collectionName: string,
  eventId: string,
  assignmentIds?: Set<string>
): Promise<DocumentReference[]> {
  const snap = await getDocs(query(collection(db, collectionName), where('eventId', '==', eventId)));
  if (!assignmentIds) {
    return snap.docs.map((d) => d.ref);
  }
  if (assignmentIds.size === 0) return [];
  return snap.docs
    .filter((d) => assignmentIds.has(d.id) || assignmentIds.has(String(d.data().assignmentId || '')))
    .map((d) => d.ref);
}

async function collectMailboxRefs(
  eventId: string,
  assignmentIds?: Set<string>
): Promise<DocumentReference[]> {
  const convSnap = await getDocs(
    query(collection(db, 'anonymousConversations'), where('eventId', '==', eventId))
  );
  const targetConvs = assignmentIds
    ? convSnap.docs.filter((d) => assignmentIds.has(d.id))
    : convSnap.docs;

  const refs: DocumentReference[] = [];
  for (const convDoc of targetConvs) {
    // Query with assignmentId filter to satisfy firestore.rules list constraint
    const msgsSnap = await getDocs(
      query(
        collection(db, 'anonymousConversations', convDoc.id, 'messages'),
        where('assignmentId', '==', convDoc.id)
      )
    );
    msgsSnap.docs.forEach((m) => refs.push(m.ref));
    refs.push(convDoc.ref);
  }
  return refs;
}

export async function adminResetFeatureTargets(params: {
  targets: AdminResetTargetId[];
  eventId?: string;
  participantKey?: string;
  isLiveEvent: boolean;
}): Promise<{ deletedDocs: number; targetsReset: AdminResetTargetId[] }> {
  const eventId = params.eventId || DEFAULT_EVENT_ID;
  const participantKey = params.participantKey || undefined;
  const uniqueTargets = Array.from(new Set(params.targets));

  // Clear local sessionStorage sandbox caches for the selected targets
  const prefixes = uniqueTargets.flatMap(
    (id) => ADMIN_RESET_TARGETS.find((t) => t.id === id)?.sandboxPrefixes || []
  );
  clearMatchingSandboxKeys(prefixes, participantKey);

  let deletedDocs = 0;

  if (params.isLiveEvent) {
    try {
      const needsAssignments =
        Boolean(participantKey) &&
        uniqueTargets.some((t) =>
          ['dislikes', 'mailbox', 'delivery', 'thank-you'].includes(t)
        );
      const assignmentIds =
        participantKey && needsAssignments
          ? await getParticipantAssignmentIds(participantKey)
          : undefined;

      const refsToDelete: DocumentReference[] = [];

      for (const target of uniqueTargets) {
        switch (target) {
          case 'elf':
            refsToDelete.push(
              ...(await collectParticipantCollectionRefs('elfDiscoveries', eventId, participantKey))
            );
            break;
          case 'wheel':
            refsToDelete.push(
              ...(await collectParticipantCollectionRefs('dailyWheelSpins', eventId, participantKey))
            );
            break;
          case 'advent':
            refsToDelete.push(
              ...(await collectParticipantCollectionRefs('adventUnlocks', eventId, participantKey))
            );
            break;
          case 'quiz':
            refsToDelete.push(
              ...(await collectParticipantCollectionRefs('quizResults', eventId, participantKey))
            );
            break;
          case 'gingerbread':
            refsToDelete.push(
              ...(await collectParticipantCollectionRefs(
                'gingerbreadDesigns',
                eventId,
                participantKey
              ))
            );
            break;
          case 'snow-globe':
            refsToDelete.push(
              ...(await collectParticipantCollectionRefs(
                'snowGlobeDecorations',
                eventId,
                participantKey
              ))
            );
            break;
          case 'guesses': {
            refsToDelete.push(
              ...(await collectParticipantCollectionRefs('santaGuesses', eventId, participantKey))
            );
            // Also clear the rare Golden Detective Crown cosmetic when resetting guesses during testing
            const partSnap = await getDocs(
              query(collection(db, 'participants'), where('eventId', '==', eventId))
            );
            const targetParts = participantKey
              ? partSnap.docs.filter((d) => d.id === participantKey)
              : partSnap.docs;
            const crownedParts = targetParts.filter((d) => Boolean(d.data().hasGoldenDetectiveCrown));
            if (crownedParts.length > 0) {
              const crownBatch = writeBatch(db);
              crownedParts.forEach((d) => {
                crownBatch.update(d.ref, {
                  hasGoldenDetectiveCrown: false,
                  updatedAt: serverTimestamp(),
                });
              });
              await crownBatch.commit();
            }
            break;
          }
          case 'dislikes':
            refsToDelete.push(
              ...(await collectParticipantCollectionRefs(
                'giftPreferences',
                eventId,
                participantKey
              )),
              ...(await collectAssignmentCollectionRefs('sharedDislikes', eventId, assignmentIds))
            );
            break;
          case 'mailbox':
            refsToDelete.push(...(await collectMailboxRefs(eventId, assignmentIds)));
            break;
          case 'delivery':
            refsToDelete.push(
              ...(await collectAssignmentCollectionRefs(
                'deliveryProgress',
                eventId,
                assignmentIds
              )),
              ...(await collectParticipantCollectionRefs(
                'deliveryPrivateTracking',
                eventId,
                participantKey
              )),
              ...(await collectAssignmentCollectionRefs(
                'deliveryAcknowledgments',
                eventId,
                assignmentIds
              ))
            );
            break;
          case 'thank-you':
            refsToDelete.push(
              ...(await collectAssignmentCollectionRefs('thankYouCards', eventId, assignmentIds))
            );
            break;
        }
      }

      deletedDocs = await commitDeletesInChunks(refsToDelete);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `adminReset/${uniqueTargets.join(',')}`);
    }
  }

  // Notify mounted Workshop views to immediately re-hydrate fresh state
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(WORKSHOP_DATA_RESET_EVENT, {
        detail: { targets: uniqueTargets, participantKey: participantKey || null },
      })
    );
  }

  return { deletedDocs, targetsReset: uniqueTargets };
}

/**
 * PRE-PUBLISH TESTING ONLY — EASY TO REMOVE BEFORE LAUNCH.
 *
 * Sends a live dummy message from "Your Secret Santa" into the chosen
 * participant's incoming mailbox thread (or all matched participants) so
 * realtime onSnapshot delivery can be verified end-to-end.
 */
export async function adminSendDummySantaLetter(params: {
  eventId?: string;
  participantKey?: string;
  body: string;
  isLiveEvent: boolean;
}): Promise<{ sentCount: number }> {
  const eventId = params.eventId || DEFAULT_EVENT_ID;
  const cleanBody =
    params.body.trim().slice(0, 500) ||
    'Ho ho ho! 🎅 Your Secret Santa checking in from the North Pole — any festive gift hints for my elves? 🎁';

  if (!params.isLiveEvent) {
    // Update all matching local preview_in_* mailbox keys in sessionStorage
    let sentCount = 0;
    const suffixTarget = params.participantKey
      ? `preview_in_${params.participantKey.slice(0, 12)}`
      : null;
    try {
      const targetAssignmentIds = new Set<string>();
      if (suffixTarget) {
        targetAssignmentIds.add(suffixTarget);
      } else {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith('ss_p2_mailbox_preview_in_')) {
            targetAssignmentIds.add(k.slice('ss_p2_mailbox_'.length));
          }
        }
      }
      const messageId = `msg_${Date.now()}_${generateSecureTokenHex(4)}`;
      for (const assignmentId of targetAssignmentIds) {
        const key = `ss_p2_mailbox_${assignmentId}`;
        const raw = window.sessionStorage.getItem(key);
        const existing = raw ? (JSON.parse(raw) as unknown[]) : [];
        existing.push({
          id: messageId,
          assignmentId,
          eventId,
          senderRole: 'santa',
          body: cleanBody,
          createdAt: new Date().toISOString(),
          readByOther: false,
          reported: false,
        });
        window.sessionStorage.setItem(key, JSON.stringify(existing));
        notifySandboxMailboxSync(assignmentId);
        sentCount += 1;
      }
    } catch {
      // ignore storage errors
    }
    return { sentCount };
  }

  try {
    const incomingIds = new Set<string>();
    if (params.participantKey) {
      const snap = await getDoc(doc(db, 'incomingAssignments', params.participantKey));
      if (snap.exists()) {
        const id = String(snap.data().incomingAssignmentId || '');
        if (/^[a-f0-9]{64}$/.test(id)) incomingIds.add(id);
      }
    } else {
      const snap = await getDocs(
        query(collection(db, 'incomingAssignments'), where('eventId', '==', eventId))
      );
      snap.docs.forEach((d) => {
        const id = String(d.data().incomingAssignmentId || '');
        if (/^[a-f0-9]{64}$/.test(id)) incomingIds.add(id);
      });
    }

    let sentCount = 0;
    for (const assignmentId of incomingIds) {
      const convRef = doc(db, 'anonymousConversations', assignmentId);
      const convSnap = await getDoc(convRef);
      if (!convSnap.exists()) {
        await setDoc(convRef, {
          eventId,
          messageCount: 1,
          unreadForSanta: 0,
          unreadForRecipient: 1,
          lastSenderRole: 'santa',
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const cur = convSnap.data();
        await updateDoc(convRef, {
          messageCount: Math.min(500, Number(cur.messageCount || 0) + 1),
          unreadForSanta: Number(cur.unreadForSanta || 0),
          unreadForRecipient: Math.min(500, Number(cur.unreadForRecipient || 0) + 1),
          lastSenderRole: 'santa',
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const messageId = `msg_${Date.now()}_${generateSecureTokenHex(4)}`;
      await setDoc(doc(db, 'anonymousConversations', assignmentId, 'messages', messageId), {
        eventId,
        assignmentId,
        senderRole: 'santa',
        body: cleanBody,
        readByOther: false,
        reported: false,
        createdAt: serverTimestamp(),
      });
      sentCount += 1;
    }

    return { sentCount };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'anonymousConversations/dummySantaLetter');
  }
}
