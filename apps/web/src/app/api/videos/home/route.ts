import { db } from "@/lib/db";
import { authDevice } from "@/lib/device-auth";
import { route } from "@/lib/http";

/** Home screen: videos from the child's active lists, and whether search is shown. */
export const GET = route(async (req) => {
  const device = await authDevice(req);
  const listOnly = device.child.ruleSet?.listOnly ?? false;
  const lists = await db.videoList.findMany({
    where: { childId: device.childId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      items: { orderBy: { position: "asc" }, select: { videoId: true, title: true, thumbnail: true, position: true } },
    },
  });
  return Response.json({
    child: { id: device.child.id, name: device.child.name },
    listOnly,
    searchEnabled: !listOnly,
    lists,
  });
});
