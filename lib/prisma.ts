import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

console.log("current env ", process.env.ENVIRONMENT)
function createPrismaClient() {
  const adapter = new PrismaPg(
    process.env.ENVIRONMENT === "PROD"
      ? process.env.DATABASE_URL!
      : process.env.DATABASE_URL_DEV!,
  );
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
