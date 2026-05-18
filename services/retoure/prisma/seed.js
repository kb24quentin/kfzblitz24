const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  await seedAdminUser();
  await seedDefaultSuppliers();
}

async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";

  if (!email || !password) {
    console.log("[seed] ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("[seed] User already exists:", email);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "admin",
    },
  });
  console.log("[seed] Created admin user:", user.email);
}

/**
 * Legt die zwei realen Distributoren von kfzBlitz24 an, falls sie noch
 * nicht existieren. Idempotent — beim zweiten Run passiert nichts.
 *
 * Adress-/Kontakt-Daten lassen wir bewusst leer; Admin pflegt das im UI
 * unter /admin/suppliers nach. Wichtig hier nur: Name + active=true,
 * damit der PDA-Picker bei Container-Anlage die beiden auswählen kann.
 */
async function seedDefaultSuppliers() {
  const defaults = [
    {
      name: "Interparts",
      rmaPolicy:
        "Bitte Originalverpackung verwenden. Retourenschein per Mail anhängen.",
    },
    {
      name: "Autopartner",
      rmaPolicy:
        "Retourenschein dem Paket beilegen. Kontaktperson vor Versand abklären.",
    },
  ];

  for (const s of defaults) {
    const existing = await prisma.supplier.findUnique({ where: { name: s.name } });
    if (existing) {
      console.log(`[seed] Supplier already exists: ${s.name}`);
      continue;
    }
    await prisma.supplier.create({
      data: {
        name: s.name,
        rmaPolicy: s.rmaPolicy,
        active: true,
      },
    });
    console.log(`[seed] Created supplier: ${s.name}`);
  }
}

main()
  .catch((e) => {
    console.error("[seed] error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
