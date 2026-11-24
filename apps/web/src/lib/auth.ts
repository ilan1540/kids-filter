import { redirect } from "next/navigation";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { db } from "./db";
import { unauthorized } from "./http";
import { verifyPassword } from "./password";

const Login = z.object({ email: z.email().transform((e) => e.toLowerCase()), password: z.string().min(1) });

export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// JWT sessions, no adapter: the Parent row is the account.
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = Login.safeParse(raw);
        if (!parsed.success) return null;
        const parent = await db.parent.findUnique({ where: { email: parsed.data.email } });
        if (!parent || !(await verifyPassword(parsed.data.password, parent.passwordHash))) return null;
        return { id: parent.id, email: parent.email, name: parent.name };
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider === "google") {
        await db.parent.upsert({
          where: { email: user.email.toLowerCase() },
          create: { email: user.email.toLowerCase(), name: user.name },
          update: {},
        });
      }
      return true;
    },
    async jwt({ token }) {
      if (token.email && !token.parentId) {
        const parent = await db.parent.findUnique({ where: { email: token.email.toLowerCase() } });
        token.parentId = parent?.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.parentId) session.parentId = token.parentId as string;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    parentId?: string;
  }
}

/** The signed-in parent's id, or 401. */
export async function requireParent(): Promise<string> {
  const session = await auth();
  if (!session?.parentId) throw unauthorized();
  return session.parentId;
}

/** For pages: the signed-in parent's id, or a redirect to /login. */
export async function parentIdOrLogin(): Promise<string> {
  const session = await auth();
  if (!session?.parentId) redirect("/login");
  return session.parentId;
}
