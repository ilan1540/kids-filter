import { db } from "./db";
import { notFound } from "./http";

/** Loads a child only if it belongs to the parent; 404 otherwise (no existence leak). */
export async function ownChild(parentId: string, childId: string) {
  const child = await db.child.findFirst({ where: { id: childId, parentId } });
  if (!child) throw notFound();
  return child;
}

export async function ownList(parentId: string, listId: string) {
  const list = await db.videoList.findFirst({ where: { id: listId, child: { parentId } } });
  if (!list) throw notFound();
  return list;
}

export async function ownRequest(parentId: string, requestId: string) {
  const request = await db.approvalRequest.findFirst({ where: { id: requestId, child: { parentId } } });
  if (!request) throw notFound();
  return request;
}
