import { db } from "@/lib/db";
import { push } from "@/lib/push";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Runs every 15 minutes (vercel.json):
 * - expires approval requests older than 24h
 * - deletes watch history older than 90 days (privacy)
 * - alerts the parent once when a paired device has been silent for over an hour
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const now = Date.now();
  const [expired, deleted] = await Promise.all([
    db.approvalRequest.updateMany({
      where: { status: "PENDING", createdAt: { lt: new Date(now - DAY) } },
      data: { status: "EXPIRED" },
    }),
    db.watchEvent.deleteMany({ where: { createdAt: { lt: new Date(now - 90 * DAY) } } }),
  ]);

  // Silent between 60 and 75 minutes: with a 15-minute cron, each silence alerts exactly once.
  const silent = await db.device.findMany({
    where: { pairedAt: { not: null }, lastSeenAt: { lt: new Date(now - HOUR), gte: new Date(now - HOUR - 15 * 60 * 1000) } },
    include: { child: { include: { parent: { select: { fcmTokens: true } } } } },
  });
  for (const d of silent) {
    await push(d.child.parent.fcmTokens, {
      title: `המכשיר של ${d.child.name} לא מדווח`,
      body: "ייתכן שהאפליקציה נסגרה, המכשיר כבוי או שיש ניסיון עקיפה.",
      data: { type: "device_silent", childId: d.childId, deviceId: d.id },
    });
  }
  return Response.json({ expired: expired.count, deleted: deleted.count, silentAlerts: silent.length });
}
