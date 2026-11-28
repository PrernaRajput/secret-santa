import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const BOOTSTRAPPED_ADMIN_EMAIL = 'prernarajput09.cs@gmail.com';
export const DEFAULT_EVENT_ID = 'default-secret-santa-2026';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface FriendlyErrorAlert {
  message: string;
  technical?: string;
}

/**
 * Translates raw Firebase / structured FirestoreErrorInfo JSON strings into
 * clear, human-readable organizer alerts while preserving technical details
 * for an optional troubleshooting disclosure.
 */
export function formatFriendlyFirestoreError(
  err: unknown,
  fallback = 'Something went wrong while communicating with the database. Please try again.'
): FriendlyErrorAlert {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!raw) return { message: fallback };

  let parsed: Partial<FirestoreErrorInfo> | null = null;
  if (raw.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
    } catch {
      parsed = null;
    }
  }

  const underlying = (parsed?.error || raw).toLowerCase();
  const path = parsed?.path || '';
  const op = parsed?.operationType || '';
  const email = parsed?.authInfo?.email;

  if (underlying.includes('missing or insufficient permissions') || underlying.includes('permission-denied')) {
    const actionLabel =
      path.startsWith('events')
        ? 'saving event settings'
        : path.startsWith('admins')
          ? 'updating co-admin access'
          : path.startsWith('invitations')
            ? 'managing invitation links'
            : path.startsWith('matches') || path.startsWith('santaReveals')
              ? 'updating Secret Santa matches'
              : path.startsWith('participants')
                ? 'managing participants'
                : op
                  ? `performing that ${op} action`
                  : 'accessing the database';
    return {
      message: `Permission denied while ${actionLabel}. Please confirm you are signed in with an authorized organizer Google account${email ? ` (${email})` : ''}, or sign out and sign back in.`,
      technical: raw,
    };
  }

  if (underlying.includes('client is offline') || underlying.includes('unavailable') || underlying.includes('network')) {
    return {
      message: 'Could not reach the database right now. Check your internet connection and try again.',
      technical: raw,
    };
  }

  if (underlying.includes('quota exceeded')) {
    return {
      message: 'The free daily Firestore usage quota has been reached. Quota resets automatically tomorrow.',
      technical: raw,
    };
  }

  if (underlying.includes('popup-closed-by-user') || underlying.includes('cancelled-popup-request')) {
    return {
      message: 'Google Sign-In was cancelled before completing. Click "Sign in with Google" to try again.',
    };
  }

  if (parsed?.error) {
    return {
      message: fallback,
      technical: raw,
    };
  }

  return { message: raw };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInAdminWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutAdmin() {
  return signOut(auth);
}
