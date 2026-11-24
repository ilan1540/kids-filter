import Link from "next/link";
import { parentIdOrLogin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AddChildForm } from "./forms";

export default async function Dashboard() {
  const parentId = await parentIdOrLogin();
  const children = await db.child.findMany({
    where: { parentId: parentId },
    orderBy: { createdAt: "asc" },
    include: { videoLists: { include: { _count: { select: { items: true } } } } },
  });

  return (
    <div className="stack">
      <h1>הילדים שלי</h1>
      {children.length === 0 && (
        <p className="muted">עוד אין ילדים. הוסיפו ילד/ה, ואז הדביקו קישורים לסרטוני YouTube שיופיעו כ"כפתורים" במסך שלו/ה.</p>
      )}
      <div className="grid-cards">
        {children.map((c) => {
          const videos = c.videoLists.reduce((n, l) => n + l._count.items, 0);
          return (
            <Link key={c.id} href={`/children/${c.id}`} className="card" style={{ color: "inherit" }}>
              <h2>{c.name}</h2>
              <p className="muted small">
                {videos} סרטונים · {c.videoLists.length} רשימות
              </p>
            </Link>
          );
        })}
      </div>
      <div className="card">
        <h2>הוספת ילד/ה</h2>
        <AddChildForm />
      </div>
    </div>
  );
}
