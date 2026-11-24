import { z } from "zod";
import { requireParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";

const Input = z.object({ token: z.string().min(10) });

/** The dashboard PWA registers the parent's phone for push. Keeps the 5 most recent tokens. */
export const POST = route(async (req) => {
  const parentId = await requireParent();
  const { token } = await readJson(req, Input);
  const parent = await db.parent.findUniqueOrThrow({ where: { id: parentId }, select: { fcmTokens: true } });
  const fcmTokens = [token, ...parent.fcmTokens.filter((t) => t !== token)].slice(0, 5);
  await db.parent.update({ where: { id: parentId }, data: { fcmTokens } });
  return new Response(null, { status: 204 });
});
