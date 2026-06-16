import express from "express";
import { createServer as createViteServer } from "vite";
import { Telegraf, Markup } from "telegraf";
import path from "path";
import fs from "fs";
import { variants } from "./src/questions.js";
import { mathSections } from "./src/mathSections.js";
import { milliySertifikat } from "./src/milliySertifikat.js";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, Timestamp, deleteDoc } from 'firebase/firestore';

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

let customTests: any[] = [];

async function loadCustomTests() {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, 'custom_tests'));
    const items: any[] = [];
    snap.forEach(docSnap => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    customTests = items;
    console.log(`Loaded ${customTests.length} custom tests from Firestore.`);
  } catch (err) {
    console.error("Error loading custom tests:", err);
  }
}

interface UserData {
  timestamp: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  testsTaken?: number;
  averageScore?: number;
  isAdmin?: boolean;
  isBanned?: boolean;
}

interface Candidate {
  id: string;
  fullName: string;
  phone: string;
  direction: string;
  score: number;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
  experience: string;
}

let candidatesCache = new Map<string, Candidate>();

const seedCandidates = () => {
  if (candidatesCache.size === 0) {
    const defaultCandidates: Candidate[] = [
      { id: "4820194", fullName: "Azizbek Karimov", phone: "+998901234567", direction: "Katta O'qituvchi", score: 85, status: "pending", timestamp: Date.now() - 3600000 * 5, experience: "3 yillik matematika repetitorlik tajribasi" },
      { id: "1059281", fullName: "Dilshoda Ergasheva", phone: "+998935552144", direction: "Metodist", score: 92, status: "approved", timestamp: Date.now() - 3600000 * 24, experience: "Xalqaro matematika loyihalarida 2 yil" },
      { id: "8591024", fullName: "Shoxruxbek Olimov", phone: "+998991118833", direction: "Junior Mentor", score: 45, status: "rejected", timestamp: Date.now() - 3600000 * 48, experience: "Pedagogika universiteti bitiruvchisi" },
      { id: "9510258", fullName: "Zulxumor Tursunova", phone: "+998977770022", direction: "Matematika o'qituvchisi", score: 78, status: "pending", timestamp: Date.now() - 3600000 * 72, experience: "Maktabda matematika fani o'qituvchisi" }
    ];
    defaultCandidates.forEach(c => candidatesCache.set(c.id, c));
  }
};

// Global settings stored persistently
let globalSettings = {
  channelUsername: '@dilmurodbekmatematika',
  channels: ['@dilmurodbekmatematika', '@DilnuraMadaminova'],
  hdpLink: 'https://forms.gle/f6ZiQtiqCAH1CLy87',
  omonLink: 'https://forms.gle/97m9hCsBFovYKKrX7'
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
          if (data.hdpLink) {
            globalSettings.hdpLink = data.hdpLink;
          }
          if (data.omonLink) {
            globalSettings.omonLink = data.omonLink;
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
            await saveSettings(channelsList, globalSettings.hdpLink, globalSettings.omonLink);
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

async function saveSettings(channels: string[], hdpLink?: string, omonLink?: string) {
  globalSettings.channels = channels;
  if (channels.length > 0) {
    globalSettings.channelUsername = channels[0];
  }
  if (hdpLink) {
    globalSettings.hdpLink = hdpLink;
  }
  if (omonLink) {
    globalSettings.omonLink = omonLink;
  }
  if (db) {
    try {
      await setDoc(doc(db, 'settings', 'config'), { 
        channels, 
        channelUsername: channels.length > 0 ? channels[0] : '',
        hdpLink: globalSettings.hdpLink,
        omonLink: globalSettings.omonLink
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
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    username: user.username || "",
    testsTaken: existing.testsTaken || 0,
    averageScore: existing.averageScore || 0,
    isAdmin: existing.isAdmin || false,
    isBanned: existing.isBanned || false
  };
  
  userActivity.set(user.id, data);

  if (db) {
    try {
      // Clean any potential undefined keys from the object to prevent Firestore errors
      const firestoreData = { ...data };
      Object.keys(firestoreData).forEach(key => {
        if (firestoreData[key as keyof UserData] === undefined) {
          delete firestoreData[key as keyof UserData];
        }
      });
      await setDoc(doc(db, 'users', user.id.toString()), firestoreData, { merge: true });
    } catch (e) {
      console.error('Error saving user to Firestore:', e);
    }
  }
}

async function handleBroadcastError(uId: number, error: any) {
  const errMsg = String(error?.message || error?.description || '').toLowerCase();
  console.log(`Failed to broadcast message to user ${uId}: ${error?.message || error}`);
  // We no longer auto-ban users based on broadcast errors to prevent accidental blocking.
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



interface UserSession {
  type: 'majburiy' | 'matematika' | 'milliy' | 'custom';
  variantIndex?: number;
  sectionId?: string;
  sectionVariantIndex?: number;
  testId?: string;
  currentQuestion: number;
  answers: number[];
}

const sessions = new Map<number, UserSession>();
const adminState = new Map<number, string>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load configuration and prime the local cache on startup
  await loadSettings();
  seedCandidates();
  if (db) {
    await loadCustomTests();
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const unbanPromises: Promise<any>[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as UserData;
        if (data.isBanned) {
          console.log(`Auto-unbanning previously banned user ${docSnap.id} on startup.`);
          data.isBanned = false;
          unbanPromises.push(
            setDoc(doc(db, 'users', docSnap.id), { isBanned: false }, { merge: true })
              .catch(err => console.error(`Failed to unban user ${docSnap.id} in DB:`, err))
          );
        }
        userActivity.set(Number(docSnap.id), data);
      });
      if (unbanPromises.length > 0) {
        await Promise.all(unbanPromises);
        console.log(`Unbanned ${unbanPromises.length} blocked users from Firestore.`);
      }
      console.log(`Successfully primed cache with ${userActivity.size} users.`);

      // Prime candidates
      try {
        const snap = await getDocs(collection(db, 'candidates'));
        if (!snap.empty) {
          snap.forEach(docSnap => {
            candidatesCache.set(docSnap.id, docSnap.data() as Candidate);
          });
          console.log(`Loaded ${candidatesCache.size} candidates from Firestore.`);
        } else {
          for (const [id, value] of candidatesCache.entries()) {
            await setDoc(doc(db, 'candidates', id), value);
          }
          console.log("Seeded candidates into Firestore.");
        }
      } catch (errCand) {
        console.error("Error priming candidates cache:", errCand);
      }
    } catch (e) {
      console.error("Error priming users cache on startup:", e);
    }
  }

  app.use(express.json());



  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  let botStatus = "not_configured";
  let bot: Telegraf | null = null;

  if (botToken) {
    try {
      bot = new Telegraf(botToken);
      
      bot.catch((err: any, ctx: any) => {
        console.error(`Telegram bot error for update ${ctx.update?.update_id || "unknown"}:`, err);
      });
      
      bot.use(async (ctx, next) => {
        if (ctx.from) {
          const userData = userActivity.get(ctx.from.id);
          if (userData && userData.isBanned) {
            if (ctx.callbackQuery) {
              await ctx.answerCbQuery("Siz botdan chetlashtirilgansiz! 🚫", { show_alert: true }).catch(() => {});
            } else {
              await ctx.reply("❌ Siz tizimdan chetlashtirilgansiz! Savollaringiz bo'lsa, ma'murlar bilan bog'laning.");
            }
            return;
          }
          trackUser(ctx.from);
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
              } catch (error: any) {
                console.error(`Error checking subscription for ${channel}:`, error);
                const errMsg = String(error?.message || error?.description || '').toLowerCase();
                if (
                  errMsg.includes('member list is inaccessible') ||
                  errMsg.includes('chat not found') ||
                  errMsg.includes('forbidden') ||
                  errMsg.includes('not found') ||
                  errMsg.includes('not a member') ||
                  errMsg.includes('bad request')
                ) {
                  // Fallback to true to prevent blocking/breaking the bot when a user or inaccessible channel is added
                  return true;
                }
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
        
        // check_sub kabi maxsus aksiyalarni middleware bloklamaydi (bular o'zlarida tekshirishadi)
        const isCheckSub = ctx.callbackQuery && 'data' in ctx.callbackQuery && ctx.callbackQuery.data === 'check_sub';
        
        if (isCheckSub) {
          return next();
        }

        // Bypass for admins so they can access administrative command/actions freely
        const userId = ctx.from.id;
        const envAdminId = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : undefined;
        const uData = userActivity.get(userId);
        if ((envAdminId && userId === envAdminId) || (uData && uData.isAdmin)) {
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
          [Markup.button.callback("🧮 Matematika (Ixtisoslik bo'limlari)", "menu_matematika")],
          [Markup.button.callback("🎓 Milliy Sertifikat imtihonlari", "menu_milliy")]
        ]);
      };

      const getPersistentKeyboard = () => {
        return Markup.keyboard([
          ["📕 Majburiy Matematika", "🎓 Milliy Sertifikat"],
          ["🧮 Matematika (Ixtisoslik)"]
        ]).resize();
      };

      bot.start(async (ctx) => {
        if (ctx.from) {
          trackUser(ctx.from);
        }
        await ctx.reply(
          "Salom! Matematika imtihon botiga xush kelibsiz.\n\nTestlarni boshlash uchun quyidagi menyu tugmalaridan birini tanlang:",
          getPersistentKeyboard()
        ).catch(console.error);
      });

      bot.hears(["📕 Majburiy Matematika", "Majburiy Matematika", "majburiy matematika"], async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const buttons: any[][] = [];
        variants.forEach((v, i) => {
          buttons.push([Markup.button.callback(v.title, `start_variant_${i}`)]);
        });
        buttons.push([Markup.button.callback("↩️ Orqaga", "main_menu")]);

        await ctx.reply(
          "📕 Majburiy Matematika variantlaridan birini tanlang:",
          Markup.inlineKeyboard(buttons)
        ).catch(() => {});
      });

      bot.hears(["🎓 Milliy Sertifikat", "Milliy Sertifikat", "milliy sertifikat"], async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const buttons: any[][] = [];
        milliySertifikat.forEach((v, i) => {
          buttons.push([Markup.button.callback(v.title, `start_milliy_${i}`)]);
        });
        buttons.push([Markup.button.callback("↩️ Orqaga", "main_menu")]);

        await ctx.reply(
          "🎓 Milliy Sertifikat imtihonlaridan birini tanlang:",
          Markup.inlineKeyboard(buttons)
        ).catch(() => {});
      });

      bot.hears(["🧮 Matematika (Ixtisoslik)", "Matematika", "matematika"], async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const buttons: any[][] = [];
        mathSections.forEach((section) => {
          buttons.push([Markup.button.callback(`📁 ${section.title}`, `sec_list_${section.id}`)]);
        });
        buttons.push([Markup.button.callback("↩️ Orqaga", "main_menu")]);

        await ctx.reply(
          "🧮 Matematika ixtisoslik bo'limlaridan birini tanlang:",
          Markup.inlineKeyboard(buttons)
        ).catch(() => {});
      });

      const sendQuestion = async (ctx: any, chatId: number) => {
        const session = sessions.get(chatId);
        if (!session) return;
        
        let questions: any[] = [];
        let title = "";

        if (session.type === 'majburiy' && session.variantIndex !== undefined) {
          questions = variants[session.variantIndex].questions;
          title = variants[session.variantIndex].title;
        } else if (session.type === 'milliy' && session.variantIndex !== undefined) {
          questions = milliySertifikat[session.variantIndex].questions;
          title = milliySertifikat[session.variantIndex].title;
        } else if (session.type === 'matematika' && session.sectionId && session.sectionVariantIndex !== undefined) {
          const section = mathSections.find(s => s.id === session.sectionId);
          if (section) {
            questions = section.variants[session.sectionVariantIndex].questions;
            title = `${section.title} - ${section.variants[session.sectionVariantIndex].title}`;
          }
        } else if (session.type === 'custom' && session.testId !== undefined) {
          const cTest = customTests.find(t => t.id === session.testId);
          if (cTest) {
            questions = cTest.questions;
            title = cTest.title;
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

      const formatChannelLink = (channel: string) => {
        if (!channel) return "";
        const s = channel.trim();
        if (s.startsWith("http://") || s.startsWith("https://")) return s;
        if (s.startsWith("@")) return `https://t.me/${s.substring(1)}`;
        return `https://t.me/${s}`;
      };

      const getAdminKeyboard = () => {
        return Markup.inlineKeyboard([
          [Markup.button.callback("✏️ Kanalni o'zgartirish", "edit_channels")],
          [Markup.button.callback("📢 Xabar tarqatish", "edit_broadcast")],
          [Markup.button.callback("❌ Bekor qilish", "cancel_admin")]
        ]);
      };

      const getAdminStatusMessage = () => {
        const totalUsers = userActivity.size;
        const channelLink = formatChannelLink(globalSettings.channelUsername);

        return `📊 *Statistika:*\n\n` +
          `👥 Foydalanuvchilar: ${totalUsers}\n\n` +
          `⚙️ *Joriy sozlamalar:*\n` +
          `Kanal: ${channelLink}`;
      };

      bot.command('admin', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        // Auto-promote if the user's Telegram ID matches the configured ADMIN_ID env variable
        const envAdminId = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : undefined;
        if (envAdminId && userId === envAdminId) {
          const existing = userActivity.get(userId) || {} as Partial<UserData>;
          if (!existing.isAdmin) {
            existing.isAdmin = true;
            const data: UserData = {
              ...existing as UserData,
              timestamp: Date.now(),
              firstName: ctx.from.first_name || "",
              lastName: ctx.from.last_name || "",
              username: ctx.from.username || "",
              testsTaken: existing.testsTaken || 0,
              averageScore: existing.averageScore || 0,
              isAdmin: true
            };
            userActivity.set(userId, data);
            if (db) {
              const cleanedData = { ...data };
              Object.keys(cleanedData).forEach(key => {
                if (cleanedData[key as keyof UserData] === undefined) {
                  delete cleanedData[key as keyof UserData];
                }
              });
              await setDoc(doc(db, 'users', userId.toString()), cleanedData, { merge: true }).catch(console.error);
            }
          }
        }

        const args = ctx.payload;
        if (args) {
          const expectedPassword = process.env.ADMIN_PASSWORD || "1";
          if (args.trim() === expectedPassword.trim()) {
            const existing = userActivity.get(userId) || {} as Partial<UserData>;
            const data: UserData = {
              ...existing as UserData,
              timestamp: Date.now(),
              firstName: ctx.from.first_name || "",
              lastName: ctx.from.last_name || "",
              username: ctx.from.username || "",
              testsTaken: existing.testsTaken || 0,
              averageScore: existing.averageScore || 0,
              isAdmin: true
            };
            userActivity.set(userId, data);
            if (db) {
              const cleanedData = { ...data };
              Object.keys(cleanedData).forEach(key => {
                if (cleanedData[key as keyof UserData] === undefined) {
                  delete cleanedData[key as keyof UserData];
                }
              });
              await setDoc(doc(db, 'users', userId.toString()), cleanedData, { merge: true }).catch(console.error);
            }
            return ctx.reply("🎉 Tabriklaymiz! Siz muvaffaqiyatli admin bo'ldingiz.");
          } else {
            return ctx.reply("❌ Noto'g'ri parol! Ruxsat olish uchun `/admin [parol]` formatida yuboring.");
          }
        }

        const userData = userActivity.get(userId);
        if (!userData || !userData.isAdmin) {
          return ctx.reply("🔒 Boshqaruv ruxsati berilmagan. Adminlik huquqini faollashtirish uchun parolni kiriting:\n\n`/admin [parol]`");
        }

        await ctx.reply(getAdminStatusMessage(), {
          parse_mode: "Markdown",
          ...getAdminKeyboard()
        });
      });

      bot.action('edit_channels', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return ctx.answerCbQuery();
        const userData = userActivity.get(userId);
        if (!userData || !userData.isAdmin) {
          return ctx.answerCbQuery("🔒 Siz admin emassiz!", { show_alert: true });
        }

        adminState.set(userId, "awaiting_channels");
        await ctx.reply(
          "✏️ Yangi hamkor kanali havolasi yoki foydalanuvchi nomini yuboring (masalan: @DilnuraMadaminova yoki https://t.me/Xorazm_ish_elon_uz):\n\n⚠️ Diqqat: @DilnuraMadaminova kanali tizim tomonidan avtomatik qo'shiladi.",
          Markup.inlineKeyboard([[Markup.button.callback("❌ Bekor qilish", "cancel_admin")]])
        );
        await ctx.answerCbQuery();
      });

      bot.action('edit_broadcast', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return ctx.answerCbQuery();
        const userData = userActivity.get(userId);
        if (!userData || !userData.isAdmin) {
          return ctx.answerCbQuery("🔒 Siz admin emassiz!", { show_alert: true });
        }

        adminState.set(userId, "awaiting_broadcast_msg");
        await ctx.reply(
          "📢 Barcha a'zolarga tarqatiladigan reklama xabarini (matn, rasm, video yoki istalgan turdagi fayl/stiker) yuboring.",
          Markup.inlineKeyboard([[Markup.button.callback("❌ Bekor qilish", "cancel_admin")]])
        );
        await ctx.answerCbQuery();
      });

      bot.action('cancel_admin', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return ctx.answerCbQuery();
        adminState.delete(userId);
        await ctx.reply("❌ Joriy adminlik amali bekor qilindi.");
        await ctx.answerCbQuery("Amallar bekor qilindi");
      });

      // Handle Admin states
      bot.on('message', async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const state = adminState.get(userId);
        if (!state) return next();

        const userData = userActivity.get(userId);
        const envAdminId = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : undefined;
        const isAdmin = (envAdminId && userId === envAdminId) || (userData && userData.isAdmin);

        if (!isAdmin) {
          adminState.delete(userId);
          return next();
        }

        if (state === "awaiting_broadcast_msg") {
          adminState.delete(userId);
          await ctx.reply("⏳ Reklama / Xabar barcha foydalanuvchilarga tarqatilmoqda, kuting...");

          let userIds: string[] = [];
          if (db) {
            try {
              const snapshot = await getDocs(collection(db, "users"));
              snapshot.forEach(docSnap => {
                userIds.push(docSnap.id);
              });
            } catch (e) {
              console.error("Database connection error in broadcast:", e);
              userIds = Array.from(userActivity.keys()).map(id => id.toString());
            }
          } else {
            userIds = Array.from(userActivity.keys()).map(id => id.toString());
          }

          if (userIds.length === 0) {
            return ctx.reply("❌ Foydalanuvchilar topilmadi.");
          }

          let sentCount = 0;
          let failedCount = 0;

          for (const idStr of userIds) {
            const uId = Number(idStr);
            if (!uId || isNaN(uId)) continue;
            
            const cachedUser = userActivity.get(uId);
            if (cachedUser && cachedUser.isBanned) continue;

            try {
              await ctx.telegram.copyMessage(uId, ctx.chat!.id, ctx.message!.message_id);
              sentCount++;
            } catch (error) {
              await handleBroadcastError(uId, error);
              failedCount++;
            }
          }

          await ctx.reply(`✅ Reklama tarqatish yakunlandi:\n\n• Muvaffaqiyatli: *${sentCount}* ta\n• Muvaffaqiyatsiz: *${failedCount}* ta`, { parse_mode: "Markdown" });
          
          return ctx.reply(getAdminStatusMessage(), {
            parse_mode: "Markdown",
            ...getAdminKeyboard()
          });
        }

        const text = (ctx.message as any).text;
        if (!text) {
          return ctx.reply("⚠️ Iltimos, faqat matnli ma'lumot yuboring!");
        }

        if (state === "awaiting_channels") {
          adminState.delete(userId);
          const parts = text.split(',').map((p: string) => {
            let s = p.trim();
            if (s.includes("t.me/")) {
              const match = s.match(/t\.me\/([a-zA-Z0-9_]+)/);
              if (match && match[1]) {
                s = "@" + match[1];
              }
            }
            if (!s.startsWith('@') && !s.startsWith('-') && !s.slice(0, 10).includes('://')) {
              s = '@' + s;
            }
            return s;
          }).filter(Boolean);

          const mandatoryChannel = '@DilnuraMadaminova';
          if (!parts.some((ch: string) => ch.toLowerCase() === mandatoryChannel.toLowerCase())) {
            parts.push(mandatoryChannel);
          }

          try {
            await saveSettings(parts, globalSettings.hdpLink, globalSettings.omonLink);
            await ctx.reply(`✅ Kanallar muvaffaqiyatli yangilandi!\n\nJoriy ro'yxat: ${parts.join(', ')}`);
          } catch (e: any) {
            await ctx.reply(`❌ Xatolik yuz berdi: ${e.message}`);
          }
        }

        return ctx.reply(getAdminStatusMessage(), {
          parse_mode: "Markdown",
          ...getAdminKeyboard()
        });
      });

      bot.command('broadcast', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;
        const userData = userActivity.get(userId);
        if (!userData || !userData.isAdmin) {
          return ctx.reply("🔒 Ushbu buyruq faqat adminlar uchun.");
        }

        const message = ctx.payload;
        if (!message || message.trim() === "") {
          return ctx.reply("⚠️ Xabar yozishni unutdingiz. Format: `/broadcast [xabar matni]`");
        }

        await ctx.reply("⏳ Xabar yuborilmoqda, kuting...");

        let userIds: string[] = [];
        if (db) {
          try {
            const snapshot = await getDocs(collection(db, "users"));
            snapshot.forEach(docSnap => {
              userIds.push(docSnap.id);
            });
          } catch (e) {
            console.error("Database connection error in /broadcast command:", e);
            userIds = Array.from(userActivity.keys()).map(id => id.toString());
          }
        } else {
          userIds = Array.from(userActivity.keys()).map(id => id.toString());
        }

        if (userIds.length === 0) {
          return ctx.reply("❌ Foydalanuvchilar topilmadi.");
        }

        let sentCount = 0;
        let failedCount = 0;

        for (const idStr of userIds) {
          const uId = Number(idStr);
          if (!uId || isNaN(uId)) continue;

          const cachedUser = userActivity.get(uId);
          if (cachedUser && cachedUser.isBanned) continue;

          try {
            await ctx.telegram.sendMessage(uId, message);
            sentCount++;
          } catch (error) {
            await handleBroadcastError(uId, error);
            failedCount++;
          }
        }

        await ctx.reply(`✅ Xabar yuborish yakunlandi:\n\n• Muvaffaqiyatli: *${sentCount}* ta\n• Muvaffaqiyatsiz: *${failedCount}* ta`, { parse_mode: "Markdown" });
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

        // Append custom tests for majburiy
        const customMajburiy = customTests.filter(t => t.category === 'majburiy');
        customMajburiy.forEach((t) => {
          buttons.push([Markup.button.callback(`⭐ ${t.title}`, `start_custom_${t.id}`)]);
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

      bot.action('menu_milliy', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const buttons: any[][] = [];
        milliySertifikat.forEach((v, i) => {
          buttons.push([Markup.button.callback(v.title, `start_milliy_${i}`)]);
        });

        // Append custom tests for milliy
        const customMilliy = customTests.filter(t => t.category === 'milliy');
        customMilliy.forEach((t) => {
          buttons.push([Markup.button.callback(`⭐ ${t.title}`, `start_custom_${t.id}`)]);
        });

        buttons.push([Markup.button.callback("↩️ Orqaga", "main_menu")]);

        await ctx.editMessageText(
          "🎓 Milliy Sertifikat imtihonlaridan birini tanlang:",
          Markup.inlineKeyboard(buttons)
        ).catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action(/start_milliy_(\d+)/, async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const chatId = ctx.chat?.id;
        if (!chatId) return;
        const variantIndex = parseInt(ctx.match[1]);
        sessions.set(chatId, { 
          type: 'milliy', 
          variantIndex, 
          currentQuestion: 0, 
          answers: [] 
        });
        await sendQuestion(ctx, chatId);
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

        // Append custom tests for matematika and matching sectionId
        const customMatematika = customTests.filter(t => t.category === 'matematika' && t.sectionId === sectionId);
        customMatematika.forEach((t) => {
          buttons.push([Markup.button.callback(`⭐ ${t.title}`, `start_custom_${t.id}`)]);
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

      bot.action(/start_custom_(.+)/, async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const chatId = ctx.chat?.id;
        if (!chatId) return;
        const testId = ctx.match[1];
        sessions.set(chatId, { 
          type: 'custom', 
          testId, 
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
        } else if (session.type === 'milliy' && session.variantIndex !== undefined) {
          questions = milliySertifikat[session.variantIndex].questions;
          title = milliySertifikat[session.variantIndex].title;
        } else if (session.type === 'matematika' && session.sectionId && session.sectionVariantIndex !== undefined) {
          const section = mathSections.find(s => s.id === session.sectionId);
          if (section) {
            questions = section.variants[session.sectionVariantIndex].questions;
            title = `${section.title} - ${section.variants[session.sectionVariantIndex].title}`;
          }
        } else if (session.type === 'custom' && session.testId !== undefined) {
          const cTest = customTests.find(t => t.id === session.testId);
          if (cTest) {
            questions = cTest.questions;
            title = cTest.title;
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

  // Admin APIs
  function checkIsAdmin(telegramIdStr: string | undefined): boolean {
    if (!telegramIdStr) return false;
    const telegramId = Number(telegramIdStr);
    if (isNaN(telegramId)) return false;

    const envAdminId = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : undefined;
    if (envAdminId && telegramId === envAdminId) {
      return true;
    }

    const userData = userActivity.get(telegramId);
    return !!(userData && userData.isAdmin);
  }

  const requireAdmin = (req: any, res: any, next: any) => {
    const telegramId = req.headers["x-telegram-id"] || req.query.telegramId;
    if (!checkIsAdmin(telegramId?.toString())) {
      return res.status(403).json({ error: "Ruxsat etilmagan! Telegram ID xato yoki admin emas." });
    }
    next();
  };

  app.post("/api/auth/verify-admin", async (req, res) => {
    const { telegramId } = req.body;
    if (!telegramId) {
      return res.status(400).json({ error: "Telegram ID kiritilmadi" });
    }
    const isAd = checkIsAdmin(telegramId.toString());
    if (isAd) {
      const user = userActivity.get(Number(telegramId));
      res.json({ success: true, isAdmin: true, user });
    } else {
      res.json({ success: false, isAdmin: false, error: "Ushbu Telegram ID adminlar ro'yxatida topilmadi!" });
    }
  });

  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      if (db) {
        const snapshot = await getDocs(collection(db, "users"));
        const usersList: any[] = [];
        snapshot.forEach(docSnap => {
          usersList.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        res.json(usersList);
      } else {
        const usersList = Array.from(userActivity.entries()).map(([id, data]) => ({
          id: id.toString(),
          ...data
        }));
        res.json(usersList);
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/settings", requireAdmin, (req, res) => {
    res.json(globalSettings);
  });

  app.post("/api/settings", requireAdmin, async (req, res) => {
    const { channels, hdpLink, omonLink } = req.body;
    if (!Array.isArray(channels)) {
      return res.status(400).json({ error: "channels must be an array" });
    }
    try {
      await saveSettings(channels, hdpLink, omonLink);
      res.json({ success: true, settings: globalSettings });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tests", requireAdmin, (req, res) => {
    res.json(customTests);
  });

  app.post("/api/tests", requireAdmin, async (req, res) => {
    const { category, title, questions, sectionId } = req.body;
    if (!category || !title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Ma'lumotlar to'liq kiritilmadi" });
    }
    try {
      const newTestId = `test_${Date.now()}`;
      const newTest = {
        id: newTestId,
        category,
        title,
        sectionId: sectionId || undefined,
        questions: questions.map((q: any, i: number) => ({
          id: i + 1,
          text: q.text || "",
          imageUrl: q.imageUrl || "",
          options: Array.isArray(q.options) ? q.options : ["", "", "", ""],
          correct: typeof q.correct === 'number' ? q.correct : 0
        })),
        timestamp: Date.now()
      };

      if (db) {
        await setDoc(doc(db, 'custom_tests', newTestId), newTest);
      }
      customTests.push(newTest);
      res.json({ success: true, test: newTest });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tests/delete", requireAdmin, async (req, res) => {
    const { testId } = req.body;
    if (!testId) {
      return res.status(400).json({ error: "testId kiritilmagan" });
    }
    try {
      if (db) {
        await deleteDoc(doc(db, 'custom_tests', testId)).catch(console.error);
      }
      customTests = customTests.filter(t => t.id !== testId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/message-user", requireAdmin, async (req, res) => {
    const { userId, message, imageUrl } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: "userId and message are required" });
    }
    if (!bot) {
      return res.status(400).json({ error: "Bot is not initialized" });
    }
    try {
      if (imageUrl && imageUrl.trim() !== "") {
        await bot.telegram.sendPhoto(Number(userId), imageUrl, { caption: message });
      } else {
        await bot.telegram.sendMessage(Number(userId), message);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/broadcast", requireAdmin, async (req, res) => {
    const { message, imageUrl } = req.body;
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }
    if (!bot) {
      return res.status(400).json({ error: "Telegram bot is not initialized" });
    }

    try {
      let userIds: string[] = [];
      if (db) {
        const snapshot = await getDocs(collection(db, "users"));
        snapshot.forEach(docSnap => {
          userIds.push(docSnap.id);
        });
      } else {
        userIds = Array.from(userActivity.keys()).map(id => id.toString());
      }

      if (userIds.length === 0) {
        return res.json({ success: true, sentCount: 0, failedCount: 0, message: "No registered users found." });
      }

      let sentCount = 0;
      let failedCount = 0;

      for (const idStr of userIds) {
        const userId = Number(idStr);
        if (!userId || isNaN(userId)) continue;
        
        // Skip banned users during broadcast!
        const cachedUser = userActivity.get(userId);
        if (cachedUser && cachedUser.isBanned) continue;

        try {
          if (imageUrl && imageUrl.trim() !== "") {
            await bot.telegram.sendPhoto(userId, imageUrl, { caption: message });
          } else {
            await bot.telegram.sendMessage(userId, message);
          }
          sentCount++;
        } catch (error) {
          await handleBroadcastError(userId, error);
          failedCount++;
        }
      }

      res.json({ success: true, sentCount, failedCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Toggle Ban User API
  app.post("/api/users/ban", requireAdmin, async (req, res) => {
    const { userId, isBanned } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const uId = Number(userId);
    const existing = userActivity.get(uId);
    
    // Even if user not fully in cache, track them as banned if they are real
    const finalUser = existing || {
      timestamp: Date.now(),
      testsTaken: 0,
      averageScore: 0,
      isBanned: false
    } as UserData;

    finalUser.isBanned = !!isBanned;
    userActivity.set(uId, finalUser);

    if (db) {
      try {
        await setDoc(doc(db, 'users', userId.toString()), { isBanned: !!isBanned }, { merge: true });
      } catch (e: any) {
        console.error("Failed to commit ban status to Firestore:", e);
      }
    }
    res.json({ success: true, user: finalUser });
  });

  // Get Candidates/Applicants for HR
  app.get("/api/candidates", requireAdmin, (req, res) => {
    res.json(Array.from(candidatesCache.values()));
  });

  // Update Candidate Status & optional notification feedback
  const handleCandidateStatusChange = async (req: any, res: any) => {
    const candidateId = req.params.candidateId || req.body.candidateId;
    const { status, message } = req.body;
    if (!candidateId || !status) {
      return res.status(400).json({ error: "candidateId and status are required" });
    }
    const candidate = candidatesCache.get(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found in cache" });
    }

    candidate.status = status;
    candidatesCache.set(candidateId, candidate);

    if (db) {
      try {
        await setDoc(doc(db, 'candidates', candidateId), { status }, { merge: true });
      } catch (e) {
        console.error("Failed to save candidate status change to Firestore:", e);
      }
    }

    // Send Telegram Notification regarding their status change
    if (bot && message && message.trim() !== "") {
      try {
        await bot.telegram.sendMessage(Number(candidateId), message);
      } catch (err) {
        console.error(`Failed to notify candidate ${candidateId} over telegram:`, err);
      }
    }

    res.json({ success: true, candidate });
  };

  app.post("/api/candidates/status", requireAdmin, handleCandidateStatusChange);
  app.post("/api/candidates/:candidateId/status", requireAdmin, handleCandidateStatusChange);

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
