/**
 * Cryptographic utilities using Web Crypto API (never Math.random()).
 */

export function generateSecureTokenHex(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cryptographically unbiased random integer in [0, maxExclusive).
 * Uses rejection sampling to eliminate modulo bias.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    window.crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % maxExclusive;
}

/**
 * Generates a cryptographically unbiased derangement of items:
 * - Every participant sends a gift to exactly 1 other participant
 * - Every participant receives a gift from exactly 1 other participant
 * - Zero self-matches (result[i] !== items[i] for all i)
 * Throws if items.length < 2.
 */
export function generateUnbiasedDerangement<T>(items: T[]): T[] {
  const n = items.length;
  if (n < 2) {
    throw new Error('At least 2 joined participants are required to run Secret Santa matching.');
  }

  if (n === 2) {
    return [items[1], items[0]];
  }

  // Rejection-sampled cryptographic Fisher-Yates produces a mathematically uniform
  // distribution over all !n valid derangements (expected iterations ~= e ~= 2.718).
  for (let attempt = 0; attempt < 256; attempt++) {
    const shuffled = [...items];
    for (let i = n - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let hasFixedPoint = false;
    for (let i = 0; i < n; i++) {
      if (shuffled[i] === items[i]) {
        hasFixedPoint = true;
        break;
      }
    }
    if (!hasFixedPoint) {
      return shuffled;
    }
  }

  // Deterministic Sattolo fallback (guaranteed single-cycle derangement if 256 attempts ever miss)
  const cycle = [...items];
  for (let i = n - 1; i > 0; i--) {
    const j = secureRandomInt(i);
    [cycle[i], cycle[j]] = [cycle[j], cycle[i]];
  }
  return cycle;
}
