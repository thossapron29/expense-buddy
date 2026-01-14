# Telegram Expense Bot

Bot บันทึกค่าใช้จ่ายผ่าน Telegram แบบ bilingual (ไทย/อังกฤษ)

## Features

- 📝 บันทึกรายจ่ายแบบง่าย: `กาแฟ 85`, `อาหาร 120 ข้าวมันไก่`
- 🌏 รองรับภาษาไทยและอังกฤษ
- 📊 สรุปรายจ่ายรายวัน/สัปดาห์/เดือน
- 🏷️ 8 หมวดหมู่: อาหาร, เดินทาง, ช้อปปิ้ง, บิล, สุขภาพ, กาแฟ, บันเทิง, อื่นๆ

## Setup

1. Install dependencies:

```bash
npm install
```

2. Setup environment variables:

```bash
cp .env.example .env
# Edit .env with your BOT_TOKEN, DATABASE_URL, and WEBHOOK_URL
```

3. Run database migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

4. Start the bot:

```bash
npm start
```

## Environment Variables

- `BOT_TOKEN` - Telegram bot token from @BotFather
- `DATABASE_URL` - PostgreSQL connection string
- `WEBHOOK_URL` - Your app URL (e.g., https://your-app.onrender.com)
- `PORT` - Server port (auto-set by Render)

## Deployment on Render

1. Create a **Web Service** (not Background Worker)
2. Connect your GitHub repository
3. **Build Command:** `npm install && npx prisma generate`
4. **Start Command:** `npm start`
5. **Environment Variables:**
   - `BOT_TOKEN` - your bot token
   - `DATABASE_URL` - your Supabase/Postgres URL
   - `WEBHOOK_URL` - will be `https://YOUR_APP_NAME.onrender.com`

After deployment, the webhook will be set automatically!

## Commands

- `/start` - เริ่มใช้งาน
- `/help` - คู่มือการใช้งาน
- `/today` or `วันนี้` - สรุปวันนี้
- `/week` or `สัปดาห์นี้` - สรุปสัปดาห์นี้
- `/month` or `เดือนนี้` - สรุปเดือนนี้
- `/last` or `ล่าสุด` - รายการล่าสุด 5 รายการ
- `/undo` or `ยกเลิก` - ยกเลิกรายการล่าสุด

## Tech Stack

- Node.js + TypeScript
- Grammy (Telegram Bot Framework)
- Prisma + PostgreSQL
- date-fns
