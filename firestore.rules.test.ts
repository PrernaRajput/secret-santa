/**
 * Security Rules Specification & Dirty Dozen Verification Cases
 * Verifies all 12 adversarial payloads against the Secret Santa Firestore rules invariants.
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
  reason: string;
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    id: 'DD-01',
    name: 'Ghost Field Injection on Participant Create',
    collection: 'participants',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      eventId: 'default-secret-santa-2026',
      invitationHash: '',
      name: 'Mallory',
      isAdmin: true,
      hobbies: ['Gaming'],
    },
    reason: 'isValidParticipant strictly enforces keys().hasOnly() and rejects shadow fields.',
  },
  {
    id: 'DD-02',
    name: '6-Hobby Overflow Attack',
    collection: 'participants',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      hobbies: ['Reading', 'Gaming', 'Art', 'Music', 'Coffee', 'Baking'],
    },
    reason: 'isValidHobbies enforces hobbies.size() <= 5.',
  },
  {
    id: 'DD-03',
    name: 'Zero-Hobby Bypass',
    collection: 'participants',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      hobbies: [],
    },
    reason: 'isValidHobbies requires hobbies.size() >= 1.',
  },
  {
    id: 'DD-04',
    name: 'Oversized Document ID Poisoning',
    collection: 'participants',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    reason: 'isValidHashId strictly requires exactly 64 lowercase hex characters.',
  },
  {
    id: 'DD-05',
    name: 'Unverified Admin Email Spoof',
    collection: 'participants',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
    reason: 'isSignedIn() requires request.auth.token.email_verified == true.',
  },
  {
    id: 'DD-06',
    name: 'Early Giftee Match Peek Before Reveal Date',
    collection: 'matches',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    reason: 'Matches rule verifies event.gifteeRevealAt <= request.time on server clock.',
  },
  {
    id: 'DD-07',
    name: 'Early Secret Santa Identity Peek Before Reveal Date',
    collection: 'santaReveals',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    reason: 'SantaReveals rule verifies event.santaIdentityRevealAt <= request.time on server clock.',
  },
  {
    id: 'DD-08',
    name: 'Participant Collection Scraping (List)',
    collection: 'participants',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
    reason: 'allow list on participants is strictly restricted to isAdmin().',
  },
  {
    id: 'DD-09',
    name: 'Claimed Invitation Replay Attack',
    collection: 'invitations',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      status: 'claimed',
    },
    reason: 'Invitation claim requires existing().status == "pending" (terminal lock).',
  },
  {
    id: 'DD-10',
    name: 'Unauthorized Match Tampering',
    collection: 'matches',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    reason: 'Only verified isAdmin() may create or update match documents.',
  },
  {
    id: 'DD-11',
    name: 'Immutable Field Hijack on Participant Update',
    collection: 'participants',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      eventId: 'other-event',
    },
    reason: 'Update enforces incoming().eventId == existing().eventId and affectedKeys().hasOnly().',
  },
  {
    id: 'DD-12',
    name: 'Client-Spoofed Timestamp Injection',
    collection: 'participants',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: {
      createdAt: '2020-01-01T00:00:00.000Z',
    },
    reason: 'Temporal integrity requires incoming().createdAt == request.time.',
  },
];
