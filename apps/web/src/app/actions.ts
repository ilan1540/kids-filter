"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseVideoId } from "@kids/shared";
import { auth, signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { newPairingCode } from "@/lib/device-auth";
import { addVideosToList } from "@/lib/lists";
import { ownChild, ownList } from "@/lib/ownership";
import { hashPassword } from "@/lib/password";

/** Result shape for forms that show an error inline (useActionState). */
export type FormState = { error?: string; ok?: string } | undefined;

async function parentId(): Promise<string> {
  const session = await auth();
  if (!session?.parentId) redirect("/login");
  return session.parentId;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------------- auth ----------------

const Signup = z.object({
  name: z.string().trim().max(60),
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8, "הסיסמה צריכה לפחות 8 תווים"),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Signup.safeParse({ name: str(form, "name"), email: str(form, "email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים לא תקינים" };
  const { name, email, password } = parsed.data;
  const existing = await db.parent.findUnique({ where: { email } });
  if (existing?.passwordHash) return { error: "כבר קיים חשבון עם המייל הזה. אפשר להתחבר." };
  const passwordHash = await hashPassword(password);
  await db.parent.upsert({
    where: { email },
    create: { email, name: name || null, passwordHash },
    update: { passwordHash, name: name || existing?.name },
  });
  await signIn("credentials", { email, password, redirectTo: "/" });
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", { email: str(form, "email"), password: form.get("password"), redirectTo: "/" });
  } catch (err) {
    if (err instanceof AuthError) return { error: "מייל או סיסמה שגויים" };
    throw err; // the redirect on success is thrown too
  }
}

export async function googleLoginAction() {
  await signIn("google", { redirectTo: "/" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// ---------------- children ----------------

export async function createChildAction(_: FormState, form: FormData): Promise<FormState> {
  const pid = await parentId();
  const name = str(form, "name");
  const birthYear = Number(str(form, "birthYear"));
  if (!name) return { error: "צריך שם" };
  if (!Number.isInteger(birthYear) || birthYear < 2005 || birthYear > new Date().getFullYear()) {
    return { error: "שנת לידה לא תקינה" };
  }
  const child = await db.child.create({
    data: {
      parentId: pid,
      name,
      birthYear,
      // Web MVP: the child watches only what the parent put on the home screen.
      ruleSet: { create: { listOnly: true } },
      videoLists: { create: { name: "הסרטונים שלי" } },
    },
  });
  redirect(`/children/${child.id}`);
}

export async function deleteChildAction(childId: string) {
  const pid = await parentId();
  await ownChild(pid, childId);
  await db.child.delete({ where: { id: childId } });
  redirect("/");
}

// ---------------- lists ----------------

export async function createListAction(childId: string, _: FormState, form: FormData): Promise<FormState> {
  const pid = await parentId();
  await ownChild(pid, childId);
  const name = str(form, "name");
  if (!name) return { error: "צריך שם לרשימה" };
  await db.videoList.create({ data: { childId, name } });
  revalidatePath(`/children/${childId}`);
  return { ok: "הרשימה נוספה" };
}

export async function toggleListAction(listId: string) {
  const pid = await parentId();
  const list = await ownList(pid, listId);
  await db.videoList.update({ where: { id: listId }, data: { isActive: !list.isActive } });
  revalidatePath(`/children/${list.childId}`);
}

export async function deleteListAction(listId: string) {
  const pid = await parentId();
  const list = await ownList(pid, listId);
  await db.videoList.delete({ where: { id: listId } });
  revalidatePath(`/children/${list.childId}`);
}

// ---------------- videos ----------------

export async function addVideoAction(listId: string, _: FormState, form: FormData): Promise<FormState> {
  const pid = await parentId();
  const list = await ownList(pid, listId);
  const videoId = parseVideoId(str(form, "video"));
  if (!videoId) return { error: "זה לא נראה כמו קישור לסרטון YouTube" };
  const exists = await db.videoListItem.findUnique({ where: { listId_videoId: { listId, videoId } } });
  if (exists) return { error: "הסרטון כבר ברשימה" };
  const added = await addVideosToList(listId, [videoId]);
  if (added === 0) return { error: "לא הצלחנו למצוא את הסרטון, או שאי אפשר לנגן אותו מחוץ ל-YouTube" };

  const customTitle = str(form, "title");
  if (customTitle) {
    await db.videoListItem.update({ where: { listId_videoId: { listId, videoId } }, data: { title: customTitle } });
  }
  revalidatePath(`/children/${list.childId}`);
  return { ok: "נוסף!" };
}

export async function removeVideoAction(listId: string, videoId: string) {
  const pid = await parentId();
  const list = await ownList(pid, listId);
  await db.videoListItem.deleteMany({ where: { listId, videoId } });
  revalidatePath(`/children/${list.childId}`);
}

/** Swaps a video with its neighbour. */
export async function moveVideoAction(listId: string, videoId: string, dir: -1 | 1) {
  const pid = await parentId();
  const list = await ownList(pid, listId);
  const items = await db.videoListItem.findMany({ where: { listId }, orderBy: { position: "asc" } });
  const i = items.findIndex((x) => x.videoId === videoId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  await db.$transaction(
    items.map((x, position) =>
      db.videoListItem.update({ where: { listId_videoId: { listId, videoId: x.videoId } }, data: { position } }),
    ),
  );
  revalidatePath(`/children/${list.childId}`);
}

// ---------------- kid screen pairing ----------------

export async function createPairingCodeAction(childId: string): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const pid = await parentId();
  await ownChild(pid, childId);
  await db.device.deleteMany({ where: { childId, pairedAt: null } });
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    try {
      await db.device.create({ data: { childId, pairingCode: code, pairingExpiresAt: expiresAt } });
      return { code, expiresAt: expiresAt.toISOString() };
    } catch {
      // code collision, try again
    }
  }
  return { error: "נסו שוב" };
}

export async function unpairDeviceAction(deviceId: string) {
  const pid = await parentId();
  const device = await db.device.findFirst({ where: { id: deviceId, child: { parentId: pid } } });
  if (!device) return;
  await db.device.delete({ where: { id: deviceId } });
  revalidatePath(`/children/${device.childId}`);
}
