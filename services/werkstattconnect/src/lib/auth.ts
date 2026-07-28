import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const ALLOWED_DOMAIN = process.env.SSO_ALLOWED_DOMAIN?.trim() || "kfzblitz24.de";

/**
 * Dual-auth: KB24-Admins loggen via Google-SSO (@kfzblitz24.de), Werkstatt-
 * Mitarbeiter via email+passwort (beliebige domäne).
 *
 * Session-shape:
 *   audience: "kb_admin" | "workshop"
 *   userId:   KbAdmin.id | WorkshopUser.id
 *   workshopId: null | WorkshopUser.workshopId  (row-level-isolation key)
 *
 * Middleware routet /admin → kb_admin required, alles andere → workshop.
 */
const config: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_SSO_CLIENT_ID,
      clientSecret: process.env.GOOGLE_SSO_CLIENT_SECRET,
      authorization: {
        params: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
      },
    }),
    Credentials({
      name: "Werkstatt-Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).trim().toLowerCase();
        const user = await prisma.workshopUser.findUnique({ where: { email } });
        if (!user || !user.active) return null;
        const ok = await bcrypt.compare(credentials.password as string, user.password);
        if (!ok) return null;
        // Custom shape so jwt-callback erkennt es als workshop-user.
        // Cast to any weil NextAuth-User-type unsere zusatzfelder nicht kennt.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          audience: "workshop",
          workshopId: user.workshopId,
          role: user.role,
        } as unknown as { id: string; email: string; name: string };
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Credentials path already validated in authorize()
      if (account?.provider !== "google") return true;

      const email = (user.email || "").toLowerCase();
      if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) return false;

      const googleId = (profile as { sub?: string } | undefined)?.sub || null;
      const displayName =
        (profile as { name?: string } | undefined)?.name || user.name || email.split("@")[0];
      const picture =
        (profile as { picture?: string } | undefined)?.picture || user.image || null;

      const existing = await prisma.kbAdmin.findUnique({ where: { email } });
      if (existing) {
        if (
          existing.googleId !== googleId ||
          existing.imageUrl !== picture ||
          !existing.name
        ) {
          await prisma.kbAdmin.update({
            where: { id: existing.id },
            data: {
              googleId: googleId ?? existing.googleId,
              imageUrl: picture ?? existing.imageUrl,
              name: existing.name || displayName,
            },
          });
        }
        if (!existing.active) return "/admin/pending";
        return true;
      }
      // Auto-provision new KB24-admin as inactive → sichtbarer admin muss aktivieren
      await prisma.kbAdmin.create({
        data: { email, name: displayName, googleId, imageUrl: picture, active: false },
      });
      return "/admin/pending";
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id?: string;
          email?: string | null;
          audience?: "workshop" | "kb_admin";
          workshopId?: string | null;
          role?: string;
        };
        if (u.id) token.userId = u.id;
        if (u.audience) {
          token.audience = u.audience;
          token.workshopId = u.workshopId ?? null;
          token.role = u.role ?? null;
        } else {
          // Google-branch — kb_admin
          token.audience = "kb_admin";
          token.workshopId = null;
          if (u.email) {
            const admin = await prisma.kbAdmin.findUnique({
              where: { email: u.email.toLowerCase() },
              select: { id: true },
            });
            if (admin) token.userId = admin.id;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as {
          id?: string;
          audience?: string;
          workshopId?: string | null;
          role?: string | null;
        };
        u.id = token.userId as string;
        u.audience = token.audience as string;
        u.workshopId = (token.workshopId as string | null) ?? null;
        u.role = (token.role as string | null) ?? null;
      }
      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(config);
