// FIX: Manually define the types for `import.meta.env` to resolve TypeScript errors
// related to Vite environment variables. This avoids issues where the build environment
// may not correctly load the `vite/client` type definitions.
declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_FIREBASE_API_KEY: string;
      readonly VITE_FIREBASE_AUTH_DOMAIN: string;
      readonly VITE_FIREBASE_PROJECT_ID: string;
      readonly VITE_FIREBASE_STORAGE_BUCKET: string;
      readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
      readonly VITE_FIREBASE_APP_ID: string;
      readonly VITE_GOOGLE_API_KEY: string;
      readonly VITE_GOOGLE_CLIENT_ID: string;
    }
  }
}

// WARNING: SENSITIVE DATA
// This file reads secrets from environment variables.
// DO NOT hardcode your keys here.
// For local development, create a .env.local file in the root of your project
// and add your keys there, prefixed with VITE_ (e.g., VITE_FIREBASE_API_KEY="...").
// For production (e.g., on Vercel), set these in your project's environment variable settings.

// Vite exposes environment variables on the `import.meta.env` object.
// Provide a fallback for environments where it might be undefined to prevent crashing.
// FIX: Cast the environment object to the declared type to satisfy TypeScript.
// The runtime check below will handle cases where variables are actually missing.
const env = (import.meta.env || {}) as ImportMeta['env'];

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const googleApiConfig = {
    apiKey: env.VITE_GOOGLE_API_KEY,
    clientId: env.VITE_GOOGLE_CLIENT_ID,
};

// Basic validation to ensure environment variables are set
if (!firebaseConfig.apiKey || !googleApiConfig.apiKey || !googleApiConfig.clientId) {
    console.error(
        "FATAL ERROR: Firebase or Google API keys are not configured. " +
        "Ensure you have a .env file with VITE_ prefixed variables for local development, " +
        "or that they are set in your deployment environment (e.g., Vercel)."
    );
}