import { db } from "./db";
import { fetchVideosMeta } from "./youtube";

/** Appends videos to the end of a list, skipping ones already in it. Returns how many were added. */
export async function addVideosToList(listId: string, videoIds: string[]): Promise<number> {
  const existing = await db.videoListItem.findMany({ where: { listId }, select: { videoId: true, position: true } });
  const have = new Set(existing.map((e) => e.videoId));
  const fresh = [...new Set(videoIds)].filter((id) => !have.has(id));
  if (fresh.length === 0) return 0;

  const metas = await fetchVideosMeta(fresh);
  let position = existing.reduce((max, e) => Math.max(max, e.position), -1);
  const rows = metas
    .filter((m) => m.embeddable)
    .map((m) => ({ listId, videoId: m.videoId, title: m.title, thumbnail: m.thumbnail, position: ++position }));
  if (rows.length === 0) return 0;
  const { count } = await db.videoListItem.createMany({ data: rows, skipDuplicates: true });
  return count;
}
