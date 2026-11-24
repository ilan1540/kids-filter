import { RuleSetInput } from "@kids/shared";
import { requireParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { ownChild } from "@/lib/ownership";
import { push } from "@/lib/push";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownChild(parentId, id);
  const rules = await db.ruleSet.upsert({ where: { childId: id }, create: { childId: id }, update: {} });
  return Response.json(rules);
});

export const PUT = route(async (req, { params }: Ctx) => {
  const parentId = await requireParent();
  const { id } = await params;
  await ownChild(parentId, id);
  const input = await readJson(req, RuleSetInput);
  const rules = await db.ruleSet.upsert({ where: { childId: id }, create: { childId: id, ...input }, update: input });
  // Tell the child's devices to refresh the home screen (listOnly may have changed).
  const devices = await db.device.findMany({ where: { childId: id }, select: { fcmToken: true } });
  await push(devices.map((d) => d.fcmToken), { data: { type: "rules_updated" } });
  return Response.json(rules);
});
