import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function firebaseProjectId(): string {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is not configured.");
  }
  return projectId;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  if (getApps().length === 0) {
    initializeApp({ projectId: firebaseProjectId() });
  }
  const token = await getAuth().verifyIdToken(idToken);
  if (token.aud !== firebaseProjectId() || token.iss !== `https://securetoken.google.com/${firebaseProjectId()}`) {
    throw new Error("Firebase token belongs to a different project.");
  }
  return token;
}