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
  console.log(`[DB] ensureUser called - telegramUserId=${telegramUserId}, firstName=${firstName}, username=${username}`);
  try {
    const result = await prisma.user.upsert({
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
    console.log(`[DB] ensureUser success - userId=${result.id}`);
    return result;
  } catch (err) {
    console.error('[DB] ensureUser error:', err);
    throw err;
  }
}
