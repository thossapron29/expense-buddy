import "dotenv/config";
import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { parseExpense } from "./src/parser.js";
import { getCategoryDisplay } from "./src/categories.js";
import { prisma, ensureUser } from "./src/db.js";
import { startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import type { Transaction } from "@prisma/client";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bot = new Bot(process.env.BOT_TOKEN!);

// Global bot error handler to avoid crashing the process on unhandled bot errors
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Middleware to log incoming updates and handler outcomes
bot.use(async (ctx, next) => {
  try {
    const uid = ctx.update?.update_id ?? 'unknown';
    const from = ctx.from ? `${ctx.from.id} ${ctx.from.first_name}` : 'unknown';
    const text = (ctx.message && 'text' in ctx.message) ? ctx.message.text : undefined;
    console.log(`[Bot] Incoming update id=${uid} from=${from} text=${text}`);
    await next();
    console.log(`[Bot] Finished handling update id=${uid}`);
  } catch (err) {
    console.error('[Bot] Error in middleware while handling update:', err);
    throw err;
  }
});

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

📊 /dashboard - เปิด Dashboard แสดงกราฟและสรุปรายจ่าย

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

// Dashboard command
bot.command("dashboard", async (ctx) => {
  const webhookUrl = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL;
  
  if (webhookUrl) {
    // Production: send web app button (Telegram Mini App)
    const dashboardUrl = `${webhookUrl.replace(/\/$/, '')}/dashboard`;
    const keyboard = new InlineKeyboard().webApp("📊 Open Dashboard", dashboardUrl);
    await ctx.reply(
      "📊 **Dashboard**\n\nดูกราฟและสรุปรายจ่ายของคุณ:\n\nคลิกปุ่มด้านล่างเพื่อเปิด Dashboard",
      { reply_markup: keyboard, parse_mode: "Markdown" }
    );
  } else {
    // Local dev: send localhost link
    await ctx.reply(
      "📊 **Dashboard (Local Dev)**\n\nเปิด Dashboard ที่:\nhttp://localhost:3000/dashboard\n\n(ใช้งานได้เฉพาะบนเครื่อง local)"
    );
  }
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

// Serve static files (dashboard)
app.use(express.static("public"));

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Bot is running! Visit /dashboard for the dashboard.");
});

// Dashboard route
app.get("/dashboard", (req, res) => {
  res.sendFile(__dirname + "/public/dashboard.html");
});

// API: Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        username: true,
        telegramUserId: true,
      },
      orderBy: { createdAt: "desc" },
    });
    // Convert BigInt to string for JSON serialization
    const serializedUsers = users.map(u => ({
      ...u,
      telegramUserId: u.telegramUserId.toString(),
    }));
    res.json(serializedUsers);
  } catch (error) {
    console.error("[API] Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// API: Get user by Telegram ID
app.get("/api/user-by-telegram/:telegramId", async (req, res) => {
  try {
    const telegramId = BigInt(req.params.telegramId);
    const user = await prisma.user.findUnique({
      where: { telegramUserId: telegramId },
      select: {
        id: true,
        firstName: true,
        username: true,
        telegramUserId: true,
      },
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({
      ...user,
      telegramUserId: user.telegramUserId.toString(),
    });
  } catch (error) {
    console.error("[API] Error fetching user by Telegram ID:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// API: Get summary for a user
app.get("/api/summary/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const period = req.query.period as string || "today";
    
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case "today":
        startDate = startOfDay(now);
        break;
      case "week":
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case "month":
        startDate = startOfMonth(now);
        break;
      default:
        startDate = startOfDay(now);
    }
    
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        occurredAt: {
          gte: startDate,
          lte: endOfDay(now),
        },
      },
      orderBy: { occurredAt: "desc" },
    });
    
    const total = transactions.reduce((sum, t) => sum + t.amountCents / 100, 0);
    const average = transactions.length > 0 ? total / transactions.length : 0;
    
    // Group by category
    const categoryMap: Record<string, number> = {};
    transactions.forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amountCents / 100;
    });
    
    const categories = Object.entries(categoryMap)
      .map(([category, amount]) => {
        const display = getCategoryDisplay(category as any);
        return {
          name: display.en,
          emoji: display.en.split(" ")[0], // Extract emoji
          amount: Math.round(amount * 100) / 100,
        };
      })
      .sort((a, b) => b.amount - a.amount);
    
    const topCategory = categories[0] || null;
    
    // Format transactions
    const formattedTransactions = transactions.slice(0, 10).map((t) => {
      const display = getCategoryDisplay(t.category as any);
      return {
        category: display.en.replace(/^\S+\s/, ""), // Remove emoji
        categoryEmoji: display.en.split(" ")[0],
        amount: Math.round(t.amountCents / 100 * 100) / 100,
        description: t.description,
        date: new Date(t.occurredAt).toLocaleString("th-TH", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    });
    
    res.json({
      total: Math.round(total * 100) / 100,
      average: Math.round(average * 100) / 100,
      transactionCount: transactions.length,
      topCategory,
      categories,
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error("[API] Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// Webhook endpoint
app.use(express.json());

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Attempt to connect to the database and log status
  try {
    await prisma.$connect();
    console.log('✅ Connected to database');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  }

  // Auto-detect webhook URL from Render environment
  // RENDER_EXTERNAL_URL is automatically set by Render
  const webhookUrl = process.env.WEBHOOK_URL || 
                     (process.env.RENDER_EXTERNAL_URL 
                       ? `${process.env.RENDER_EXTERNAL_URL}/${process.env.BOT_TOKEN}`
                       : undefined);
  
  if (webhookUrl) {
    // Register webhook route to receive updates from Telegram
    app.use(`/${process.env.BOT_TOKEN}`, webhookCallback(bot, "express"));

    await bot.api.setWebhook(webhookUrl);
    console.log(`✅ Webhook set to: ${webhookUrl}`);
  } else {
    console.log('⚠️  No webhook URL set - running in polling mode for local dev');
    await bot.start();
    console.log('✅ Bot started in polling mode (getUpdates)');
  }
});
