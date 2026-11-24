import { auth, signIn, signOut } from "@/lib/auth";

// Placeholder: the parents' dashboard UI comes next. The API is ready under /api.
export default async function Home() {
  const session = await auth();
  return (
    <main>
      <h1>דשבורד הורים</h1>
      {session?.user ? (
        <form action={async () => { "use server"; await signOut(); }}>
          <p>מחובר/ת בתור {session.user.email}</p>
          <button type="submit">התנתקות</button>
        </form>
      ) : (
        <form action={async () => { "use server"; await signIn("google"); }}>
          <button type="submit">התחברות עם Google</button>
        </form>
      )}
    </main>
  );
}
