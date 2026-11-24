import { UpdateListInput } from "@kids/shared";
import { requireParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { ownList } from "@/lib/ownership";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownList(parentId, id);
  const input = await readJson(req, UpdateListInput);
  return Response.json(await db.videoList.update({ where: { id }, data: input }));
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownList(parentId, id);
  await db.videoList.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
