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
  testsTaken?: number;
  averageScore?: number;
}

// Fallback in-memory map if Firebase fails
let userActivity = new Map<number, UserData>();

async function trackUser(user: { id: number; first_name?: string; last_name?: string; username?: string }) {
  const existing = userActivity.get(user.id) || {} as Partial<UserData>;
  const data: UserData = {
    ...existing,
    timestamp: Date.now(),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    testsTaken: existing.testsTaken || 0,
    averageScore: existing.averageScore || 0
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

async function trackTestResult(userId: number, percentage: number) {
  const existing = userActivity.get(userId);
  if (!existing) return;

  const testsTaken = (existing.testsTaken || 0) + 1;
  const currentTotalScore = (existing.averageScore || 0) * (existing.testsTaken || 0);
  const averageScore = Math.round((currentTotalScore + percentage) / testsTaken);

  const data: UserData = {
    ...existing,
    testsTaken,
    averageScore
  };

  userActivity.set(userId, data);

  if (db) {
    try {
      await setDoc(doc(db, 'users', userId.toString()), { testsTaken, averageScore }, { merge: true });
    } catch (e) {
      console.error('Error saving test result to Firestore:', e);
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
    const adminPassword = process.env.ADMIN_PASSWORD || '1';
    
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
    const adminPassword = process.env.ADMIN_PASSWORD || '1';
    
    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const usersList = await getAllUsers();
    res.json(usersList);
  });

  app.post('/api/admin/broadcast', async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || '1';
    
    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { message } = req.body;
    if (!message || !bot) {
      return res.status(400).json({ error: 'Message or bot not available' });
    }

    const usersList = await getAllUsers();
    let successCount = 0;
    let failCount = 0;

    // Send messages in background to avoid blocking the request
    res.json({ status: 'started', totalUsers: usersList.length });

    for (const user of usersList) {
      try {
        await bot.telegram.sendMessage(user.id, message);
        successCount++;
      } catch (e) {
        failCount++;
      }
      // Add a small delay to avoid hitting Telegram API rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log(`Broadcast finished. Success: ${successCount}, Failed: ${failCount}`);
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

      const adminChatIds = new Set<number>();

      bot.command('admin', async (ctx) => {
        const adminPassword = process.env.ADMIN_PASSWORD || '1';
        const args = ctx.message.text.split(' ');
        
        const appUrl = process.env.VITE_APP_URL || 'https://ais-dev-zwxesqr7uajqrp3m5f64nl-286796810075.asia-east1.run.app';
        const adminKeyboard = Markup.inlineKeyboard([
          [Markup.button.webApp("🌐 Web Admin Panelni ochish", `${appUrl}/admin`)]
        ]);
        
        if (args.length > 1 && args[1] === adminPassword) {
          adminChatIds.add(ctx.from.id);
          ctx.reply('✅ Admin panelga xush kelibsiz! Quyidagi buyruqlardan foydalanishingiz yoki Web panelni ochishingiz mumkin:\n\n/stats - Statistika\n/users - Foydalanuvchilar ro\'yxati\n/broadcast <xabar> - Barchaga xabar yuborish', adminKeyboard);
        } else if (adminChatIds.has(ctx.from.id)) {
          ctx.reply('✅ Siz admin panelidasiz. Quyidagi buyruqlardan foydalanishingiz yoki Web panelni ochishingiz mumkin:\n\n/stats - Statistika\n/users - Foydalanuvchilar ro\'yxati\n/broadcast <xabar> - Barchaga xabar yuborish', adminKeyboard);
        } else {
          ctx.reply('Admin panelga kirish uchun parolni kiriting: /admin <parol>');
        }
      });

      bot.command('stats', async (ctx) => {
        if (!adminChatIds.has(ctx.from.id)) return;
        const total = await getTotalUsersCount();
        const monthly = await getMonthlyUsersCount();
        ctx.reply(`📊 Statistika:\n\n👥 Jami foydalanuvchilar: ${total}\n📅 Oylik faol foydalanuvchilar: ${monthly}`);
      });

      bot.command('users', async (ctx) => {
        if (!adminChatIds.has(ctx.from.id)) return;
        const usersList = await getAllUsers();
        const topUsers = usersList.slice(0, 15);
        let msg = `👥 Oxirgi 15 ta foydalanuvchi (Jami: ${usersList.length}):\n\n`;
        topUsers.forEach((u, i) => {
          msg += `${i+1}. ${u.firstName || ''} ${u.lastName || ''} ${u.username ? '(@' + u.username + ')' : ''} - ${u.testsTaken || 0} test, ${u.averageScore || 0}%\n`;
        });
        ctx.reply(msg);
      });

      bot.command('broadcast', async (ctx) => {
        if (!adminChatIds.has(ctx.from.id)) return;
        const message = ctx.message.text.replace('/broadcast', '').trim();
        if (!message) {
          return ctx.reply('Xabar matnini kiriting: /broadcast <xabar>');
        }
        
        const usersList = await getAllUsers();
        ctx.reply(`Xabar yuborish boshlandi (${usersList.length} ta foydalanuvchiga)...`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const user of usersList) {
          try {
            await bot!.telegram.sendMessage(user.id, message);
            successCount++;
          } catch (e) {
            failCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        ctx.reply(`✅ Xabar yuborish yakunlandi.\n\nYetkazildi: ${successCount}\nXatolik: ${failCount}`);
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

        const buttons = variants.map((v, i) => 
          [Markup.button.callback(v.title, `start_variant_${i}`)]
        );
        ctx.reply(
          "Salom! Men Matematika testini o'tkazuvchi botman.\n\nQaysi variantni ishlashni xohlaysiz?",
          Markup.inlineKeyboard(buttons)
        );
      });

      const sendQuestion = async (ctx: any, chatId: number) => {
        const session = sessions.get(chatId);
        if (!session) return;
        
        const currentVariant = variants[session.variantIndex].questions;
        const q = currentVariant[session.currentQuestion];
        const text = `${variants[session.variantIndex].title}\n\nSavol ${session.currentQuestion + 1} / ${currentVariant.length}\n\n${q.text}`;
        
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

        const buttons = variants.map((v, i) => 
          [Markup.button.callback(v.title, `start_variant_${i}`)]
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
          const buttons = variants.map((v, i) => 
            [Markup.button.callback(v.title, `start_variant_${i}`)]
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

        if (session.currentQuestion < variants[session.variantIndex].questions.length) {
          await sendQuestion(ctx, chatId);
        } else {
          const currentVariant = variants[session.variantIndex].questions;
          const isCorrect = session.answers.map((ans, i) => ans === currentVariant[i].correct);
          const rawScore = isCorrect.filter(Boolean).length;
          const percentage = Math.round((rawScore / currentVariant.length) * 100);

          await trackTestResult(chatId, percentage);

          let resultText = `🎉 ${variants[session.variantIndex].title} yakunlandi!\n\n`;
          resultText += `📊 To'g'ri javoblar: ${rawScore} / ${currentVariant.length}\n`;
          resultText += `🎯 Natija: ${percentage}%\n\n`;
          
          resultText += `📝 Savollar tahlili:\n`;
          isCorrect.forEach((correct, i) => {
            resultText += `${i + 1}-savol: ${correct ? "✅ To'g'ri" : "❌ Noto'g'ri"}\n`;
          });

          const buttons = variants.map((v, i) => 
            [Markup.button.callback(v.title, `start_variant_${i}`)]
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
      const launchBot = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            await bot!.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot!.launch({ dropPendingUpdates: true });
            console.log("Telegram bot launched in Polling mode.");
            botStatus = "running";
            return;
          } catch (error: any) {
            if (error?.response?.error_code === 409) {
              console.warn(`Conflict error (409) - another instance is running. (${i + 1}/${retries})`);
              if (i === retries - 1) {
                console.warn("Bot is already running on another server (e.g., Render). Stopping local polling attempts to prevent conflicts.");
                botStatus = "running_elsewhere";
                return; // Xatoni throw qilmasdan to'xtatamiz
              }
              await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
              throw error;
            }
          }
        }
      };

      launchBot().catch(error => {
        console.error("Failed to launch Telegram bot:", error);
        botStatus = "error";
      });
      
      // Enable graceful stop
      process.once('SIGINT', () => bot?.stop('SIGINT'));
      process.once('SIGTERM', () => bot?.stop('SIGTERM'));
    } catch (error) {
      console.error("Error setting up Telegram bot:", error);
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
