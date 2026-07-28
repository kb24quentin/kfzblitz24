/**
 * Seed KB24-admins. Trägt user aus ADMIN_EMAILS (comma-separated) als aktive
 * KB24-Admin ein — sonst müssen sie sich einmal via Google einloggen und ein
 * bestehender admin muss aktivieren.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) {
    console.log("[seed] no ADMIN_EMAILS set, skipping");
    return;
  }
  for (const email of emails) {
    const existing = await prisma.kbAdmin.findUnique({ where: { email } });
    if (existing) {
      console.log(`[seed] KbAdmin exists: ${email}`);
      continue;
    }
    await prisma.kbAdmin.create({
      data: {
        email,
        name: email.split("@")[0],
        active: true,
      },
    });
    console.log(`[seed] KbAdmin created: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
