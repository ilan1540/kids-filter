import { authDevice } from "@/lib/device-auth";
import { checkVideo } from "@/lib/check";
import { HttpError, route } from "@/lib/http";
import { fetchVideosMeta, searchVideoIds } from "@/lib/youtube";

/** Search YouTube and return only results the rules allow. 100 quota units per call. */
export const GET = route(async (req) => {
  const device = await authDevice(req);
  if (device.child.ruleSet?.listOnly) throw new HttpError(403, "search_disabled");
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length > 100) throw new HttpError(400, "invalid_query");

  const metas = await fetchVideosMeta(await searchVideoIds(q));
  const decisions = await Promise.all(metas.map((m) => checkVideo(device.child, m)));
  const results = metas
    .filter((_, i) => decisions[i].result === "ALLOWED")
    .map((m) => ({ videoId: m.videoId, title: m.title, channelTitle: m.channelTitle, thumbnail: m.thumbnail }));
  return Response.json({ q, results, hidden: metas.length - results.length });
});
