import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "./db";
import { unauthorized } from "./http";

// JWT sessions, no adapter: the Parent row is created on first sign-in.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      await db.parent.upsert({
        where: { email: user.email },
        create: { email: user.email, name: user.name },
        update: {},
      });
      return true;
    },
    async jwt({ token }) {
      if (token.email && !token.parentId) {
        const parent = await db.parent.findUnique({ where: { email: token.email } });
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
