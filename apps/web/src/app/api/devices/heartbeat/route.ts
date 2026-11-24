import { z } from "zod";
import { db } from "@/lib/db";
import { authDevice } from "@/lib/device-auth";
import { readJson, route } from "@/lib/http";

const Input = z.object({ isDeviceOwner: z.boolean().optional(), fcmToken: z.string().optional() });

/** Called every 15 minutes. authDevice() already updates lastSeenAt; the cron alerts on silence. */
export const POST = route(async (req) => {
  const device = await authDevice(req);
  const input = await readJson(req, Input);
  if (input.isDeviceOwner !== undefined || input.fcmToken) {
    await db.device.update({ where: { id: device.id }, data: input });
  }
  return Response.json({ ok: true, rulesUpdatedAt: device.child.ruleSet?.updatedAt ?? null });
});
