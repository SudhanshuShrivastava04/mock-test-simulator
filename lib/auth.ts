import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { ADMIN_EMAILS, DEV_LOGIN, GOOGLE_CONFIGURED } from "@/lib/env";
import { getStudent, isEmail, normEmail, saveStudent } from "@/lib/data";

/** Who may sign in: admins from ADMIN_EMAILS, students the admin has added. Everyone else is turned away. */
export async function roleFor(email: string | null | undefined) {
  if (!email) return null;
  const e = normEmail(email);
  if (ADMIN_EMAILS.includes(e)) return "admin" as const;
  return (await getStudent(e)) ? ("student" as const) : null;
}

const providers: NextAuthConfig["providers"] = [];
if (GOOGLE_CONFIGURED) providers.push(Google({ authorization: { params: { prompt: "select_account" } } }));
if (DEV_LOGIN) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: { label: "Email" } },
      authorize: async (c) => {
        const email = normEmail(String(c?.email || ""));
        if (!isEmail(email)) return null;
        return { id: email, email, name: email.split("@")[0] };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && profile?.email_verified === false) return "/login?error=Unverified";
      const email = normEmail(user.email || "");
      const role = await roleFor(email);
      if (!role) return "/login?error=NotInvited";
      if (role === "student") {
        const s = await getStudent(email);
        if (s) await saveStudent({ ...s, name: s.name || user.name || undefined, image: user.image || s.image, lastLoginAt: Date.now() });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = normEmail(user.email);
      return token;
    },
  },
});
