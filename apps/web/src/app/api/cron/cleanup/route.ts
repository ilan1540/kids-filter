import { db } from "@/lib/db";
import { push } from "@/lib/push";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Runs once a day at 03:00 UTC (vercel.json; Vercel Hobby allows only daily crons):
 * - expires approval requests older than 24h
 * - deletes watch history older than 90 days (privacy)
 * - alerts the parent once when a paired device has been silent for over a day
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

  // Silent between 24 and 48 hours: with a daily cron, each silence alerts exactly once.
  const silent = await db.device.findMany({
    where: { pairedAt: { not: null }, lastSeenAt: { lt: new Date(now - DAY), gte: new Date(now - 2 * DAY) } },
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
