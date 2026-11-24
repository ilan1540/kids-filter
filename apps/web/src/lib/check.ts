import type { Decision } from "@kids/shared";
import { getOrClassify } from "./classify";
import { db } from "./db";
import { DEFAULT_RULES, decide, type Rules } from "./decide";
import type { FullVideoMeta } from "./youtube";

export function rulesOf(ruleSet: Rules | null | undefined): Rules {
  return ruleSet ?? DEFAULT_RULES;
}

/** Runs the rules engine for one child and one video, loading override and list membership. */
export async function checkVideo(
  child: { id: string; ruleSet: Rules | null },
  meta: FullVideoMeta,
): Promise<Decision> {
  const [override, listItem] = await Promise.all([
    db.videoOverride.findUnique({ where: { childId_videoId: { childId: child.id, videoId: meta.videoId } } }),
    db.videoListItem.findFirst({
      where: { videoId: meta.videoId, list: { childId: child.id, isActive: true } },
      select: { listId: true },
    }),
  ]);
  return decide(
    { rules: rulesOf(child.ruleSet), meta, override, inActiveList: !!listItem },
    () => getOrClassify(meta),
  );
}
