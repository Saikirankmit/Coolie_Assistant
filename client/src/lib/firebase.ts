import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

function missing(name: string | undefined | null) {
  return !name || name === "";
}

const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";

let _auth: ReturnType<typeof getAuth> | null = null;

export function getFirebaseAuth() {
  if (_auth) return _auth;

  if (!isBrowser) {
    // Avoid initializing on the server.
    return null;
  }

  // Prefer Vite-injected envs via import.meta.env.* (these are statically replaced
  // at build time). Fall back to process.env if available (guarded).
  const nodeEnv: any = (typeof process !== "undefined" ? (process as any).env ?? {} : {});

  // Note: using direct `import.meta.env.VITE_...` lets Vite statically replace the
  // values at build/dev time. We avoid reading `import.meta.env` dynamically.
  const API_KEY = (import.meta as any).env?.VITE_FIREBASE_API_KEY ?? nodeEnv.VITE_FIREBASE_API_KEY ?? nodeEnv.FIREBASE_API_KEY;
  const PROJECT_ID = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID ?? nodeEnv.VITE_FIREBASE_PROJECT_ID ?? nodeEnv.FIREBASE_PROJECT_ID;
  const APP_ID = (import.meta as any).env?.VITE_FIREBASE_APP_ID ?? nodeEnv.VITE_FIREBASE_APP_ID ?? nodeEnv.FIREBASE_APP_ID;

  // Debugging presence (do not print secrets). This prints whether each value exists.
  // eslint-disable-next-line no-console
  console.debug("Firebase env presence:", {
    apiKey: !!API_KEY,
    projectId: !!PROJECT_ID,
    appId: !!APP_ID,
  });

  if (missing(API_KEY) || missing(PROJECT_ID) || missing(APP_ID)) {
    // Log a helpful error; do not throw so tooling doesn't crash on import.
    // Components should handle a null return value from getFirebaseAuth().
    // eslint-disable-next-line no-console
    console.error(
      "Missing Firebase environment variables for client runtime. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID (see .env.example)"
    );
    return null;
  }

  const firebaseConfig = {
    apiKey: API_KEY as string,
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID as string,
    storageBucket: `${PROJECT_ID}.appspot.com`,
    appId: APP_ID as string,
  };

  const app = initializeApp(firebaseConfig);
  _auth = getAuth(app);
  return _auth;
}

// Backwards-compatible export (may be null until getFirebaseAuth() is called).
export const auth = _auth;
