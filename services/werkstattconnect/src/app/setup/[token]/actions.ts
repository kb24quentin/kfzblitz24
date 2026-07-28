"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function completeSetupAction(
  token: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!token) return { ok: false, error: "Token fehlt" };
  if (password.length < 8) return { ok: false, error: "Passwort zu kurz" };

  const user = await prisma.workshopUser.findUnique({ where: { passwordSetupToken: token } });
  if (!user) return { ok: false, error: "Link ungültig" };
  if (!user.active) return { ok: false, error: "Zugang deaktiviert" };
  if (!user.passwordSetupExpires || user.passwordSetupExpires.getTime() < Date.now()) {
    return { ok: false, error: "Link abgelaufen" };
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.workshopUser.update({
    where: { id: user.id },
    data: {
      password: hash,
      passwordSetupToken: null,
      passwordSetupExpires: null,
    },
  });
  return { ok: true };
}
