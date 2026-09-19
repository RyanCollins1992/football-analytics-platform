import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 requires an explicit driver adapter — there's no implicit
 * "read DATABASE_URL and connect" behavior on the client itself anymore.
 * Singleton pattern to avoid exhausting Neon's connection pool across
 * Next.js dev-server hot reloads (each reload would otherwise construct a
 * brand new PrismaClient without closing the old one).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
