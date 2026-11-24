import { notFound } from "next/navigation";
import { parentIdOrLogin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteListAction, moveVideoAction, removeVideoAction, toggleListAction, unpairDeviceAction } from "../../../actions";
import { AddListForm, AddVideoForm, ConfirmButton, PairPanel } from "./forms";

type Props = { params: Promise<{ id: string }> };

export default async function ChildPage({ params }: Props) {
  const { id } = await params;
  const parentId = await parentIdOrLogin();
  const child = await db.child.findFirst({
    where: { id, parentId: parentId },
    include: {
      videoLists: { orderBy: { createdAt: "asc" }, include: { items: { orderBy: { position: "asc" } } } },
      devices: { where: { pairedAt: { not: null } }, orderBy: { pairedAt: "desc" } },
    },
  });
  if (!child) notFound();

  return (
    <div className="stack">
      <div className="row spread">
        <h1>{child.name}</h1>
        <ConfirmButton action={`deleteChild:${child.id}`} label="מחיקת ילד/ה" confirm={`למחוק את ${child.name} וכל הרשימות?`} />
      </div>

      <PairPanel childId={child.id} childName={child.name} />

      {child.devices.length > 0 && (
        <div className="card">
          <h2>מכשירים מחוברים</h2>
          <div className="stack small">
            {child.devices.map((d) => (
              <div key={d.id} className="row spread">
                <span>מחובר מ-{d.pairedAt!.toLocaleDateString("he-IL")} · נראה לאחרונה {d.lastSeenAt?.toLocaleString("he-IL") ?? "-"}</span>
                <form action={unpairDeviceAction.bind(null, d.id)}>
                  <button className="btn danger sm">ניתוק</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {child.videoLists.map((list) => (
        <section key={list.id} className="card stack">
          <div className="row spread">
            <div className="row">
              <h2 style={{ margin: 0 }}>{list.name}</h2>
              <span className="badge">{list.isActive ? "מוצג לילד" : "מוסתר"}</span>
            </div>
            <div className="row">
              <form action={toggleListAction.bind(null, list.id)}>
                <button className="btn ghost sm">{list.isActive ? "הסתרה" : "הצגה"}</button>
              </form>
              <form action={deleteListAction.bind(null, list.id)}>
                <button className="btn danger sm">מחיקת רשימה</button>
              </form>
            </div>
          </div>

          <AddVideoForm listId={list.id} />

          {list.items.length === 0 ? (
            <p className="muted small">אין עדיין סרטונים. הדביקו קישור מ-YouTube למעלה.</p>
          ) : (
            <div className="tiles">
              {list.items.map((item, i) => (
                <div key={item.videoId} className="tile">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumbnail ?? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`} alt="" loading="lazy" />
                  <div className="meta">
                    <div className="title">{item.title}</div>
                    <div className="actions">
                      <div className="row" style={{ gap: 0 }}>
                        <form action={moveVideoAction.bind(null, list.id, item.videoId, -1)}>
                          <button className="icon-btn" disabled={i === 0} aria-label="הזזה קדימה">→</button>
                        </form>
                        <form action={moveVideoAction.bind(null, list.id, item.videoId, 1)}>
                          <button className="icon-btn" disabled={i === list.items.length - 1} aria-label="הזזה אחורה">←</button>
                        </form>
                        <a className="icon-btn" href={`https://www.youtube.com/watch?v=${item.videoId}`} target="_blank" rel="noreferrer" aria-label="צפייה ב-YouTube">▶</a>
                      </div>
                      <form action={removeVideoAction.bind(null, list.id, item.videoId)}>
                        <button className="icon-btn" aria-label="הסרה">✕</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <div className="card">
        <h2>רשימה חדשה</h2>
        <p className="muted small">למשל "לפני השינה" או "אנגלית". כל רשימה מופיעה כקבוצת כפתורים במסך של הילד.</p>
        <AddListForm childId={child.id} />
      </div>
    </div>
  );
}
