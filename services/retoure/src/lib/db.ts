import { PrismaClient } from "@prisma/client";

/**
 * Prisma-Client als Singleton — sonst werden bei jedem Hot-Reload neue
 * Connections geöffnet bis Postgres mit "too many clients" abnickt.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
