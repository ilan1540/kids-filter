import { AddListItemInput, parseVideoId, ReorderListInput } from "@kids/shared";
import { requireParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { addVideosToList } from "@/lib/lists";
import { ownList } from "@/lib/ownership";

type Ctx = { params: Promise<{ id: string }> };

/** Add a video by URL or id. */
export const POST = route(async (req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownList(parentId, id);
  const { video } = await readJson(req, AddListItemInput);
  const videoId = parseVideoId(video);
  if (!videoId) throw new HttpError(400, "invalid_video");
  const added = await addVideosToList(id, [videoId]);
  if (added === 0) {
    const exists = await db.videoListItem.findUnique({ where: { listId_videoId: { listId: id, videoId } } });
    if (!exists) throw new HttpError(422, "video_not_found_or_not_embeddable");
  }
  return Response.json({ videoId, added }, { status: added ? 201 : 200 });
});

/** Reorder: body lists the video ids in their new order. */
export const PATCH = route(async (req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownList(parentId, id);
  const { videoIds } = await readJson(req, ReorderListInput);
  await db.$transaction(
    videoIds.map((videoId, position) =>
      db.videoListItem.updateMany({ where: { listId: id, videoId }, data: { position } }),
    ),
  );
  return new Response(null, { status: 204 });
});

/** Remove: DELETE /api/lists/:id/items?videoId=... */
export const DELETE = route(async (req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownList(parentId, id);
  const videoId = new URL(req.url).searchParams.get("videoId");
  if (!videoId) throw new HttpError(400, "missing_videoId");
  await db.videoListItem.deleteMany({ where: { listId: id, videoId } });
  return new Response(null, { status: 204 });
});
