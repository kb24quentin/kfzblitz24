import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "./db";
import { notifyAdmins } from "./notify";

const ALLOWED_DOMAIN = process.env.SSO_ALLOWED_DOMAIN?.trim() || "kfzblitz24.de";

const config: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_SSO_CLIENT_ID,
      clientSecret: process.env.GOOGLE_SSO_CLIENT_SECRET,
      authorization: {
        params: {
          hd: ALLOWED_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return false;
      const email = (user.email || "").toLowerCase();
      if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) return false;

      const googleId = (profile as { sub?: string } | undefined)?.sub || null;
      const displayName =
        (profile as { name?: string } | undefined)?.name || user.name || email.split("@")[0];
      const picture =
        (profile as { picture?: string } | undefined)?.picture || user.image || null;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        if (
          existing.googleId !== googleId ||
          existing.imageUrl !== picture ||
          !existing.name
        ) {
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              googleId: googleId ?? existing.googleId,
              imageUrl: picture ?? existing.imageUrl,
              name: existing.name || displayName,
            },
          });
        }
        if (!existing.active) return "/pending";
        return true;
      }

      // Auto-provision new workspace user as pending (inactive)
      await prisma.user.create({
        data: {
          email,
          name: displayName,
          googleId,
          imageUrl: picture,
          role: "user",
          active: false,
        },
      });

      // Notify admins
      notifyAdmins(
        `Neuer Intranet-Zugriff: ${displayName}`,
        `<p><strong>${displayName}</strong> (${email}) hat sich zum ersten Mal ins Intranet eingeloggt und wartet auf Freigabe.</p>
<p style="margin-top:20px;">
  <a href="https://kfzblitz24-group.com/settings" style="display:inline-block;background:#ff6600;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
    Zu den Einstellungen →
  </a>
</p>`
      ).catch(() => {});

      return "/pending";
    },
    async jwt({ token, user }) {
      const email = (user?.email || token.email) as string | undefined;
      if (email && (!token.role || user)) {
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (dbUser) {
          token.role = dbUser.role;
          token.userId = dbUser.id;
          token.picture = dbUser.imageUrl || token.picture;
          token.name = dbUser.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = token.role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.userId;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth(config);
