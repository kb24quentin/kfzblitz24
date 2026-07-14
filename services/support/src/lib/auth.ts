import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const ALLOWED_DOMAIN = process.env.SSO_ALLOWED_DOMAIN?.trim() || "kfzblitz24.de";

const config: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_SSO_CLIENT_ID,
      clientSecret: process.env.GOOGLE_SSO_CLIENT_SECRET,
      // `hd` = hosted-domain hint biases Google's account picker to the
      // workspace domain. Real enforcement is in the signIn callback below.
      authorization: {
        params: {
          hd: ALLOWED_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
    Credentials({
      name: "Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || !user.active || !user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email };
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
      // Credentials path is already validated in authorize()
      if (account?.provider !== "google") return true;

      const email = (user.email || "").toLowerCase();
      if (!email) return false;

      // Enforce Workspace domain — the `hd` OAuth param is a hint only, this is the fence.
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return false;
      }

      const googleId = (profile as { sub?: string } | undefined)?.sub || null;
      const displayName =
        (profile as { name?: string } | undefined)?.name || user.name || email.split("@")[0];
      const picture =
        (profile as { picture?: string } | undefined)?.picture || user.image || null;

      const existing = await prisma.user.findUnique({ where: { email } });

      if (existing) {
        // Keep google-metadata up to date even for inactive users so admin
        // sees the current name/photo in the team-management view.
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

      // Auto-provision new Workspace user with role=agent but INACTIVE —
      // an admin must explicitly grant access via team-management. Prevents
      // any new @kfzblitz24.de account from silently gaining full access.
      await prisma.user.create({
        data: {
          email,
          name: displayName,
          googleId,
          imageUrl: picture,
          role: "agent",
          active: false,
        },
      });
      return "/pending";
    },
    async jwt({ token, user }) {
      // Load fresh role/id from DB on sign-in
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
