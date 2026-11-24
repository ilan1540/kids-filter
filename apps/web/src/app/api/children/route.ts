import { CreateChildInput } from "@kids/shared";
import { requireParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";

export const GET = route(async () => {
  const parentId = await requireParent();
  const children = await db.child.findMany({
    where: { parentId },
    orderBy: { createdAt: "asc" },
    include: {
      devices: { where: { pairedAt: { not: null } }, select: { id: true, lastSeenAt: true, isDeviceOwner: true } },
      _count: { select: { requests: { where: { status: "PENDING" } } } },
    },
  });
  return Response.json(children);
});

export const POST = route(async (req) => {
  const parentId = await requireParent();
  const input = await readJson(req, CreateChildInput);
  // Every child starts with the default (conservative) rules.
  const child = await db.child.create({
    data: { ...input, parentId, ruleSet: { create: {} } },
    include: { ruleSet: true },
  });
  return Response.json(child, { status: 201 });
});
