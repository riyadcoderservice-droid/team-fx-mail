import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

export interface SavedMailboxRecord {
  mailboxId: string;
  ownerUid: string;
  address: string;
  label?: string;
  createdAt?: unknown;
}

export async function signInWithGmail(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function signOutGmail(): Promise<void> {
  await signOut(auth);
}

const inFlightProfileSync = new Map<string, Promise<void>>();

export async function ensureUserProfile(user: User): Promise<void> {
  if (!user.uid || !user.email) return;
  const existingPromise = inFlightProfileSync.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const run = (async () => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const existingSnap = await getDoc(userRef);
      if (!existingSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email!.slice(0, 254),
          displayName: (user.displayName || user.email!.split('@')[0] || 'User').slice(0, 120),
          photoURL: (user.photoURL || '').slice(0, 1024),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(
          userRef,
          {
            email: user.email!.slice(0, 254),
            displayName: (user.displayName || user.email!.split('@')[0] || 'User').slice(0, 120),
            photoURL: (user.photoURL || '').slice(0, 1024),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      inFlightProfileSync.delete(user.uid);
    }
  })();

  inFlightProfileSync.set(user.uid, run);
  return run;
}

function toValidMailboxId(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 120);
}

export async function saveMailboxToAccount(
  user: User,
  address: string,
  label?: string
): Promise<void> {
  const mailboxId = toValidMailboxId(address);
  if (!mailboxId) return;
  await ensureUserProfile(user);
  const path = `users/${user.uid}/mailboxes/${mailboxId}`;
  const ref = doc(db, 'users', user.uid, 'mailboxes', mailboxId);

  let alreadyExists = false;
  try {
    const snap = await getDoc(ref);
    alreadyExists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!alreadyExists) {
    try {
      await setDoc(ref, {
        mailboxId,
        ownerUid: user.uid,
        address: address.toLowerCase().slice(0, 254),
        label: (label || 'Temp Mail').slice(0, 80),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function removeSavedMailboxFromAccount(
  user: User,
  address: string
): Promise<void> {
  const mailboxId = toValidMailboxId(address);
  if (!mailboxId) return;
  const path = `users/${user.uid}/mailboxes/${mailboxId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'mailboxes', mailboxId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserMailboxes(
  uid: string,
  onData: (items: SavedMailboxRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/mailboxes`;
  const q = query(
    collection(db, 'users', uid, 'mailboxes'),
    where('ownerUid', '==', uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: SavedMailboxRecord[] = snapshot.docs
        .map((d) => d.data() as SavedMailboxRecord)
        .sort((a, b) => {
          const tA =
            typeof a.createdAt === 'object' && a.createdAt && 'toMillis' in a.createdAt
              ? (a.createdAt as { toMillis: () => number }).toMillis()
              : 0;
          const tB =
            typeof b.createdAt === 'object' && b.createdAt && 'toMillis' in b.createdAt
              ? (b.createdAt as { toMillis: () => number }).toMillis()
              : 0;
          return tB - tA;
        });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
