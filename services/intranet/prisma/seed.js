const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME || "Admin";

  if (!email) {
    console.log("[seed] ADMIN_EMAIL not set, skipping");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Ensure admin stays admin + active even if intranet was reset
    if (existing.role !== "admin" || !existing.active) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "admin", active: true },
      });
      console.log("[seed] Promoted existing user to admin + active:", email);
    } else {
      console.log("[seed] Admin already exists:", email);
    }
    return;
  }

  const user = await prisma.user.create({
    data: { email, name, role: "admin", active: true },
  });
  console.log("[seed] Created admin user:", user.email);
}

main()
  .catch((e) => {
    console.error("[seed] error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
