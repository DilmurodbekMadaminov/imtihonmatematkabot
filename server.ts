import express from "express";
import { createServer as createViteServer } from "vite";
import { Telegraf, Markup } from "telegraf";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { variants } from "./src/questions.js";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase configuration
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
let db: any = null;

try {
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log("Firebase initialized successfully.");
  } else {
    console.warn("firebase-applet-config.json not found. Firebase will not be used.");
  }
} catch (e) {
  console.error("Error initializing Firebase:", e);
}

interface UserData {
  timestamp: number;
  firstName?: string;
  lastName?: string;
  username?: string;
}

// Fallback in-memory map if Firebase fails
let userActivity = new Map<number, UserData>();

async function trackUser(user: { id: number; first_name?: string; last_name?: string; username?: string }) {
  const data: UserData = {
    timestamp: Date.now(),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username
  };
  
  userActivity.set(user.id, data);

  if (db) {
    try {
      await setDoc(doc(db, 'users', user.id.toString()), data, { merge: true });
    } catch (e) {
      console.error('Error saving user to Firestore:', e);
    }
  }
}

async function getMonthlyUsersCount() {
  if (db) {
    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const q = query(collection(db, 'users'), where('timestamp', '>=', thirtyDaysAgo));
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (e) {
      console.error('Error getting monthly users from Firestore:', e);
    }
  }
  
  // Fallback
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const data of userActivity.values()) {
    if (data.timestamp >= thirtyDaysAgo) count++;
  }
  return count;
}

async function getTotalUsersCount() {
  if (db) {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.size;
    } catch (e) {
      console.error('Error getting total users from Firestore:', e);
    }
  }
  return userActivity.size;
}

async function getAllUsers() {
  if (db) {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs.map(doc => ({
        id: Number(doc.id),
        ...doc.data()
      })).sort((a: any, b: any) => b.timestamp - a.timestamp);
    } catch (e) {
      console.error('Error getting all users from Firestore:', e);
    }
  }
  return Array.from(userActivity.entries()).map(([id, data]) => ({
    id,
    ...data
  })).sort((a, b) => b.timestamp - a.timestamp);
}

interface UserSession {
  variantIndex: number;
  currentQuestion: number;
  answers: number[];
}

const sessions = new Map<number, UserSession>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/admin/stats', async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    
    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json({ 
      usersCount: await getTotalUsersCount(),
      monthlyUsers: await getMonthlyUsersCount()
    });
  });

  app.get('/api/admin/users', async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    
    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const usersList = await getAllUsers();
    res.json(usersList);
  });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  let botStatus = "not_configured";
  let bot: Telegraf | null = null;

  if (botToken) {
    try {
      bot = new Telegraf(botToken);
      
      bot.use((ctx, next) => {
        if (ctx.from) {
          trackUser(ctx.from);
        }
        return next();
      });

      bot.command('statistika', (ctx) => {
        const total = userActivity.size;
        const monthly = getMonthlyUsersCount();
        ctx.reply(`📊 Statistika:\n\n👥 Jami foydalanuvchilar: ${total}\n📅 Oylik faol foydalanuvchilar: ${monthly}`);
      });

      const CHANNEL_USERNAME = '@dilmurodbekmatematika';

      const checkSubscription = async (ctx: any): Promise<boolean> => {
        try {
          const userId = ctx.from?.id;
          if (!userId) return false;
          const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, userId);
          return ['creator', 'administrator', 'member', 'restricted'].includes(member.status);
        } catch (error) {
          console.error("Error checking subscription:", error);
          return false;
        }
      };

      const sendSubscriptionPrompt = async (ctx: any) => {
        const text = "Testlarni ishlash uchun avval quyidagi kanalga obuna bo'ling:";
        const buttons = [
          [Markup.button.url("📢 Kanalga obuna bo'lish", "https://t.me/dilmurodbekmatematika")],
          [Markup.button.callback("✅ Obunani tekshirish", "check_sub")]
        ];
        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, Markup.inlineKeyboard(buttons)).catch(console.error);
        } else {
          await ctx.reply(text, Markup.inlineKeyboard(buttons)).catch(console.error);
        }
      };

      bot.start(async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const buttons = variants.map((_, i) => 
          [Markup.button.callback(`Variant ${i + 1} (10 ta savol)`, `start_variant_${i}`)]
        );
        ctx.reply(
          "Salom! Men Matematika testini o'tkazuvchi botman.\n\nQaysi variantni ishlashni xohlaysiz?",
          Markup.inlineKeyboard(buttons)
        );
      });

      const sendQuestion = async (ctx: any, chatId: number) => {
        const session = sessions.get(chatId);
        if (!session) return;
        
        const currentVariant = variants[session.variantIndex];
        const q = currentVariant[session.currentQuestion];
        const text = `Variant ${session.variantIndex + 1}\n\nSavol ${session.currentQuestion + 1} / ${currentVariant.length}\n\n${q.text}`;
        
        const buttons = q.options.map((opt, idx) => {
          return [Markup.button.callback(`${String.fromCharCode(65 + idx)}) ${opt}`, `ans_${idx}`)];
        });

        if (ctx.callbackQuery) {
          try {
            await ctx.deleteMessage();
          } catch (e) {}
        }

        if (q.imageUrl) {
          await ctx.replyWithPhoto(q.imageUrl, {
            caption: text,
            reply_markup: Markup.inlineKeyboard(buttons).reply_markup
          }).catch(console.error);
        } else {
          await ctx.reply(text, Markup.inlineKeyboard(buttons)).catch(console.error);
        }
      };

      bot.command('test', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const buttons = variants.map((_, i) => 
          [Markup.button.callback(`Variant ${i + 1} (10 ta savol)`, `start_variant_${i}`)]
        );
        ctx.reply(
          "Qaysi variantni ishlashni xohlaysiz?",
          Markup.inlineKeyboard(buttons)
        );
      });

      bot.action('check_sub', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (isSubscribed) {
          await ctx.deleteMessage().catch(() => {});
          const buttons = variants.map((_, i) => 
            [Markup.button.callback(`Variant ${i + 1} (10 ta savol)`, `start_variant_${i}`)]
          );
          ctx.reply(
            "Rahmat! Obuna tasdiqlandi.\n\nQaysi variantni ishlashni xohlaysiz?",
            Markup.inlineKeyboard(buttons)
          );
        } else {
          ctx.answerCbQuery("Siz hali kanalga obuna bo'lmagansiz!", { show_alert: true });
        }
      });

      bot.action(/start_variant_(\d+)/, async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const chatId = ctx.chat?.id;
        if (!chatId) return;
        const variantIndex = parseInt(ctx.match[1]);
        sessions.set(chatId, { variantIndex, currentQuestion: 0, answers: [] });
        await sendQuestion(ctx, chatId);
      });

      bot.action(/ans_(\d+)/, async (ctx) => {
        const chatId = ctx.chat?.id;
        if (!chatId) return;
        
        const session = sessions.get(chatId);
        if (!session) {
          return ctx.reply("Test sessiyasi topilmadi. Iltimos, /test orqali qaytadan boshlang.");
        }

        const answerIdx = parseInt(ctx.match[1]);
        session.answers.push(answerIdx);
        session.currentQuestion++;

        if (session.currentQuestion < variants[session.variantIndex].length) {
          await sendQuestion(ctx, chatId);
        } else {
          const currentVariant = variants[session.variantIndex];
          const isCorrect = session.answers.map((ans, i) => ans === currentVariant[i].correct);
          const rawScore = isCorrect.filter(Boolean).length;
          const percentage = Math.round((rawScore / currentVariant.length) * 100);

          let resultText = `🎉 Variant ${session.variantIndex + 1} yakunlandi!\n\n`;
          resultText += `📊 To'g'ri javoblar: ${rawScore} / ${currentVariant.length}\n`;
          resultText += `🎯 Natija: ${percentage}%\n\n`;
          
          resultText += `📝 Savollar tahlili:\n`;
          isCorrect.forEach((correct, i) => {
            resultText += `${i + 1}-savol: ${correct ? "✅ To'g'ri" : "❌ Noto'g'ri"}\n`;
          });

          const buttons = variants.map((_, i) => 
            [Markup.button.callback(`Variant ${i + 1}`, `start_variant_${i}`)]
          );

          if (ctx.callbackQuery) {
            await ctx.editMessageText(resultText, Markup.inlineKeyboard(buttons)).catch(console.error);
          } else {
            await ctx.reply(resultText, Markup.inlineKeyboard(buttons)).catch(console.error);
          }
          
          sessions.delete(chatId);
        }
      });

      // Webhooklar AI Studio muhitida proxy sababli ishlamaydi (302 Cookie check).
      // Shuning uchun faqat Polling dan foydalanamiz.
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      bot.launch({ dropPendingUpdates: true });
      console.log("Telegram bot launched in Polling mode.");
      
      // Enable graceful stop
      process.once('SIGINT', () => bot?.stop('SIGINT'));
      process.once('SIGTERM', () => bot?.stop('SIGTERM'));

      botStatus = "running";
    } catch (error) {
      console.error("Failed to launch Telegram bot:", error);
      botStatus = "error";
    }
  } else {
    console.log("TELEGRAM_BOT_TOKEN is not set. Bot is not running.");
  }

  app.get("/api/status", (req, res) => {
    res.json({ status: botStatus, hasToken: !!botToken });
  });

  app.get("/api/webhook-info", async (req, res) => {
    if (bot) {
      try {
        const info = await bot.telegram.getWebhookInfo();
        res.json(info);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    } else {
      res.status(404).json({ error: "Bot not initialized" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  process.once('SIGINT', () => bot?.stop('SIGINT'));
  process.once('SIGTERM', () => bot?.stop('SIGTERM'));
}

startServer();
