import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { logoutAction } from "../actions";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.parentId) redirect("/login");
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">🛡️ סינון תכנים לילדים</Link>
        <form action={logoutAction} className="row">
          <span className="muted small">{session.user?.email}</span>
          <button className="btn ghost sm">התנתקות</button>
        </form>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
