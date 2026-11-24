import { createHash, randomBytes, randomInt } from "node:crypto";
import { db } from "./db";
import { unauthorized } from "./http";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newDeviceToken = () => randomBytes(32).toString("base64url");
export const newPairingCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Identifies the child's device from `Authorization: Bearer <deviceToken>` and updates lastSeenAt. */
export async function authDevice(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw unauthorized();
  const device = await db.device.update({
    where: { deviceTokenHash: hashToken(token) },
    data: { lastSeenAt: new Date() },
    include: { child: { include: { ruleSet: true } } },
  }).catch(() => null);
  if (!device) throw unauthorized();
  return device;
}
