import { requireParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { newPairingCode } from "@/lib/device-auth";
import { route } from "@/lib/http";
import { ownChild } from "@/lib/ownership";

type Ctx = { params: Promise<{ id: string }> };

const TTL_MS = 10 * 60 * 1000;

/** Creates an unpaired device slot with a 6-digit code valid for 10 minutes. */
export const POST = route(async (_req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownChild(parentId, id);

  // Drop this child's stale unpaired slots.
  await db.device.deleteMany({ where: { childId: id, pairedAt: null } });

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPairingCode();
    const expiresAt = new Date(Date.now() + TTL_MS);
    try {
      await db.device.create({ data: { childId: id, pairingCode: code, pairingExpiresAt: expiresAt } });
      // The QR encodes the same code; the kids app can scan or type it.
      return Response.json({ code, expiresAt, qr: `kidsfilter://pair?code=${code}` }, { status: 201 });
    } catch {
      // unique collision on pairingCode: try another
    }
  }
  return Response.json({ error: "try_again" }, { status: 503 });
});
