import { CreateRequestInput, REASON_HE } from "@kids/shared";
import { requireParent } from "@/lib/auth";
import { checkVideo } from "@/lib/check";
import { db } from "@/lib/db";
import { authDevice } from "@/lib/device-auth";
import { HttpError, notFound, readJson, route } from "@/lib/http";
import { push } from "@/lib/push";
import { fetchVideoMeta } from "@/lib/youtube";

/** Parent: the approval queue. ?status=PENDING (default) | APPROVED | DENIED | EXPIRED */
export const GET = route(async (req) => {
  const parentId = await requireParent();
  const status = (new URL(req.url).searchParams.get("status") ?? "PENDING") as "PENDING";
  const requests = await db.approvalRequest.findMany({
    where: { status, child: { parentId } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { child: { select: { id: true, name: true } } },
  });
  return Response.json(requests.map((r) => ({ ...r, reasonText: REASON_HE[r.reason as keyof typeof REASON_HE] })));
});

/** Child device: ask the parent to approve a video. */
export const POST = route(async (req) => {
  const device = await authDevice(req);
  const { videoId } = await readJson(req, CreateRequestInput);
  const meta = await fetchVideoMeta(videoId);
  if (!meta) throw notFound();

  // Re-check on the server: nothing to ask if it's allowed, and no re-asking after the parent said no.
  const decision = await checkVideo(device.child, meta);
  if (decision.result === "ALLOWED") throw new HttpError(409, "already_allowed");
  if (decision.reason === "override_blocked" || decision.reason === "not_embeddable") {
    throw new HttpError(403, "not_requestable");
  }

  const pending = await db.approvalRequest.findFirst({
    where: { childId: device.childId, videoId, status: "PENDING" },
  });
  if (pending) return Response.json(pending);

  const request = await db.approvalRequest.create({
    data: {
      childId: device.childId,
      videoId,
      title: meta.title,
      channelId: meta.channelId,
      thumbnail: meta.thumbnail,
      reason: decision.reason,
    },
  });

  const parent = await db.parent.findUnique({ where: { id: device.child.parentId }, select: { fcmTokens: true } });
  await push(parent?.fcmTokens ?? [], {
    title: `${device.child.name} מבקש/ת לצפות`,
    body: `${meta.title} · ${REASON_HE[decision.reason]}`,
    data: { type: "approval_request", requestId: request.id },
  });
  return Response.json(request, { status: 201 });
});
