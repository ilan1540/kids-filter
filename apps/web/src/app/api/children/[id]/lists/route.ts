import { CreateListInput, parsePlaylistId } from "@kids/shared";
import { requireParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { HttpError, readJson, route } from "@/lib/http";
import { addVideosToList } from "@/lib/lists";
import { ownChild } from "@/lib/ownership";
import { fetchPlaylistVideoIds } from "@/lib/youtube";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownChild(parentId, id);
  const lists = await db.videoList.findMany({
    where: { childId: id },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: { position: "asc" } } },
  });
  return Response.json(lists);
});

export const POST = route(async (req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownChild(parentId, id);
  const input = await readJson(req, CreateListInput);

  const playlistId = input.playlist ? parsePlaylistId(input.playlist) : null;
  if (input.playlist && !playlistId) throw new HttpError(400, "invalid_playlist");

  const list = await db.videoList.create({
    data: { childId: id, name: input.name, sourcePlaylistId: playlistId },
  });
  const imported = playlistId ? await addVideosToList(list.id, await fetchPlaylistVideoIds(playlistId)) : 0;
  return Response.json({ ...list, imported }, { status: 201 });
});
