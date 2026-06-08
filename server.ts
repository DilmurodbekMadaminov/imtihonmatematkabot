import express from "express";
import { createServer as createViteServer } from "vite";
import { Telegraf, Markup } from "telegraf";
import path from "path";
import fs from "fs";
import { variants } from "./src/questions.js";
import { mathSections } from "./src/mathSections.js";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
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
  isAdmin?: boolean;
}

// Global settings stored persistently
let globalSettings = {
  channelUsername: '@dilmurodbekmatematika',
  channels: ['@dilmurodbekmatematika', '@DilnuraMadaminova']
};

async function loadSettings() {
  if (db) {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'config'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        if (data) {
          if (data.channelUsername) {
            globalSettings.channelUsername = data.channelUsername;
          }
          let channelsList: string[] = [];
          if (Array.isArray(data.channels)) {
            channelsList = data.channels;
          } else if (data.channelUsername) {
            channelsList = [data.channelUsername];
          } else {
            channelsList = ['@dilmurodbekmatematika', '@DilnuraMadaminova'];
          }

          // Force-add @DilnuraMadaminova if missing, per user instruction
          const targetChannel = '@DilnuraMadaminova';
          if (!channelsList.some(ch => ch.toLowerCase() === targetChannel.toLowerCase())) {
            channelsList.push(targetChannel);
            await saveSettings(channelsList);
          }

          globalSettings.channels = channelsList;
          console.log("Global settings loaded from Firebase:", globalSettings);
        }
      } else {
        await setDoc(doc(db, 'settings', 'config'), globalSettings);
        console.log("Default settings stored to Firebase.");
      }
    } catch (e) {
      console.error("Error loading settings from Firestore:", e);
    }
  }
}

async function saveSettings(channels: string[]) {
  globalSettings.channels = channels;
  if (channels.length > 0) {
    globalSettings.channelUsername = channels[0];
  }
  if (db) {
    try {
      await setDoc(doc(db, 'settings', 'config'), { 
        channels, 
        channelUsername: channels.length > 0 ? channels[0] : '' 
      }, { merge: true });
    } catch (e) {
      console.error("Error saving settings to Firestore:", e);
    }
  }
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
    averageScore: existing.averageScore || 0,
    isAdmin: existing.isAdmin || false
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

async function checkIfAdmin(userId: number): Promise<boolean> {
  const localUser = userActivity.get(userId);
  if (localUser && localUser.isAdmin) return true;
  
  if (db) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId.toString()));
      if (userDoc.exists()) {
        const uData = userDoc.data();
        if (uData?.isAdmin) {
          if (localUser) {
            localUser.isAdmin = true;
          } else {
            userActivity.set(userId, {
              timestamp: uData.timestamp || Date.now(),
              firstName: uData.firstName,
              lastName: uData.lastName,
              username: uData.username,
              testsTaken: uData.testsTaken || 0,
              averageScore: uData.averageScore || 0,
              isAdmin: true
            });
          }
          return true;
        }
      }
    } catch (e) {
      console.error('Error checking admin status in Firestore:', e);
    }
  }
  return false;
}

async function setAdminStatus(userId: number, isAdmin: boolean) {
  const localUser = userActivity.get(userId) || { timestamp: Date.now() } as UserData;
  localUser.isAdmin = isAdmin;
  userActivity.set(userId, localUser);

  if (db) {
    try {
      await setDoc(doc(db, 'users', userId.toString()), { isAdmin }, { merge: true });
    } catch (e) {
      console.error('Error saving admin status to Firestore:', e);
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
  type: 'majburiy' | 'matematika';
  variantIndex?: number;
  sectionId?: string;
  sectionVariantIndex?: number;
  currentQuestion: number;
  answers: number[];
}

const sessions = new Map<number, UserSession>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load configuration and prime the local cache on startup
  await loadSettings();
  if (db) {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as UserData;
        userActivity.set(Number(docSnap.id), data);
      });
      console.log(`Successfully primed cache with ${userActivity.size} users.`);
    } catch (e) {
      console.error("Error priming users cache on startup:", e);
    }
  }

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

      const getAdminKeyboard = () => {
        return Markup.inlineKeyboard([
          [Markup.button.callback("📊 Statistika", "admin_stats"), Markup.button.callback("👥 Foydalanuvchilar", "admin_users")],
          [Markup.button.callback("📢 E'lon yuborish", "admin_broadcast"), Markup.button.callback("⚙️ Kanalni sozlash", "admin_channel")],
          [Markup.button.callback("❓ Yordam", "admin_help"), Markup.button.callback("🚪 Chiqish", "admin_logout")]
        ]);
      };

      interface AdminSession {
        action: 'waiting_for_broadcast' | 'waiting_for_channel';
      }
      const adminSessions = new Map<number, AdminSession>();

      bot.command('admin', async (ctx) => {
        const adminPassword = process.env.ADMIN_PASSWORD || '1';
        const args = ctx.message.text.split(' ');
        const userId = ctx.from.id;

        const isUserAdmin = await checkIfAdmin(userId);

        if (args.length > 1 && args[1] === adminPassword) {
          await setAdminStatus(userId, true);
          return ctx.reply('✅ Admin panelga muvaffaqiyatli kirdingiz! Sizga admin huquqi doimiy berildi.\n\nQuyidagi tugmalardan foydalanib panelni boshqarishingiz mumkin:', getAdminKeyboard());
        } else if (isUserAdmin) {
          const total = await getTotalUsersCount();
          const monthly = await getMonthlyUsersCount();
          const channelsList = (globalSettings.channels && globalSettings.channels.length > 0)
            ? globalSettings.channels.join(', ')
            : globalSettings.channelUsername;
          return ctx.reply(`🛠 Admin Boshqaruv Paneli:\n\n📢 Majburiy obuna kanallari: ${channelsList}\n👥 Jami foydalanuvchilar: ${total}\n📅 Oylik faol: ${monthly}\n\nQuyidagi tugmalar yordamida botni boshqaring:`, getAdminKeyboard());
        } else {
          return ctx.reply('Sizda admin huquqlari yo\'q. Admin panelga kirish uchun parolni kiriting: \n`/admin <parol>`', { parse_mode: 'Markdown' });
        }
      });

      bot.command('stats', async (ctx) => {
        if (!(await checkIfAdmin(ctx.from.id))) return;
        const total = await getTotalUsersCount();
        const monthly = await getMonthlyUsersCount();
        ctx.reply(`📊 Statistika:\n\n👥 Jami foydalanuvchilar: ${total}\n📅 Oylik faol foydalanuvchilar: ${monthly}`);
      });

      bot.command('users', async (ctx) => {
        if (!(await checkIfAdmin(ctx.from.id))) return;
        const usersList = await getAllUsers();
        const topUsers = usersList.slice(0, 15);
        let msg = `👥 Oxirgi 15 ta foydalanuvchi (Jami: ${usersList.length}):\n\n`;
        topUsers.forEach((user: any, i: number) => {
          msg += `${i+1}. ${user.firstName || ''} ${user.lastName || ''} ${user.username ? '(@' + user.username + ')' : ''} - ${user.testsTaken || 0} test, ${user.averageScore || 0}%\n`;
        });
        ctx.reply(msg);
      });

      bot.command('broadcast', async (ctx) => {
        if (!(await checkIfAdmin(ctx.from.id))) return;
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

      bot.action('admin_stats', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId || !(await checkIfAdmin(userId))) {
          return ctx.answerCbQuery("Ruxsat berilmadi!", { show_alert: true });
        }
        const total = await getTotalUsersCount();
        const monthly = await getMonthlyUsersCount();
        const channelsList = (globalSettings.channels && globalSettings.channels.length > 0)
          ? globalSettings.channels.join(', ')
          : globalSettings.channelUsername;
        const text = `📊 Tizim Statistikasi:\n\n📢 Majburiy obuna kanallari: ${channelsList}\n👥 Jami foydalanuvchilar: ${total} ta\n📅 Oylik faol foydalanuvchilar: ${monthly} ta\n\nYangilangan vaqti: ${new Date().toLocaleTimeString()}`;
        await ctx.editMessageText(text, getAdminKeyboard()).catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action('admin_users', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId || !(await checkIfAdmin(userId))) {
          return ctx.answerCbQuery("Ruxsat berilmadi!", { show_alert: true });
        }
        const usersList = await getAllUsers();
        const topUsers = usersList.slice(0, 15);
        let msg = `👥 Oxirgi 15 ta foydalanuvchi (Jami: ${usersList.length}):\n\n`;
        topUsers.forEach((user: any, i: number) => {
          msg += `${i+1}. ${user.firstName || ''} ${user.lastName || ''} ${user.username ? '(@' + user.username + ')' : ''} - ${user.testsTaken || 0} test, ${user.averageScore || 0}%\n`;
        });
        await ctx.editMessageText(msg, getAdminKeyboard()).catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action('admin_broadcast', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId || !(await checkIfAdmin(userId))) {
          return ctx.answerCbQuery("Ruxsat berilmadi!", { show_alert: true });
        }
        adminSessions.set(userId, { action: 'waiting_for_broadcast' });
        await ctx.editMessageText("📢 Barcha foydalanuvchilarga yuboriladigan xabar matnini kiriting yoki bekor qilish uchun /cancel deb yozing:").catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action('admin_channel', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId || !(await checkIfAdmin(userId))) {
          return ctx.answerCbQuery("Ruxsat berilmadi!", { show_alert: true });
        }
        adminSessions.set(userId, { action: 'waiting_for_channel' });
        await ctx.editMessageText("⚙️ Majburiy obuna kanallarini o'zgartirish.\n\nKanal yoki kanallar ro'yxatini vergul yoki bo'shliq bilan ajratib kiriting (masalan: `@channel1, @channel2`):\n\nBekor qilish uchun /cancel deb yozing:").catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action('admin_help', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId || !(await checkIfAdmin(userId))) {
          return ctx.answerCbQuery("Ruxsat berilmadi!", { show_alert: true });
        }
        const text = `❓ Admin Paneli Yordam:\n\n*Buyruqlar:* \n/admin - Boshqaruv panelini ochish\n/stats - Statistika\n/users - Oxirgi foydalanuvchilar\n/broadcast <xabar> - Tezkor e'lon\n\nKlaviatura orqali boshqarishda siz istalgan vaqtda so'rovni bekor qilish uchun /cancel deb yozib yuborishingiz mumkin.`;
        await ctx.editMessageText(text, getAdminKeyboard()).catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action('admin_logout', async (ctx) => {
        const userId = ctx.from?.id;
        if (userId) {
          await setAdminStatus(userId, false);
          adminSessions.delete(userId);
          await ctx.editMessageText("👋 Siz admin panelidan muvaffaqiyatli chiqdingiz va admin huquqingiz tugatildi.").catch(() => {});
        }
        await ctx.answerCbQuery();
      });

      bot.on('text', async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const session = adminSessions.get(userId);
        if (session) {
          const isUserAdmin = await checkIfAdmin(userId);
          if (isUserAdmin) {
            if (ctx.message.text === '/cancel' || ctx.message.text.toLowerCase() === 'bekor qilish' || ctx.message.text === 'cancel') {
              adminSessions.delete(userId);
              return ctx.reply('❌ Amal bekor qilindi. Boshqaruv paneli:', getAdminKeyboard());
            }

            if (session.action === 'waiting_for_broadcast') {
              adminSessions.delete(userId);
              const message = ctx.message.text;
              const usersList = await getAllUsers();
              ctx.reply(`📢 Barchaga xabar yuborish boshlandi (${usersList.length} ta foydalanuvchiga)...`);
              
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
              
              return ctx.reply(`✅ Xabar yuborish yakunlandi.\n\nYetkazildi: ${successCount}\nXatolik: ${failCount}`, getAdminKeyboard());
            }

            if (session.action === 'waiting_for_channel') {
              adminSessions.delete(userId);
              const inputText = ctx.message.text.trim();
              
              // Split by commas, spaces, or newlines
              const parsedChannels = inputText.split(/[\s,;\n]+/)
                .map(ch => ch.trim())
                .filter(ch => ch.length > 0)
                .map(ch => ch.startsWith('@') ? ch : '@' + ch);

              if (parsedChannels.length === 0) {
                return ctx.reply("❌ Yaroqli kanal kiritilmadi. Boshqaruv paneli:", getAdminKeyboard());
              }

              await saveSettings(parsedChannels);
              const formattedList = parsedChannels.join(', ');
              return ctx.reply(`✅ Majburiy obuna kanallari muvaffaqiyatli o'zgartirildi!\n📢 Yangi kanallar ro'yxati: ${formattedList}`, getAdminKeyboard());
            }
          }
        }

        return next();
      });

      const checkSubscription = async (ctx: any): Promise<boolean> => {
        try {
          const userId = ctx.from?.id;
          if (!userId) return false;
          
          const channels = globalSettings.channels && globalSettings.channels.length > 0
            ? globalSettings.channels 
            : [globalSettings.channelUsername];

          const validChannels = channels.map(ch => ch.trim()).filter(ch => ch !== '');
          if (validChannels.length === 0) return true;

          // Paralel ravishda barcha kanallarni tekshiramiz (maksimal tezlik - 1 soniya ichida)
          const results = await Promise.all(
            validChannels.map(async (channel) => {
              try {
                const member = await ctx.telegram.getChatMember(channel, userId);
                return ['creator', 'administrator', 'member', 'restricted'].includes(member.status);
              } catch (error) {
                console.error(`Error checking subscription for ${channel}:`, error);
                return false;
              }
            })
          );

          return results.every(isSubbed => isSubbed === true);
        } catch (error) {
          console.error("Error checking subscription:", error);
          return false;
        }
      };

      const sendSubscriptionPrompt = async (ctx: any) => {
        const text = "Testlarni ishlash uchun avval barcha majburiy kanallarga obuna bo'ling:";
        const channels = globalSettings.channels && globalSettings.channels.length > 0
          ? globalSettings.channels 
          : [globalSettings.channelUsername];
        
        const buttons: any[][] = [];
        channels.forEach((channel, idx) => {
          if (!channel || channel.trim() === '') return;
          const cleanChannel = channel.replace('@', '').trim();
          const channelLink = `https://t.me/${cleanChannel}`;
          buttons.push([Markup.button.url(`📢 Obuna bo'lish: ${channel}`, channelLink)]);
        });
        
        buttons.push([Markup.button.callback("✅ Obunani tekshirish", "check_sub")]);
        
        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, Markup.inlineKeyboard(buttons)).catch(console.error);
        } else {
          await ctx.reply(text, Markup.inlineKeyboard(buttons)).catch(console.error);
        }
      };

      // Obuna bo'lmagan foydalanuvchilarning barcha so'rovlarini to'xatuvchi va tezkor tekshiruvchi middleware
      bot.use(async (ctx, next) => {
        if (!ctx.from) return next();
        
        // Adminlar uchun barcha tekshiruvlarni chetlab o'tamiz
        const isUserAdmin = await checkIfAdmin(ctx.from.id);
        if (isUserAdmin) {
          return next();
        }

        // check_sub, admin kabi maxsus aksiyalarni middleware bloklamaydi (bular o'zlarida tekshirishadi)
        const isCheckSub = ctx.callbackQuery && 'data' in ctx.callbackQuery && ctx.callbackQuery.data === 'check_sub';
        
        if (isCheckSub) {
          return next();
        }

        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          if (ctx.callbackQuery) {
            await ctx.answerCbQuery("Iltimos, avval barcha majburiy kanallarga obuna bo'ling!", { show_alert: true }).catch(() => {});
          }
          return sendSubscriptionPrompt(ctx);
        }

        return next();
      });

      const getMainMenuKeyboard = () => {
        return Markup.inlineKeyboard([
          [Markup.button.callback("📕 Majburiy Matematika (370 ta test)", "menu_majburiy")],
          [Markup.button.callback("🧮 Matematika (Ixtisoslik bo'limlari)", "menu_matematika")]
        ]);
      };

      bot.start(async (ctx) => {
        ctx.reply(
          "Salom! Men Matematika testini o'tkazuvchi botman.\n\nQuyidagilardan birini tanlang:",
          getMainMenuKeyboard()
        );
      });

      const sendQuestion = async (ctx: any, chatId: number) => {
        const session = sessions.get(chatId);
        if (!session) return;
        
        let questions: any[] = [];
        let title = "";

        if (session.type === 'majburiy' && session.variantIndex !== undefined) {
          questions = variants[session.variantIndex].questions;
          title = variants[session.variantIndex].title;
        } else if (session.type === 'matematika' && session.sectionId && session.sectionVariantIndex !== undefined) {
          const section = mathSections.find(s => s.id === session.sectionId);
          if (section) {
            questions = section.variants[session.sectionVariantIndex].questions;
            title = `${section.title} - ${section.variants[session.sectionVariantIndex].title}`;
          }
        }

        if (questions.length === 0) {
          sessions.delete(chatId);
          return ctx.reply("Xatolik yuz berdi. Iltimos, /test orqali qayta urinib ko'ring.");
        }

        const q = questions[session.currentQuestion];
        const text = `${title}\n\nSavol ${session.currentQuestion + 1} / ${questions.length}\n\n${q.text}`;
        
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

        ctx.reply(
          "Bo'limni tanlang:",
          getMainMenuKeyboard()
        );
      });

      bot.action('check_sub', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (isSubscribed) {
          await ctx.deleteMessage().catch(() => {});
          ctx.reply(
            "Rahmat! Obuna tasdiqlandi.\n\nQuyidagilardan birini tanlang:",
            getMainMenuKeyboard()
          );
        } else {
          ctx.answerCbQuery("Siz hali kanalga obuna bo'lmagansiz!", { show_alert: true });
        }
      });

      bot.action('menu_majburiy', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const buttons: any[][] = [];
        variants.forEach((v, i) => {
          buttons.push([Markup.button.callback(v.title, `start_variant_${i}`)]);
        });
        buttons.push([Markup.button.callback("↩️ Orqaga", "main_menu")]);

        await ctx.editMessageText(
          "📕 Majburiy Matematika variantlaridan birini tanlang:",
          Markup.inlineKeyboard(buttons)
        ).catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action('menu_matematika', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const buttons: any[][] = [];
        mathSections.forEach((section) => {
          buttons.push([Markup.button.callback(`📁 ${section.title}`, `sec_list_${section.id}`)]);
        });
        buttons.push([Markup.button.callback("↩️ Orqaga", "main_menu")]);

        await ctx.editMessageText(
          "🧮 Matematika ixtisoslik bo'limlaridan birini tanlang:",
          Markup.inlineKeyboard(buttons)
        ).catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action('main_menu', async (ctx) => {
        await ctx.editMessageText(
          "Salom! Men Matematika testini o'tkazuvchi botman.\n\nQuyidagilardan birini tanlang:",
          getMainMenuKeyboard()
        ).catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action(/sec_list_(.+)/, async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const sectionId = ctx.match[1].trim();
        const section = mathSections.find(s => s.id === sectionId);
        
        if (!section) {
          return ctx.answerCbQuery("Bo'lim topilmadi!", { show_alert: true });
        }

        const buttons: any[][] = [];
        section.variants.forEach((v, i) => {
          buttons.push([Markup.button.callback(v.title, `start_sec_v_${sectionId}_${i}`)]);
        });
        buttons.push([Markup.button.callback("↩️ Orqaga", "menu_matematika")]);

        await ctx.editMessageText(
          `📁 ${section.title} bo'limi variantlari:\n\n${section.description}`,
          Markup.inlineKeyboard(buttons)
        ).catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action(/start_sec_v_(.+)_(.+)/, async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const chatId = ctx.chat?.id;
        if (!chatId) return;
        const sectionId = ctx.match[1];
        const sectionVariantIndex = parseInt(ctx.match[2]);
        
        sessions.set(chatId, { 
          type: 'matematika', 
          sectionId, 
          sectionVariantIndex, 
          currentQuestion: 0, 
          answers: [] 
        });
        await sendQuestion(ctx, chatId);
      });

      bot.action(/start_variant_(\d+)/, async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const chatId = ctx.chat?.id;
        if (!chatId) return;
        const variantIndex = parseInt(ctx.match[1]);
        sessions.set(chatId, { 
          type: 'majburiy', 
          variantIndex, 
          currentQuestion: 0, 
          answers: [] 
        });
        await sendQuestion(ctx, chatId);
      });

      bot.action(/ans_(\d+)/, async (ctx) => {
        const chatId = ctx.chat?.id;
        if (!chatId) return;
        
        const session = sessions.get(chatId);
        if (!session) {
          return ctx.reply("Test sessiyasi topilmadi. Iltimos, /test orqali qaytadan boshlang.");
        }

        let questions: any[] = [];
        let title = "";

        if (session.type === 'majburiy' && session.variantIndex !== undefined) {
          questions = variants[session.variantIndex].questions;
          title = variants[session.variantIndex].title;
        } else if (session.type === 'matematika' && session.sectionId && session.sectionVariantIndex !== undefined) {
          const section = mathSections.find(s => s.id === session.sectionId);
          if (section) {
            questions = section.variants[session.sectionVariantIndex].questions;
            title = `${section.title} - ${section.variants[session.sectionVariantIndex].title}`;
          }
        }

        if (questions.length === 0) {
          sessions.delete(chatId);
          return ctx.reply("Savollar topilmadi. Iltimos, /test orqali qaytadan urinib ko'ring.");
        }

        const answerIdx = parseInt(ctx.match[1]);
        session.answers.push(answerIdx);
        session.currentQuestion++;

        if (session.currentQuestion < questions.length) {
          await sendQuestion(ctx, chatId);
        } else {
          const isCorrect = session.answers.map((ans, i) => ans === questions[i].correct);
          const rawScore = isCorrect.filter(Boolean).length;
          const percentage = Math.round((rawScore / questions.length) * 100);

          await trackTestResult(chatId, percentage);

          let resultText = `🎉 ${title} yakunlandi!\n\n`;
          resultText += `📊 To'g'ri javoblar: ${rawScore} / ${questions.length}\n`;
          resultText += `🎯 Natija: ${percentage}%\n\n`;
          
          resultText += `📝 Savollar tahlili:\n`;
          isCorrect.forEach((correct, i) => {
            resultText += `${i + 1}-savol: ${correct ? "✅ To'g'ri" : "❌ Noto'g'ri"}\n`;
          });

          if (ctx.callbackQuery) {
            try {
              await ctx.deleteMessage();
            } catch (e) {}
          }

          await ctx.reply(resultText, getMainMenuKeyboard());
          
          sessions.delete(chatId);
        }
      });

      // Webhooklar AI Studio muhitida proxy sababli ishlamaydi (302 Cookie check).
      // Shuning uchun faqat Polling dan foydalanamiz.
      // Cloud Run da container almashayotgan paytda (traffic shifting)
      // eski instance o'chguncha 409 Conflict xatosi berishi tabiiy.
      const launchBot = async () => {
        let isRunning = false;
        while (!isRunning) {
          try {
            await bot!.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot!.launch({ dropPendingUpdates: true });
            console.log("Telegram bot launched in Polling mode.");
            botStatus = "running";
            isRunning = true;
          } catch (error: any) {
            if (error?.response?.error_code === 409) {
              // 409 xatosi - bot boshqa joyda ishlab turibdi (yoki oldingi server hali tamomila o'chmagan).
              // Jimjitgina kutamiz va qaytadan urinamiz.
              botStatus = "waiting_for_lock";
              await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
              console.error("Failed to launch Telegram bot:", error);
              botStatus = "error";
              break;
            }
          }
        }
      };

      launchBot();
      
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
