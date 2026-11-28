# Security Specification — Secret Santa Firestore Rules

## 1. Data Invariants
1. **Default Deny**: All unspecified Firestore paths deny read and write (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Admin Only**: Admin access requires `request.auth != null && request.auth.token.email_verified == true` AND either the bootstrapped organizer email (`prernarajput09.CS@gmail.com`) or an explicit `/admins/{uid}` document.
3. **Zero PII Listing**: `allow list` on `/invitations`, `/participants`, `/matches`, and `/santaReveals` is strictly restricted to verified admins.
4. **No Raw Token Storage**: Invitations are keyed by 64-hex-character SHA-256 hashes of 256-bit cryptographic tokens; claiming transitions `status` strictly from `pending` -> `claimed` once and never allows re-claiming.
5. **Strict Server-Clock Reveal Locks**: `/matches/{participantKey}` cannot be read by non-admins until `request.time >= event.gifteeRevealAt`. `/santaReveals/{participantKey}` cannot be read by non-admins until `request.time >= event.santaIdentityRevealAt`.
6. **Hobby Cap & Payload Bounds**: Participants must provide 1–5 hobbies (each validated string bounded in size) and strict field allowlists with zero ghost/shadow fields.
7. **Immutable Fields & Temporal Integrity**: `createdAt`, `eventId`, and `invitationHash` cannot be altered after creation; timestamps must match `request.time` on creation/update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Ghost Field Injection on Participant Create**: Including `"isAdmin": true` in `/participants/{key}` -> `PERMISSION_DENIED`.
2. **6-Hobby Overflow**: Submitting 6 hobbies in `/participants/{key}` -> `PERMISSION_DENIED`.
3. **Zero-Hobby Bypass**: Submitting `hobbies: []` -> `PERMISSION_DENIED`.
4. **Oversized ID Poisoning**: Attempting to write `/participants/<200-char-id>` -> `PERMISSION_DENIED`.
5. **Unverified Admin Email Spoof**: Auth token with `email == 'prernarajput09.CS@gmail.com'` and `email_verified == false` attempting to list `/participants` -> `PERMISSION_DENIED`.
6. **Early Match Peek**: Participant attempting `get` on `/matches/{key}` while `request.time < event.gifteeRevealAt` -> `PERMISSION_DENIED`.
7. **Early Secret Santa Peek**: Participant attempting `get` on `/santaReveals/{key}` while `request.time < event.santaIdentityRevealAt` -> `PERMISSION_DENIED`.
8. **Participant Scraping**: Non-admin attempting `list` on `/participants` -> `PERMISSION_DENIED`.
9. **Invitation Replay Attack**: Attempting to re-claim an invitation whose `status` is already `'claimed'` -> `PERMISSION_DENIED`.
10. **Match Tampering**: Non-admin attempting to `create` or `update` `/matches/{key}` -> `PERMISSION_DENIED`.
11. **Immutable Field Hijack**: Participant trying to change `eventId` or `createdAt` during profile update -> `PERMISSION_DENIED`.
12. **Client-Spoofed Timestamp**: Submitting a backdated `createdAt` instead of `serverTimestamp()` (`request.time`) -> `PERMISSION_DENIED`.
