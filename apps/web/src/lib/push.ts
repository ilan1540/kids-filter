import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function messaging() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null; // push is optional in local dev
  if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(raw)) });
  return getMessaging();
}

/** Sends a data+notification push. Never throws: a failed push must not fail the request. */
export async function push(
  tokens: (string | null | undefined)[],
  msg: { title?: string; body?: string; data: Record<string, string> },
): Promise<void> {
  const list = tokens.filter((t): t is string => !!t);
  const m = messaging();
  if (!m || list.length === 0) return;
  try {
    await m.sendEachForMulticast({
      tokens: list,
      data: msg.data,
      ...(msg.title ? { notification: { title: msg.title, body: msg.body } } : {}),
      android: { priority: "high" },
    });
  } catch (err) {
    console.error("push failed", err);
  }
}
