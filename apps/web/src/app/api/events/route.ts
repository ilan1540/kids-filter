import { EventsInput } from "@kids/shared";
import { db } from "@/lib/db";
import { authDevice } from "@/lib/device-auth";
import { readJson, route } from "@/lib/http";
import { push } from "@/lib/push";

/** Batched reports from the device: watch time and bypass attempts. */
export const POST = route(async (req) => {
  const device = await authDevice(req);
  const { events } = await readJson(req, EventsInput);
  await db.watchEvent.createMany({
    data: events.map((e) => ({
      childId: device.childId,
      kind: e.type === "watch" ? ("WATCH" as const) : ("BYPASS_ATTEMPT" as const),
      videoId: e.videoId,
      seconds: e.seconds ?? 0,
      reason: e.detail,
    })),
  });

  const bypass = events.filter((e) => e.type === "bypass_attempt");
  if (bypass.length > 0) {
    const parent = await db.parent.findUnique({ where: { id: device.child.parentId }, select: { fcmTokens: true } });
    await push(parent?.fcmTokens ?? [], {
      title: `ניסיון עקיפה במכשיר של ${device.child.name}`,
      body: bypass[0].detail ?? "",
      data: { type: "bypass_attempt", childId: device.childId },
    });
  }
  return Response.json({ received: events.length });
});
