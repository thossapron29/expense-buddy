import "dotenv/config";
import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { parseExpense } from "./src/parser.js";
import { getCategoryDisplay } from "./src/categories.js";
import { prisma, ensureUser } from "./src/db.js";
import { startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import type { Transaction } from "@prisma/client";
import express from "express";

const bot = new Bot(process.env.BOT_TOKEN!);

// Help message
const HELP_MESSAGE = `
🤖 **Expense Bot - คู่มือการใช้งาน**

📝 **เพิ่มรายการ:**
กาแฟ 85
อาหาร 120 ข้าวมันไก่
shopping 299 เสื้อ
85 (จะบันทึกเป็น Other)

📊 **คำสั่งสรุป:**
/today หรือ วันนี้ - สรุปวันนี้
/week หรือ สัปดาห์นี้ - สรุปสัปดาห์นี้
/month หรือ เดือนนี้ - สรุปเดือนนี้

📋 **ดูรายการ:**
/last หรือ ล่าสุด - รายการล่าสุด 5 รายการ
/undo หรือ ยกเลิก - ยกเลิกรายการล่าสุด

❓ /help - แสดงคู่มือนี้
`;

bot.command("start", async (ctx) => {
  await ensureUser(ctx.from!.id, ctx.from!.first_name, ctx.from!.username);
  await ctx.reply(
    'พร้อมแล้ว ✅ ส่งข้อความเช่น "กาแฟ 85" ได้เลย\n\nพิมพ์ /help เพื่อดูคู่มือ'
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(HELP_MESSAGE, { parse_mode: "Markdown" });
});

// Today summary
bot.command("today", async (ctx) => await handleSummary(ctx, "today"));
bot.hears(/^วันนี้$/i, async (ctx) => await handleSummary(ctx, "today"));

// Week summary
bot.command("week", async (ctx) => await handleSummary(ctx, "week"));
bot.hears(/^สัปดาห์นี้$/i, async (ctx) => await handleSummary(ctx, "week"));

// Month summary
bot.command("month", async (ctx) => await handleSummary(ctx, "month"));
bot.hears(/^เดือนนี้$/i, async (ctx) => await handleSummary(ctx, "month"));

// Last transactions
bot.command("last", async (ctx) => await handleLast(ctx));
bot.hears(/^ล่าสุด$/i, async (ctx) => await handleLast(ctx));

// Undo
bot.command("undo", async (ctx) => await handleUndo(ctx));
bot.hears(/^ยกเลิก$/i, async (ctx) => await handleUndo(ctx));

// Main message handler for expense entries
bot.on("message:text", async (ctx) => {
  const user = await ensureUser(
    ctx.from.id,
    ctx.from.first_name,
    ctx.from.username
  );

  const parsed = parseExpense(ctx.message.text);

  if (!parsed) {
    await ctx.reply('ไม่เข้าใจ 🤔 ลองพิมพ์ "กาแฟ 85" หรือ /help');
    return;
  }

  // Save to database
  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      amountCents: Math.round(parsed.amount * 100),
      category: parsed.category,
      description: parsed.description || null,
    },
  });

  const categoryDisplay = getCategoryDisplay(parsed.category);
  const date = new Date().toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const desc = parsed.description ? ` — ${parsed.description}` : "";
  const message = `บันทึกแล้ว ✅ ${categoryDisplay.en.toUpperCase()} ${
    parsed.amount
  }${desc} (${date})`;

  // Inline keyboard
  const keyboard = new InlineKeyboard()
    .text("วันนี้ / Today", "summary:today")
    .text("เดือนนี้ / Month", "summary:month")
    .row()
    .text("Undo", "undo");

  await ctx.reply(message, { reply_markup: keyboard });
});

// Handle callback queries
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data.startsWith("summary:")) {
    const period = data.split(":")[1] as "today" | "week" | "month";
    await handleSummary(ctx, period);
  } else if (data === "undo") {
    await handleUndo(ctx);
  }

  await ctx.answerCallbackQuery();
});

// Helper functions
async function handleSummary(ctx: any, period: "today" | "week" | "month") {
  const user = await ensureUser(
    ctx.from!.id,
    ctx.from!.first_name,
    ctx.from!.username
  );

  const now = new Date();
  let startDate: Date;
  let label: string;

  switch (period) {
    case "today":
      startDate = startOfDay(now);
      label = "วันนี้ / Today";
      break;
    case "week":
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      label = "สัปดาห์นี้ / This Week";
      break;
    case "month":
      startDate = startOfMonth(now);
      label = "เดือนนี้ / This Month";
      break;
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      occurredAt: {
        gte: startDate,
        lte: endOfDay(now),
      },
    },
    orderBy: { occurredAt: "desc" },
  });

  if (transactions.length === 0) {
    await ctx.reply(`📊 **${label}**\n\nยังไม่มีรายการ`, {
      parse_mode: "Markdown",
    });
    return;
  }

  const total =
    transactions.reduce(
      (sum: number, t: Transaction) => sum + t.amountCents,
      0
    ) / 100;

  // Group by category
  const byCategory: Record<string, number> = {};
  transactions.forEach((t: Transaction) => {
    byCategory[t.category] =
      (byCategory[t.category] || 0) + t.amountCents / 100;
  });

  // Sort by amount
  const sorted = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  let message = `📊 **${label}**\n\n💰 Total: **${total.toLocaleString()} THB**\n\n`;
  message += `**Top Categories:**\n`;

  sorted.forEach(([cat, amt]) => {
    const display = getCategoryDisplay(cat as any);
    message += `  • ${display.en}: ${amt.toLocaleString()} THB\n`;
  });

  message += `\n📝 ${transactions.length} รายการ`;

  await ctx.reply(message, { parse_mode: "Markdown" });
}

async function handleLast(ctx: any) {
  const user = await ensureUser(
    ctx.from!.id,
    ctx.from!.first_name,
    ctx.from!.username
  );

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { occurredAt: "desc" },
    take: 5,
  });

  if (transactions.length === 0) {
    await ctx.reply("ยังไม่มีรายการ");
    return;
  }

  let message = "📋 **รายการล่าสุด:**\n\n";

  transactions.forEach((t: Transaction, i: number) => {
    const display = getCategoryDisplay(t.category as any);
    const desc = t.description ? ` — ${t.description}` : "";
    const amt = t.amountCents / 100;
    const date = new Date(t.occurredAt).toLocaleDateString("th-TH", {
      month: "short",
      day: "numeric",
    });
    message += `${i + 1}. ${display.en} ${amt}${desc} (${date})\n`;
  });

  await ctx.reply(message, { parse_mode: "Markdown" });
}

async function handleUndo(ctx: any) {
  const user = await ensureUser(
    ctx.from!.id,
    ctx.from!.first_name,
    ctx.from!.username
  );

  const lastTransaction = await prisma.transaction.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!lastTransaction) {
    await ctx.reply("ไม่มีรายการให้ยกเลิก");
    return;
  }

  await prisma.transaction.delete({
    where: { id: lastTransaction.id },
  });

  const display = getCategoryDisplay(lastTransaction.category as any);
  const amt = lastTransaction.amountCents / 100;
  const desc = lastTransaction.description
    ? ` — ${lastTransaction.description}`
    : "";

  await ctx.reply(`ยกเลิกแล้ว ❌ ${display.en} ${amt}${desc}`);
}

// Webhook setup
const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

// Webhook endpoint
app.use(express.json());
app.use(`/${process.env.BOT_TOKEN}`, webhookCallback(bot, "express"));

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Auto-detect webhook URL from Render environment
  // RENDER_EXTERNAL_URL is automatically set by Render
  const webhookUrl = process.env.WEBHOOK_URL || 
                     (process.env.RENDER_EXTERNAL_URL 
                       ? `${process.env.RENDER_EXTERNAL_URL}/${process.env.BOT_TOKEN}`
                       : undefined);
  
  if (webhookUrl) {
    await bot.api.setWebhook(webhookUrl);
    console.log(`✅ Webhook set to: ${webhookUrl}`);
  } else {
    console.log('⚠️  No webhook URL set - running in polling mode for local dev');
  }
});
