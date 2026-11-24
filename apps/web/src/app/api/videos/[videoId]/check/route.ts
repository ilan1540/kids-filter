import { REASON_HE } from "@kids/shared";
import { checkVideo } from "@/lib/check";
import { db } from "@/lib/db";
import { authDevice } from "@/lib/device-auth";
import { notFound, route } from "@/lib/http";
import { fetchVideoMeta } from "@/lib/youtube";

type Ctx = { params: Promise<{ videoId: string }> };

/** The decision before playback. The kids app must call this before loading any video. */
export const GET = route(async (req, { params }: Ctx) => {
  const { videoId } = await params;
  const device = await authDevice(req);
  const meta = await fetchVideoMeta(videoId);
  if (!meta) throw notFound();

  const decision = await checkVideo(device.child, meta);
  await db.watchEvent.create({
    data: { childId: device.childId, kind: "CHECK", videoId, decision: decision.result, reason: decision.reason },
  });
  return Response.json({
    ...decision,
    reasonText: REASON_HE[decision.reason],
    canRequest: decision.result === "NEEDS_APPROVAL",
    video: { videoId, title: meta.title, channelTitle: meta.channelTitle, thumbnail: meta.thumbnail },
  });
});
