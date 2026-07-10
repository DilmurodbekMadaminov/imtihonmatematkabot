import express from "express";
import { createServer as createViteServer } from "vite";
import { Telegraf, Markup } from "telegraf";
import path from "path";
import fs from "fs";
import { variants } from "./src/questions.js";
import { mathSections } from "./src/mathSections.js";
import { milliySertifikat } from "./src/milliySertifikat.js";
import { yoshKitobxon } from "./src/yoshKitobxon.js";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, Timestamp, deleteDoc, setLogLevel } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";

// Set firestore log level to suppress idle connection and network stream warnings
setLogLevel('error');

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let db: any = null;
let botUsername = "kitobtanlovbot";

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
  referredBy?: string;
  referralsCount?: number;
  invitedUsers?: string[];
  points?: number;
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
let subCache = new Map<number, { isSubbed: boolean; timestamp: number }>();

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
    isBanned: existing.isBanned || false,
    referredBy: existing.referredBy || "",
    referralsCount: existing.referralsCount || 0,
    invitedUsers: existing.invitedUsers || []
  };
  
  userActivity.set(user.id, data);

  // Optimize Firestore writes: only write if user is new, their critical details changed,
  // or more than 10 minutes have passed since the last write.
  const timeSinceLastWrite = existing.timestamp ? (Date.now() - existing.timestamp) : Infinity;
  const infoChanged = existing.firstName !== data.firstName || 
                      existing.lastName !== data.lastName || 
                      existing.username !== data.username;
                      
  const shouldWrite = !existing.timestamp || infoChanged || (timeSinceLastWrite > 10 * 60 * 1000);

  if (db && shouldWrite) {
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



async function trackTestResult(userId: number, percentage: number, testId: string = "general", testTitle: string = "Ushbu test") {
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
      
      // Save specific result details for certificate check
      const resultDocId = `${userId}_${testId}`;
      await setDoc(doc(db, 'quiz_results', resultDocId), {
        userId,
        testId,
        testTitle,
        percentage,
        firstName: existing.firstName || "",
        lastName: existing.lastName || "",
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('Error saving test result to Firestore:', e);
    }
  }
}



interface UserSession {
  type: 'majburiy' | 'matematika' | 'milliy' | 'yosh_kitobxon' | 'custom';
  variantIndex?: number;
  sectionId?: string;
  sectionVariantIndex?: number;
  testId?: string;
  currentQuestion: number;
  answers: number[];
}

const sessions = new Map<number, UserSession>();
const adminState = new Map<number, string>();

const getUserReferralCount = (userId: number): number => {
  const user = userActivity.get(userId);
  if (!user) return 0;
  return Array.isArray(user.invitedUsers) ? user.invitedUsers.length : (user.referralsCount || 0);
};

const getRequiredReferrals = (): number => {
  return 0;
};

// Check if user is an admin by env or record
const checkIsAdmin = (idStr: string): boolean => {
  const userIdNum = Number(idStr);
  return userIdNum === 7858117466;
};

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

      // Real-time membership updates for ultra-fast, microsecond-level synchronization
      bot.on('chat_member', async (ctx) => {
        try {
          const chatMember = ctx.chatMember;
          if (!chatMember) return;
          const userId = chatMember.from.id;
          const status = chatMember.new_chat_member.status;
          const isSubscribed = ['creator', 'administrator', 'member', 'restricted'].includes(status);
          
          console.log(`[Subscription Change] Real-time event: User ${userId} status on chat ${ctx.chat.id} changed to ${status}. Subscribed: ${isSubscribed}`);
          subCache.set(userId, { isSubbed: isSubscribed, timestamp: Date.now() });
        } catch (err) {
          console.error("Error in real-time chat_member handler:", err);
        }
      });

      bot.on('my_chat_member', async (ctx) => {
        try {
          const chatMember = ctx.myChatMember;
          if (!chatMember) return;
          const userId = chatMember.from.id;
          const status = chatMember.new_chat_member.status;
          const isSubscribed = ['creator', 'administrator', 'member', 'restricted'].includes(status);
          
          console.log(`[Bot Membership Change] Real-time event: Bot/User status changed to ${status}. Subscribed: ${isSubscribed}`);
          subCache.set(userId, { isSubbed: isSubscribed, timestamp: Date.now() });
        } catch (err) {
          console.error("Error in real-time my_chat_member handler:", err);
        }
      });
      
      bot.telegram.getMe().then((me) => {
        if (me && me.username) {
          botUsername = me.username;
          console.log(`Telegram Bot username fetched dynamically: @${botUsername}`);
        }
      }).catch(err => {
        console.error("Error fetching bot info from Telegram:", err);
      });
      
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



      const checkSubscription = async (ctx: any, forceFresh: boolean = false): Promise<boolean> => {
        try {
          const userId = ctx.from?.id;
          if (!userId) return false;

          // Admin check (admins bypass subscription requirements completely)
          if (checkIsAdmin(userId.toString())) {
            return true;
          }

          // Use cache if not forcing fresh verification (Indefinite/ultra-high speed lookup, kept in-sync via real-time chat_member updates)
          if (!forceFresh) {
            const cached = subCache.get(userId);
            if (cached !== undefined) {
              return cached.isSubbed;
            }
          }
          
          const channels = globalSettings.channels && globalSettings.channels.length > 0
            ? globalSettings.channels 
            : [globalSettings.channelUsername];

          const validChannels = channels.map(ch => ch.trim()).filter(ch => ch !== '');
          if (validChannels.length === 0) {
            subCache.set(userId, { isSubbed: true, timestamp: Date.now() });
            return true;
          }

          // Paralel ravishda barcha kanallarni tekshiramiz (maksimal tezlik - 1 soniya ichida)
          const results = await Promise.all(
            validChannels.map(async (channel) => {
              try {
                const member = await ctx.telegram.getChatMember(channel, userId);
                return ['creator', 'administrator', 'member', 'restricted'].includes(member.status);
              } catch (error: any) {
                const errMsg = String(error?.message || error?.description || '').toLowerCase();
                if (
                  errMsg.includes('member list is inaccessible') ||
                  errMsg.includes('chat not found') ||
                  errMsg.includes('forbidden') ||
                  errMsg.includes('not found') ||
                  errMsg.includes('not a member') ||
                  errMsg.includes('bad request')
                ) {
                  console.warn(`Note: Could not check subscription for ${channel} (falling back to true):`, errMsg);
                  // Fallback to true to prevent blocking/breaking the bot when a user or inaccessible channel is added
                  return true;
                }
                console.error(`Error checking subscription for ${channel}:`, error);
                return false;
              }
            })
          );

          const isSubbed = results.every(isSubbed => isSubbed === true);
          subCache.set(userId, { isSubbed, timestamp: Date.now() });
          return isSubbed;
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
      const sendReferralStats = async (ctx: any) => {
        const userId = ctx.from?.id;
        if (!userId) return;
        const refCount = getUserReferralCount(userId);
        const requiredRef = getRequiredReferrals();
        const shareLink = `https://t.me/${botUsername}?start=ref_${userId}`;
        
        let text = `🎁 *Hamkorlik (Referal) Dasturi:*\n\n` +
          `Siz taklif etgan a'zolar soni: *${refCount}* ta\n` +
          `Testni ishlash imkonini ochish uchun jami: *${requiredRef}* ta taklif kerak.\n\n` +
          (refCount >= requiredRef 
            ? `✅ *Barcha testlar siz uchun ochiq!*` 
            : `⏳ *Yana ${requiredRef - refCount} ta a'zo qo'shishingiz kerak.*`
          ) + 
          `\n\n🔗 *Sizning taklif havolangiz:*\n\`${shareLink}\`\n\n` +
          `Ushbu havolani do'stlaringizga ulashing. Yangi testlar yuklanganida ulardan foydalanish uchun qo'shimcha a'zo taklif etishingiz zarur bo'ladi.`;

        const inlineBtn = Markup.inlineKeyboard([
          [Markup.button.url("🚀 Do'stlarga ulashish", `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent("Matematika imtihon botidan bepul test yechib sertifikat oling!")}`)]
        ]);

        await ctx.reply(text, { parse_mode: "Markdown", ...inlineBtn }).catch(console.error);
      };

      const getMainMenuKeyboard = () => {
        return Markup.inlineKeyboard([
          [Markup.button.callback("📕 Majburiy Matematika (370 ta test)", "menu_majburiy")],
          [Markup.button.callback("🧮 Matematika (Ixtisoslik bo'limlari)", "menu_matematika")],
          [Markup.button.callback("🎓 Milliy Sertifikat imtihonlari", "menu_milliy")],
          [Markup.button.callback("📚 Yosh kitobxon (30 ta test)", "menu_yosh_kitobxon")]
        ]);
      };

      const getPersistentKeyboard = (userId: number) => {
        const refCount = getUserReferralCount(userId);
        const isAdmin = checkIsAdmin(userId.toString());
        const requiredRef = getRequiredReferrals();
        
        if (refCount < requiredRef && !isAdmin) {
          return Markup.keyboard([
            ["🎁 Referal Bo'limi"]
          ]).resize();
        } else {
          return Markup.keyboard([
            ["📕 Majburiy Matematika", "🎓 Milliy Sertifikat"],
            ["🧮 Matematika (Ixtisoslik)", "📚 Yosh kitobxon"],
            ["🎁 Referal Bo'limi"]
          ]).resize();
        }
      };

      // Obuna bo'lmagan foydalanuvchilarning barcha so'rovlarini to'xatuvchi va tezkor tekshiruvchi middleware
      bot.use(async (ctx, next) => {
        if (!ctx.from) return next();
        
        const isCheckSub = ctx.callbackQuery && 'data' in ctx.callbackQuery && ctx.callbackQuery.data === 'check_sub';
        if (isCheckSub) {
          return next();
        }

        const userId = ctx.from.id;
        const isAdmin = checkIsAdmin(userId.toString());
        if (isAdmin) {
          return next();
        }

        // Allow start command and referral queries
        const messageText = ctx.message && ('text' in ctx.message) ? ctx.message.text : "";
        const isStart = messageText.startsWith("/start");
        const isReferralAction = messageText.includes("Referal") || messageText.includes("Taklif") || (ctx.callbackQuery && 'data' in ctx.callbackQuery ? (ctx.callbackQuery as any).data.includes("referral") : false);
        
        if (isStart || isReferralAction) {
          return next();
        }

        // Check subscription
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          if (ctx.callbackQuery) {
            await ctx.answerCbQuery("Iltimos, avval barcha majburiy kanallarga obuna bo'ling!", { show_alert: true }).catch(() => {});
          }
          return sendSubscriptionPrompt(ctx);
        }

        // Check referral count
        const refCount = getUserReferralCount(userId);
        const requiredRef = getRequiredReferrals();
        if (refCount < requiredRef) {
          if (ctx.callbackQuery) {
            await ctx.answerCbQuery(`⚠️ Testni boshlash uchun kamida ${requiredRef} ta do'stingizni taklif qiling!`, { show_alert: true }).catch(() => {});
          }
          return sendReferralStats(ctx);
        }

        return next();
      });

      bot.start(async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        try {
          // Check if starting with an invite payload
          const messageText = ctx.message && ('text' in ctx.message) ? ctx.message.text : "";
          let startPayload = (ctx as any).payload || ctx.startPayload || "";
          if (!startPayload && messageText.startsWith("/start ")) {
            startPayload = messageText.substring(7).trim();
          }

          let invitedByReferrerName = "";
          
          if (startPayload && startPayload.startsWith("ref_")) {
            const referrerIdStr = startPayload.replace("ref_", "");
            const referrerId = Number(referrerIdStr);
            
            if (!isNaN(referrerId) && referrerId !== userId) {
              // Verify if the user is completely new (not in cache and not in Firestore)
              let isNewUser = !userActivity.has(userId);
              if (isNewUser && db) {
                try {
                  const uSnap = await getDoc(doc(db, 'users', userId.toString()));
                  if (uSnap.exists()) {
                    isNewUser = false;
                    userActivity.set(userId, uSnap.data() as UserData);
                  }
                } catch (e) {
                  console.error("Safe user DB check failed:", e);
                }
              }

              // Check cache (ultra-fast, non-blocking)
              const cachedUser = userActivity.get(userId);
              const alreadyReferred = cachedUser?.referredBy;
              
              if (isNewUser && !alreadyReferred) {
                let refData = userActivity.get(referrerId);
                
                // Fallback to safe DB read if referrer is not in cache (highly unlikely)
                if (!refData && db) {
                  try {
                    const rSnap = await getDoc(doc(db, 'users', referrerIdStr));
                    if (rSnap.exists()) {
                      refData = rSnap.data() as UserData;
                    }
                  } catch (e) {
                    console.error("Safe referrer DB check failed:", e);
                  }
                }
                
                if (refData) {
                  invitedByReferrerName = refData.firstName || refData.username || "";
                  
                  // Update current user cache
                  if (cachedUser) {
                    cachedUser.referredBy = referrerIdStr;
                  } else {
                    userActivity.set(userId, {
                      timestamp: Date.now(),
                      firstName: ctx.from.first_name || "",
                      lastName: ctx.from.last_name || "",
                      username: ctx.from.username || "",
                      testsTaken: 0,
                      averageScore: 0,
                      isAdmin: false,
                      isBanned: false,
                      referredBy: referrerIdStr,
                      referralsCount: 0,
                      invitedUsers: []
                    });
                  }
                  
                  // Update referrer's list
                  const invited = Array.isArray(refData.invitedUsers) ? [...refData.invitedUsers] : [];
                  if (!invited.includes(userId.toString())) {
                    invited.push(userId.toString());
                    const referralsCount = invited.length;
                    
                    refData.invitedUsers = invited;
                    refData.referralsCount = referralsCount;
                    userActivity.set(referrerId, refData);
                    
                    // Asynchronously save to Firestore (non-blocking for speed)
                    if (db) {
                      const userRef = doc(db, 'users', userId.toString());
                      const referrerRef = doc(db, 'users', referrerIdStr);
                      
                      setDoc(userRef, { referredBy: referrerIdStr }, { merge: true })
                        .catch(err => console.error("Async DB update for referred user failed:", err));
                        
                      setDoc(referrerRef, { 
                        invitedUsers: invited,
                        referralsCount: referralsCount
                      }, { merge: true })
                        .catch(err => console.error("Async DB update for referrer failed:", err));
                    }

                    // Notify referrer safely
                    try {
                      const requiredRef = getRequiredReferrals();
                      ctx.telegram.sendMessage(
                        referrerId, 
                        `🎉 *Yangi a'zo taklif qilindi!*\n\n` +
                        `Foydalanuvchi: *${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}* (@${ctx.from?.username || "username_yoq"})\n` +
                        `Siz taklif etgan joriy do'stlar soni: *${referralsCount} / ${requiredRef}* ta.\n` + 
                        (referralsCount >= requiredRef 
                          ? `🏆 *Tabriklaymiz!* Siz ${requiredRef} ta a'zo taklif qildingiz va barcha matematika testlari muvaffaqiyatli ochildi!` 
                          : `🎯 Testlarni ochish uchun yana *${requiredRef - referralsCount}* ta a'zo qo'shishingiz kerak.`
                        ),
                        { parse_mode: "Markdown" }
                      ).catch(() => {});
                    } catch (err) {}
                  }
                }
              }
            }
          }

          // Register user activity (runs asynchronously so user gets instant welcome)
          trackUser(ctx.from).catch(err => console.error("Safe trackUser failed:", err));

          const isAdmin = checkIsAdmin(userId.toString());
          const refCount = getUserReferralCount(userId);
          
          let welcomeHeading = "Salom! Matematika imtihon botiga xush kelibsiz.";
          if (invitedByReferrerName) {
            welcomeHeading = `Salom! Sizni taklif qilgan do'stingiz: *${invitedByReferrerName}*. Matematika imtihon botiga xush kelibsiz! 🎉`;
          }

          const requiredRef = getRequiredReferrals();
          if (refCount < requiredRef && !isAdmin) {
            await ctx.replyWithMarkdown(
              `${welcomeHeading}\n\n` +
              `⚠️ Botdagi matematika testlarini yechish uchun kamida ${requiredRef} ta do'stingizni taklif qilishingiz kerak!\n\n` +
              `Siz taklif etgan do'stlar soni: ${refCount} / ${requiredRef} ta.`,
              getPersistentKeyboard(userId)
            );
            await sendReferralStats(ctx);
          } else {
            await ctx.replyWithMarkdown(
              `${welcomeHeading}\n\n` +
              "🎉 Barcha matematika testlari siz uchun ochiq! Ularni quyidagi bot menyusi tugmalari yordamida ishlashingiz mumkin.",
              getPersistentKeyboard(userId)
            );
          }
        } catch (startError) {
          console.error("Critical error in bot.start handler:", startError);
          try {
            await ctx.reply("Tizimda kichik texnik muammo yuz berdi. Iltimos, qaytadan urinib ko'ring yoki /start buyrug'ini bosing.");
          } catch (_) {}
        }
      });

      bot.hears(["🎁 Referal Bo'limi (Taklif havolasi)", "🎁 Referal Bo'limi"], async (ctx) => {
        const userId = ctx.from?.id;
        if (userId) {
          await ctx.reply("Menyu yangilandi:", getPersistentKeyboard(userId)).catch(() => {});
        }
        await sendReferralStats(ctx);
      });

      bot.hears(["📕 Majburiy Matematika", "Majburiy Matematika", "majburiy matematika"], async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const userId = ctx.from?.id;
        if (userId) {
          await ctx.reply("Menyu yangilandi:", getPersistentKeyboard(userId)).catch(() => {});
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

        const userId = ctx.from?.id;
        if (userId) {
          await ctx.reply("Menyu yangilandi:", getPersistentKeyboard(userId)).catch(() => {});
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

        const userId = ctx.from?.id;
        if (userId) {
          await ctx.reply("Menyu yangilandi:", getPersistentKeyboard(userId)).catch(() => {});
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

      bot.hears(["📚 Yosh kitobxon", "Yosh kitobxon", "yosh kitobxon"], async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const userId = ctx.from?.id;
        if (userId) {
          await ctx.reply("Menyu yangilandi:", getPersistentKeyboard(userId)).catch(() => {});
        }

        const buttons: any[][] = [];
        yoshKitobxon.forEach((v, i) => {
          buttons.push([Markup.button.callback(v.title, `start_yosh_kitobxon_${i}`)]);
        });
        buttons.push([Markup.button.callback("↩️ Orqaga", "main_menu")]);

        await ctx.reply(
          "📚 Yosh kitobxon kitoblaridan birini tanlang:",
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
        } else if (session.type === 'yosh_kitobxon' && session.variantIndex !== undefined) {
          questions = yoshKitobxon[session.variantIndex].questions;
          title = yoshKitobxon[session.variantIndex].title;
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

        const userId = ctx.from?.id;
        if (userId) {
          await ctx.reply("Menyu yangilandi:", getPersistentKeyboard(userId)).catch(() => {});
        }

        await ctx.reply(
          "Bo'limni tanlang:",
          getMainMenuKeyboard()
        ).catch(() => {});
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

        if (userId !== 7858117466) {
          return ctx.reply("❌ Ruxsat etilmagan! Ushbu buyruqdan faqat bosh admin foydalana oladi.");
        }

        // Auto-promote 7858117466 to admin if not already done
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
        const isSubscribed = await checkSubscription(ctx, true);
        if (isSubscribed) {
          await ctx.deleteMessage().catch(() => {});
          const userId = ctx.from?.id;
          if (userId) {
            await ctx.reply("Rahmat! Obuna tasdiqlandi. Menyu tugmalari yangilandi.", getPersistentKeyboard(userId)).catch(() => {});
          }
          await ctx.reply(
            "Quyidagilardan birini tanlang:",
            getMainMenuKeyboard()
          ).catch(() => {});
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

      bot.action('menu_yosh_kitobxon', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const buttons: any[][] = [];
        yoshKitobxon.forEach((v, i) => {
          buttons.push([Markup.button.callback(v.title, `start_yosh_kitobxon_${i}`)]);
        });

        buttons.push([Markup.button.callback("↩️ Orqaga", "main_menu")]);

        await ctx.editMessageText(
          "📚 Yosh kitobxon kitoblaridan birini tanlang:",
          Markup.inlineKeyboard(buttons)
        ).catch(() => {});
        await ctx.answerCbQuery();
      });

      bot.action(/start_yosh_kitobxon_(\d+)/, async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        const chatId = ctx.chat?.id;
        if (!chatId) return;
        const variantIndex = parseInt(ctx.match[1]);
        sessions.set(chatId, { 
          type: 'yosh_kitobxon', 
          variantIndex, 
          currentQuestion: 0, 
          answers: [] 
        });
        await sendQuestion(ctx, chatId);
      });

      bot.action('main_menu', async (ctx) => {
        const userId = ctx.from?.id;
        if (userId) {
          await ctx.reply("Bosh menyu:", getPersistentKeyboard(userId)).catch(() => {});
        }
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
        } else if (session.type === 'yosh_kitobxon' && session.variantIndex !== undefined) {
          questions = yoshKitobxon[session.variantIndex].questions;
          title = yoshKitobxon[session.variantIndex].title;
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

          let testId = "general";
          if (session.type === 'majburiy' && session.variantIndex !== undefined) {
            testId = `majburiy_${session.variantIndex}`;
          } else if (session.type === 'milliy' && session.variantIndex !== undefined) {
            testId = `milliy_${session.variantIndex}`;
          } else if (session.type === 'yosh_kitobxon' && session.variantIndex !== undefined) {
            testId = `yosh_kitobxon_${session.variantIndex}`;
          } else if (session.type === 'matematika' && session.sectionId && session.sectionVariantIndex !== undefined) {
            testId = `matematika_${session.sectionId}_${session.sectionVariantIndex}`;
          } else if (session.type === 'custom' && session.testId !== undefined) {
            testId = session.testId;
          }

          await trackTestResult(chatId, percentage, testId, title);

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

          await ctx.reply(resultText, getPersistentKeyboard(chatId)).catch(() => {});
          await ctx.reply("Quyidagilardan birini tanlang:", getMainMenuKeyboard()).catch(() => {});
          
          sessions.delete(chatId);
        }
      });

      // Catch-all message fallback to ensure users' keyboards are updated automatically
      bot.on('message', async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        // If user is inside an active test session, do not interrupt
        if (sessions.has(userId)) {
          return ctx.reply("Siz hozirda test yechayapsiz. Iltimos, inline tugmalar orqali savollarga javob bering.").catch(() => {});
        }

        // If user is an admin and has an admin state, hand over to the admin state handler
        const state = adminState.get(userId);
        if (state) {
          return next();
        }

        // Check subscription
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }

        // Check referral count if required
        const refCount = getUserReferralCount(userId);
        const requiredRef = getRequiredReferrals();
        const isAdmin = checkIsAdmin(userId.toString());

        if (refCount < requiredRef && !isAdmin) {
          await ctx.reply("Sizning ma'lumotlaringiz yangilandi!", getPersistentKeyboard(userId)).catch(() => {});
          return sendReferralStats(ctx);
        }

        // Automatically update the user's persistent bottom keyboard with latest buttons
        await ctx.reply("Bosh menyu tugmalari yangilandi!", getPersistentKeyboard(userId)).catch(() => {});

        // Show main menu
        await ctx.reply(
          "Quyidagilardan birini tanlang:",
          getMainMenuKeyboard()
        ).catch(() => {});
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
            await bot!.launch({
              dropPendingUpdates: true,
              allowedUpdates: ['message', 'callback_query', 'chat_member', 'my_chat_member']
            });
            console.log("Telegram bot launched in Polling mode with real-time membership listeners.");
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
    return telegramId === 7858117466;
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

  // Parse O'zbek matematika test pdf booklets using Gemini AI
  app.post("/api/tests/parse-pdf", requireAdmin, async (req, res) => {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: "PDF fayli kiritilmadi" });
    }
    
    try {
      const gKey = process.env.GEMINI_API_KEY;
      if (!gKey) {
        return res.status(500).json({ error: "Gemini API kaliti aniqlanmadi. Iltimos Secrets panelidan sozlashingiz mumkin." });
      }

      const ai = new GoogleGenAI({
        apiKey: gKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: pdfBase64,
              mimeType: "application/pdf"
            }
          },
          {
            text: `Iltimos, ushbu O'zbek tilidagi matematika test PDF-hujjatidan 30 tadan 50 tagacha bo'lgan test savollarini professional tarzda o'qing va ajratib oling.
            Har bir savol uchun quyidagi struktura bo'yicha toza va to'liq formatlangan JSON massivini qaytaring.

            Talablar:
            - Har bir savolda aynan 4 ta javob varianti bo'lishi kerak ("options" massivida 4 ta satr).
            - "correct" maydoni to'g'ri javobning indeksidir (0=A, 1=B, 2=C, 3=D). U butun son (integer) bo'lishi kerak.
            - Hujjatda yechim bor bo'lsa, uni ignor qiling, faqat savolning o'zini va javob variantlarini oling.
            - Hech qanday boshqa matn, tushuntirish yoki markdown block qo'shmang! Faqat to'g'ridan-to'g'ri JSON qaytaring.`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { 
                      type: Type.STRING
                    },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    correct: { 
                      type: Type.INTEGER
                    }
                  },
                  required: ["text", "options", "correct"]
                }
              }
            },
            required: ["questions"]
          }
        }
      });

      const textOutput = response.text || "";
      const parsedData = JSON.parse(textOutput);
      res.json({ success: true, questions: parsedData.questions || [] });
    } catch (err: any) {
      console.error("PDF parse error:", err);
      res.status(500).json({ error: err.message || "PDF tahlilida kutilmagan xatolik yuz berdi." });
    }
  });

  app.post("/api/tests", requireAdmin, async (req, res) => {
    const { category, title, questions, sectionId } = req.body;
    if (!category || !title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Ma'lumotlar to'liq kiritilmadi" });
    }
    try {
      const durationLimit = typeof req.body.durationLimit === 'number' ? req.body.durationLimit : 60;
      const expiresAt = Date.now() + durationLimit * 60 * 1000;

      const newTestId = `test_${Date.now()}`;
      const newTest = {
        id: newTestId,
        category,
        title,
        sectionId: sectionId || undefined,
        durationLimit,
        expiresAt,
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

  // Client Web App integrations (No requireAdmin required since called by normal Web App users)
  app.get("/api/web-app/referrals", async (req, res) => {
    try {
      const userIdStr = req.query.userId?.toString();
      if (!userIdStr) {
        return res.status(400).json({ success: false, error: "userId required" });
      }
      const userId = Number(userIdStr);
      const referralsCount = getUserReferralCount(userId);
      const requiredReferrals = getRequiredReferrals();
      const isAdmin = checkIsAdmin(userIdStr);
      res.json({
        success: true,
        referralsCount,
        requiredReferrals,
        isAdmin
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/web-app/user-data", async (req, res) => {
    const userIdStr = req.query.userId?.toString();
    if (!userIdStr) {
      return res.status(400).json({ error: "userId required" });
    }
    const userId = Number(userIdStr);
    
    let user = userActivity.get(userId);
    if (!user && db) {
      try {
        const docSnap = await getDoc(doc(db, "users", userIdStr));
        if (docSnap.exists()) {
          user = docSnap.data() as UserData;
          userActivity.set(userId, user);
        }
      } catch (e) {}
    }

    if (!user) {
      user = {
        timestamp: Date.now(),
        firstName: "Telegram Foydalanuvchi",
        lastName: "",
        username: "",
        testsTaken: 0,
        averageScore: 0,
        referralsCount: 0,
        invitedUsers: []
      };
    }

    const results: any[] = [];
    if (db) {
      try {
        const snap = await getDocs(query(collection(db, "quiz_results"), where("userId", "==", userId)));
        snap.forEach(dSnap => {
          results.push(dSnap.data());
        });
      } catch (e) {
        console.error("Error fetching user quiz results:", e);
      }
    }

    res.json({
      success: true,
      user,
      results,
      botUsername,
      customTests: customTests.map(t => ({
        id: t.id,
        category: t.category,
        title: t.title,
        sectionId: t.sectionId,
        durationLimit: t.durationLimit || 60,
        expiresAt: t.expiresAt || (t.timestamp + 3600 * 1000),
        questionsCount: t.questions?.length || 0,
        questions: t.questions || [],
        timestamp: t.timestamp
      }))
    });
  });

  app.post("/api/web-app/submit-result", async (req, res) => {
    const { userId, testId, testTitle, percentage } = req.body;
    if (!userId || !testId || percentage === undefined) {
      return res.status(400).json({ error: "Incomplete post data" });
    }

    try {
      await trackTestResult(Number(userId), Number(percentage), testId, testTitle);
      res.json({ success: true });
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

  // Award Bonus Points API
  app.post("/api/users/award-points", requireAdmin, async (req, res) => {
    const { userId, points } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const amount = Number(points);
    if (isNaN(amount)) {
      return res.status(400).json({ error: "points must be a valid number" });
    }
    const uId = Number(userId);
    const existing = userActivity.get(uId);

    const finalUser = existing || {
      timestamp: Date.now(),
      testsTaken: 0,
      averageScore: 0,
      isBanned: false,
      points: 0
    } as UserData;

    finalUser.points = (finalUser.points || 0) + amount;
    userActivity.set(uId, finalUser);

    if (db) {
      try {
        await setDoc(doc(db, 'users', userId.toString()), { points: finalUser.points }, { merge: true });
      } catch (e: any) {
        console.error("Failed to update points in Firestore:", e);
      }
    }

    // Try to notify the user via Telegram bot
    try {
      await bot.telegram.sendMessage(
        uId,
        `🎁 Admin tomonidan sizga *${amount}* bonus ball berildi! 🎉\n` +
        `Sizning umumiy ballaringiz: *${finalUser.points}* ball.`,
        { parse_mode: 'Markdown' }
      );
    } catch (telegramError) {
      console.log(`Could not notify user ${uId} via telegram:`, telegramError);
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
