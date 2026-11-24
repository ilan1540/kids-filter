import { redirect } from "next/navigation";
import { auth, googleEnabled } from "@/lib/auth";
import { googleLoginAction } from "../actions";
import { LoginForms } from "./forms";

export default async function LoginPage() {
  const session = await auth();
  if (session?.parentId) redirect("/");
  return (
    <main className="container" style={{ maxWidth: 440 }}>
      <div className="stack" style={{ marginTop: "8vh" }}>
        <div>
          <h1>סינון תכנים לילדים</h1>
          <p className="muted">אתם בוחרים את הסרטונים, הילדים צופים רק בהם.</p>
        </div>
        <LoginForms />
        {googleEnabled && (
          <form action={googleLoginAction}>
            <button className="btn ghost" style={{ width: "100%" }}>התחברות עם Google</button>
          </form>
        )}
        <p className="muted small" style={{ textAlign: "center" }}>
          ילד/ה? <a href="/kid">למסך הצפייה</a>
        </p>
      </div>
    </main>
  );
}
