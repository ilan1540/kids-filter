import { PairInput } from "@kids/shared";
import { db } from "@/lib/db";
import { hashToken, newDeviceToken } from "@/lib/device-auth";
import { HttpError, readJson, route } from "@/lib/http";

/** Exchanges a pairing code for a long-lived device token. The token is returned once and only its hash is stored. */
export const POST = route(async (req) => {
  const { code, fcmToken } = await readJson(req, PairInput);
  const slot = await db.device.findUnique({ where: { pairingCode: code }, include: { child: true } });
  if (!slot || !slot.pairingExpiresAt || slot.pairingExpiresAt < new Date()) {
    throw new HttpError(400, "invalid_or_expired_code");
  }
  const deviceToken = newDeviceToken();
  await db.device.update({
    where: { id: slot.id },
    data: {
      pairingCode: null,
      pairingExpiresAt: null,
      deviceTokenHash: hashToken(deviceToken),
      fcmToken: fcmToken ?? null,
      pairedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });
  return Response.json({ deviceToken, child: { id: slot.child.id, name: slot.child.name } });
});
