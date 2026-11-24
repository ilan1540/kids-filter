import { DecideRequestInput } from "@kids/shared";
import { requireParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { addVideosToList } from "@/lib/lists";
import { ownList, ownRequest } from "@/lib/ownership";
import { push } from "@/lib/push";

type Ctx = { params: Promise<{ id: string }> };

/** Parent approves or denies. The answer is stored as a VideoOverride so the same video isn't asked about again. */
export const PATCH = route(async (req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  const request = await ownRequest(parentId, id);
  if (request.status !== "PENDING") throw new HttpError(409, "already_decided");
  const input = await readJson(req, DecideRequestInput);
  const approved = input.status === "APPROVED";

  if (input.addToListId) {
    const list = await ownList(parentId, input.addToListId);
    if (list.childId !== request.childId) throw new HttpError(400, "list_of_other_child");
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.videoOverride.upsert({
      where: { childId_videoId: { childId: request.childId, videoId: request.videoId } },
      create: { childId: request.childId, videoId: request.videoId, allowed: approved },
      update: { allowed: approved },
    });
    if (approved && input.alwaysAllowChannel) {
      const rules = await tx.ruleSet.upsert({
        where: { childId: request.childId },
        create: { childId: request.childId },
        update: {},
      });
      await tx.ruleSet.update({
        where: { childId: request.childId },
        data: {
          allowedChannels: [...new Set([...rules.allowedChannels, request.channelId])],
          blockedChannels: rules.blockedChannels.filter((c) => c !== request.channelId),
        },
      });
    }
    return tx.approvalRequest.update({ where: { id }, data: { status: input.status, decidedAt: new Date() } });
  });

  if (approved && input.addToListId) await addVideosToList(input.addToListId, [request.videoId]);

  const devices = await db.device.findMany({ where: { childId: request.childId }, select: { fcmToken: true } });
  await push(devices.map((d) => d.fcmToken), {
    title: approved ? "אושר! 🎉" : "ההורה לא אישר הפעם",
    body: request.title,
    data: { type: "request_decided", requestId: id, videoId: request.videoId, status: input.status },
  });
  return Response.json(updated);
});
