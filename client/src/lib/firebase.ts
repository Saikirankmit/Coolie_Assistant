import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

function missing(name: string | undefined | null) {
  return !name || name === "";
}

const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";

let _auth: ReturnType<typeof getAuth> | null = null;
let _app: any | null = null;

function initFirebaseAppIfNeeded() {
  if (!isBrowser) return null;
  if (_app) return _app;

  const nodeEnv: any = (typeof process !== "undefined" ? (process as any).env ?? {} : {});
  const API_KEY = (import.meta as any).env?.VITE_FIREBASE_API_KEY ?? nodeEnv.VITE_FIREBASE_API_KEY ?? nodeEnv.FIREBASE_API_KEY;
  const PROJECT_ID = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID ?? nodeEnv.VITE_FIREBASE_PROJECT_ID ?? nodeEnv.FIREBASE_PROJECT_ID;
  const APP_ID = (import.meta as any).env?.VITE_FIREBASE_APP_ID ?? nodeEnv.VITE_FIREBASE_APP_ID ?? nodeEnv.FIREBASE_APP_ID;

  console.debug("Firebase env presence:", { apiKey: !!API_KEY, projectId: !!PROJECT_ID, appId: !!APP_ID });

  if (missing(API_KEY) || missing(PROJECT_ID) || missing(APP_ID)) {
    console.error("Missing Firebase environment variables for client runtime. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID (see .env.example)");
    return null;
  }

  const firebaseConfig = {
    apiKey: API_KEY as string,
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID as string,
    storageBucket: `${PROJECT_ID}.appspot.com`,
    appId: APP_ID as string,
  };

  // If an app is already initialized by another module, reuse it.
  try {
    const apps = getApps();
    if (apps && apps.length > 0) {
      _app = getApp();
    } else {
      _app = initializeApp(firebaseConfig);
    }
  } catch (e) {
    try {
      _app = initializeApp(firebaseConfig);
    } catch (err) {
      console.error('Failed to initialize Firebase app', err);
      _app = null;
    }
  }

  return _app;
}

export function getFirebaseAuth() {
  if (_auth) return _auth;
  const app = initFirebaseAppIfNeeded();
  if (!app) return null;
  _auth = getAuth(app);
  return _auth;
}

export function getFirebaseStorage() {
  const app = initFirebaseAppIfNeeded();
  if (!app) return null;
  try {
    return getStorage(app);
  } catch (e) {
    console.error('Failed to get Firebase Storage', e);
    return null;
  }
}

// Backwards-compatible export (may be null until getFirebaseAuth() is called).
export const auth = _auth;
