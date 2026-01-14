import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

export async function ensureUser(
  telegramUserId: number,
  firstName: string,
  username?: string
) {
  return await prisma.user.upsert({
    where: { telegramUserId: BigInt(telegramUserId) },
    update: {
      firstName,
      username: username || null,
    },
    create: {
      telegramUserId: BigInt(telegramUserId),
      firstName,
      username: username || null,
    },
  });
}
