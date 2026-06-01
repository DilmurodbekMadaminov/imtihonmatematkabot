import express from "express";
import { createServer as createViteServer } from "vite";
import { Telegraf, Markup } from "telegraf";
import path from "path";
import fs from "fs";
import { variants } from "./src/questions.js";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import multer from "multer";

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

// Multer and local Uploads configuration
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_'));
  }
});
const upload = multer({ storage: storage });

export interface PdfTest {
  id: string;
  title: string;
  pdfUrl: string;
  answers: string;
  questionsCount: number;
  createdAt: number;
}

export interface PdfSession {
  testId: string;
  currentQuestion: number;
  answers: string[];
}

const pdfSessions = new Map<number, PdfSession>();
const userStates = new Map<number, string>(); // tracks user states, e.g., 'calculator'
let pdfTestsInMemory: PdfTest[] = [];

function parseAnswerKey(text: string): string {
  let cleaned = text.trim().toLowerCase();
  
  // Try to match "1-a, 2-b, 3-c" or "1:a, 2:b" etc.
  const pairedMatches = [...cleaned.matchAll(/(\d+)[\s-:]*([a-d])/g)];
  if (pairedMatches.length > 0) {
    pairedMatches.sort((a, b) => parseInt(a[1]) - parseInt(b[1]));
    return pairedMatches.map(m => m[2]).join('');
  }
  
  return cleaned.replace(/[^a-d]/g, '');
}

async function loadPdfTests(): Promise<PdfTest[]> {
  if (db) {
    try {
      const q = query(collection(db, 'pdf_tests'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PdfTest));
      list.sort((a, b) => b.createdAt - a.createdAt);
      pdfTestsInMemory = list;
      return list;
    } catch (e) {
      console.error("Error loading pdf tests from Firestore:", e);
    }
  }
  return pdfTestsInMemory;
}

async function addPdfTest(test: PdfTest) {
  const index = pdfTestsInMemory.findIndex(t => t.id === test.id);
  if (index === -1) {
    pdfTestsInMemory.push(test);
  } else {
    pdfTestsInMemory[index] = test;
  }
  pdfTestsInMemory.sort((a, b) => b.createdAt - a.createdAt);
  if (db) {
    try {
      await setDoc(doc(db, 'pdf_tests', test.id), test);
    } catch (e) {
      console.error("Error saving pdf test to Firestore:", e);
    }
  }
}

async function removePdfTest(id: string): Promise<boolean> {
  const index = pdfTestsInMemory.findIndex(t => t.id === id);
  if (index === -1) return false;
  const test = pdfTestsInMemory[index];
  pdfTestsInMemory.splice(index, 1);
  
  if (db) {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'pdf_tests', id));
    } catch (e) {
      console.error("Error deleting pdf test from Firestore:", e);
    }
  }
  
  try {
    const filename = path.basename(test.pdfUrl);
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Error deleting physical pdf file:", err);
  }
  return true;
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
  channels: ['@dilmurodbekmatematika'],
  mandatoryTestsEnabled: true,
  otherSectionEnabled: true,
  otherSectionTitle: "ℹ️ Ma'lumot va Qoidalar",
  otherSectionContent: "📝 **Botdan foydalanish qoidalari va yordam:**\n\n1. Har bir testni diqqat bilan yeching.\n2. Natijalar avtomatik ravishda saqlanadi.\n3. Har bir savol uchun belgilangan vaqt cheklanmagan."
};

const getMainMenuKeyboard = () => {
  const buttons: any[][] = [];
  const row1: any[] = [];
  
  if (globalSettings.mandatoryTestsEnabled !== false) {
    row1.push("📝 Testlar Bo'limi");
  }
  if (row1.length > 0) {
    buttons.push(row1);
  }

  const row2: any[] = [];
  if (globalSettings.otherSectionEnabled !== false) {
    row2.push(globalSettings.otherSectionTitle || "ℹ️ Ma'lumot va Qoidalar");
  }
  if (row2.length > 0) {
    buttons.push(row2);
  }
  
  return Markup.keyboard(buttons).resize();
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
          if (Array.isArray(data.channels)) {
            globalSettings.channels = data.channels;
          } else if (data.channelUsername) {
            globalSettings.channels = [data.channelUsername];
          }
          
          globalSettings.mandatoryTestsEnabled = data.mandatoryTestsEnabled !== undefined ? !!data.mandatoryTestsEnabled : true;
          globalSettings.otherSectionEnabled = data.otherSectionEnabled !== undefined ? !!data.otherSectionEnabled : true;
          globalSettings.otherSectionTitle = data.otherSectionTitle || "ℹ️ Ma'lumot va Qoidalar";
          globalSettings.otherSectionContent = data.otherSectionContent || globalSettings.otherSectionContent;

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
  variantIndex: number;
  currentQuestion: number;
  answers: number[];
}

const sessions = new Map<number, UserSession>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load configuration and prime the local cache on startup
  await loadSettings();
  await loadPdfTests();
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

  // Intercept domain to set baseUrl dynamically for file downloads
  app.use((req, res, next) => {
    if (req.get('host') && !(globalSettings as any).baseUrl) {
      (globalSettings as any).baseUrl = `${req.protocol}://${req.get('host')}`;
    }
    next();
  });

  app.use(express.json());
  app.use('/uploads', express.static(uploadsDir));

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

  // Admin-specific custom sections settings
  app.get('/api/admin/settings', async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || '1';
    
    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json(globalSettings);
  });

  app.post('/api/admin/settings', async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || '1';
    
    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const { 
        channels,
        mandatoryTestsEnabled, 
        otherSectionEnabled, 
        otherSectionTitle, 
        otherSectionContent 
      } = req.body;

      if (Array.isArray(channels)) {
        globalSettings.channels = channels;
        if (channels.length > 0) {
          globalSettings.channelUsername = channels[0];
        }
      }

      if (mandatoryTestsEnabled !== undefined) globalSettings.mandatoryTestsEnabled = !!mandatoryTestsEnabled;
      if (otherSectionEnabled !== undefined) globalSettings.otherSectionEnabled = !!otherSectionEnabled;
      if (otherSectionTitle !== undefined) globalSettings.otherSectionTitle = otherSectionTitle;
      if (otherSectionContent !== undefined) globalSettings.otherSectionContent = otherSectionContent;

      if (db) {
        await setDoc(doc(db, 'settings', 'config'), globalSettings, { merge: true });
      }
      
      res.json({ success: true, settings: globalSettings });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Xatolik yuz berdi' });
    }
  });

  // PDF Tests APIs
  app.get('/api/pdf-tests', async (req, res) => {
    try {
      const list = await loadPdfTests();
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: 'Xatolik yuz berdi' });
    }
  });

  app.post('/api/admin/pdf-tests', upload.single('pdf'), async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || '1';
    
    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const { title, answers } = req.body;
      if (!title || !answers || !req.file) {
        return res.status(400).json({ error: "Sarlavha, javoblar kaliti va PDF ko'rinishidagi fayl majburiy!" });
      }
      
      const parsedAnswers = parseAnswerKey(answers);
      if (parsedAnswers.length === 0) {
        return res.status(400).json({ error: "Javoblar kaliti noto'g'ri. Faqat a, b, c, d harflarini kiriting!" });
      }
      
      const fileUrl = `/uploads/${req.file.filename}`;
      
      const newTest: PdfTest = {
        id: 'pdf_' + Date.now().toString(),
        title: title.trim(),
        pdfUrl: fileUrl,
        answers: parsedAnswers,
        questionsCount: parsedAnswers.length,
        createdAt: Date.now()
      };
      
      await addPdfTest(newTest);
      res.status(201).json(newTest);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Server xatoligi' });
    }
  });

  app.delete('/api/admin/pdf-tests/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || '1';
    
    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const deleted = await removePdfTest(req.params.id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Test topilmadi' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Server xatoligi' });
    }
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
        const appUrl = process.env.VITE_APP_URL || 'https://ais-dev-zwxesqr7uajqrp3m5f64nl-286796810075.asia-east1.run.app';
        return Markup.inlineKeyboard([
          [Markup.button.callback("📊 Statistika", "admin_stats"), Markup.button.callback("👥 Foydalanuvchilar", "admin_users")],
          [Markup.button.callback("📢 E'lon yuborish", "admin_broadcast"), Markup.button.callback("⚙️ Kanalni sozlash", "admin_channel")],
          [Markup.button.webApp("🌐 Web Admin Panel", `${appUrl}/admin`)],
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

        const msgText = ctx.message.text ? ctx.message.text.trim() : "";
        
        // Handle bottom menu button triggers (unless it's an command starting with '/')
        if (msgText === "📝 Testlar Bo'limi") {
          userStates.delete(userId);
          const isSubscribed = await checkSubscription(ctx);
          if (!isSubscribed) {
            return sendSubscriptionPrompt(ctx);
          }
          const buttons = [
            [Markup.button.callback("🏛 Online Testlar", "choose_online_tests")],
            [Markup.button.callback("📂 PDF Testlar", "choose_pdf_tests")]
          ];
          return ctx.reply("🏛 Testlar Bo'limiga xush kelibsiz! Qaysi test turidan foydalanmoqchisiz?", Markup.inlineKeyboard(buttons));
        }

        if (msgText === (globalSettings.otherSectionTitle || "ℹ️ Ma'lumot va Qoidalar")) {
          userStates.delete(userId);
          return ctx.reply(globalSettings.otherSectionContent || '', { parse_mode: 'Markdown' });
        }

        if (msgText.startsWith('/')) {
          return next();
        }

        // PDF Test Text Submission interceptor
        const chatId = ctx.chat?.id;
        if (chatId && pdfSessions.has(chatId)) {
          const pdfSession = pdfSessions.get(chatId)!;
          if (pdfSession.currentQuestion === -1) {
            const list = await loadPdfTests();
            const pTest = list.find(t => t.id === pdfSession.testId);
            if (!pTest) {
              pdfSessions.delete(chatId);
              return ctx.reply("❌ Test topilmadi. Iltimos qaytadan boshlang.");
            }
            
            const inputText = ctx.message.text.trim();
            if (inputText.toLowerCase() === '/cancel' || inputText.toLowerCase() === 'cancel' || inputText === 'bekor qilish') {
              pdfSessions.delete(chatId);
              return ctx.reply("❌ Javob topshirish bekor qilindi.");
            }

            const parsedAnswers = parseAnswerKey(inputText);
            if (parsedAnswers.length === 0) {
              return ctx.reply("❌ Hech qanday javoblar kaliti aniqlanmadi (Masalan: '1a 2b 3c' yoki 'abcd'). Iltimos, qaytadan yuboring yoki bekor qilish uchun /cancel deb yozing:");
            }
            
            if (parsedAnswers.length !== pTest.questionsCount) {
              return ctx.reply(`⚠️ Bu test ${pTest.questionsCount} ta savoldan iborat, lekin siz ${parsedAnswers.length} ta javob yubordingiz.\n\nIltimos, barcha savollarga javoblarni to'liq yuboring (Masalan: 'abcdabcd...'):`);
            }

            let correctCount = 0;
            const correctKey = pTest.answers.toLowerCase();
            const resultsAnalysis: boolean[] = [];
            
            for (let i = 0; i < pTest.questionsCount; i++) {
              const userAns = parsedAnswers[i];
              const correctAns = correctKey[i];
              const correct = (userAns === correctAns);
              resultsAnalysis.push(correct);
              if (correct) correctCount++;
            }
            
            const percentage = Math.round((correctCount / pTest.questionsCount) * 100);
            await trackTestResult(chatId, percentage);

            if (db) {
              try {
                await setDoc(doc(db, 'pdf_test_results', `${chatId}_${pTest.id}`), {
                  userId: chatId,
                  testId: pTest.id,
                  testTitle: pTest.title,
                  correctCount,
                  totalQuestions: pTest.questionsCount,
                  percentage,
                  timestamp: Date.now()
                });
              } catch (e) {
                console.error("Error saving PDF test result to Firestore:", e);
              }
            }

            let resultText = `🎉 **${pTest.title}** muvaffaqiyatli topshirildi!\n\n`;
            resultText += `📊 **Natija:** ${correctCount} / ${pTest.questionsCount} ta to'g'ri (${percentage}%)\n\n`;
            resultText += `📝 **Batafsil tahlil:**\n`;
            
            resultsAnalysis.forEach((isCorrect, i) => {
              resultText += `${i + 1}-savol: ${isCorrect ? "✅ To'g'ri" : `❌ Noto'g'ri (Siz: ${parsedAnswers[i].toUpperCase()}, J: ${correctKey[i].toUpperCase()})`}\n`;
            });

            pdfSessions.delete(chatId);
            return ctx.reply(resultText, { parse_mode: 'Markdown' });
          }
        }

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

      bot.start(async (ctx) => {
        await ctx.reply("👋 Matematika test botimizga xush kelibsiz!", getMainMenuKeyboard());
        
        const buttons = [
          [Markup.button.callback("🏛 Online Testlar", "choose_online_tests")],
          [Markup.button.callback("📂 PDF Testlar", "choose_pdf_tests")]
        ];
        ctx.reply(
          "Iltimos, quyidagi test turidan birini tanlang:",
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

        await ctx.reply("🏛 Onlayn testlar bo'limi:", getMainMenuKeyboard());

        const buttons = variants.map((v, i) => 
          [Markup.button.callback(v.title, `start_variant_${i}`)]
        );
        buttons.push([Markup.button.callback("⬅️ Orqaga", "back_to_main_menu")]);

        ctx.reply(
          "Qaysi online variantni ishlashni xohlaysiz?",
          Markup.inlineKeyboard(buttons)
        );
      });

      bot.action('back_to_main_menu', async (ctx) => {
        const buttons = [
          [Markup.button.callback("🏛 Online Testlar", "choose_online_tests")],
          [Markup.button.callback("📂 PDF Testlar", "choose_pdf_tests")]
        ];
        await ctx.editMessageText(
          "Iltimos, quyidagi test turidan birini tanlang:",
          Markup.inlineKeyboard(buttons)
        ).catch(console.error);
        await ctx.answerCbQuery();
      });

      bot.action('choose_online_tests', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }
        
        const buttons = variants.map((v, i) => 
          [Markup.button.callback(v.title, `start_variant_${i}`)]
        );
        buttons.push([Markup.button.callback("⬅️ Orqaga", "back_to_main_menu")]);
        
        await ctx.editMessageText("Qaysi online variantni ishlashni xohlaysiz?", Markup.inlineKeyboard(buttons)).catch(console.error);
        await ctx.answerCbQuery();
      });

      bot.action('choose_pdf_tests', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }
        
        const list = await loadPdfTests();
        if (list.length === 0) {
          const buttons = [[Markup.button.callback("⬅️ Orqaga", "back_to_main_menu")]];
          await ctx.editMessageText("Hozircha PDF formatida yuklangan testlar mavjud emas.", Markup.inlineKeyboard(buttons)).catch(console.error);
          return ctx.answerCbQuery();
        }
        
        const buttons = list.map(test => 
          [Markup.button.callback(test.title, `pdf_info_${test.id}`)]
        );
        buttons.push([Markup.button.callback("⬅️ Orqaga", "back_to_main_menu")]);
        
        await ctx.editMessageText("Quyidagi PDF testlardan birini tanlang:", Markup.inlineKeyboard(buttons)).catch(console.error);
        await ctx.answerCbQuery();
      });

      bot.action('check_sub', async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (isSubscribed) {
          await ctx.deleteMessage().catch(() => {});
          await ctx.reply("Rahmat! Obuna tasdiqlandi.", getMainMenuKeyboard());
          const buttons = [
            [Markup.button.callback("🏛 Online Testlar", "choose_online_tests")],
            [Markup.button.callback("📂 PDF Testlar", "choose_pdf_tests")]
          ];
          ctx.reply(
            "Iltimos, quyidagi test turidan birini tanlang:",
            Markup.inlineKeyboard(buttons)
          );
        } else {
          ctx.answerCbQuery("Siz hali kanalga obuna bo'lmagansiz!", { show_alert: true });
        }
      });

      bot.action(/pdf_info_(.+)/, async (ctx) => {
        const isSubscribed = await checkSubscription(ctx);
        if (!isSubscribed) {
          return sendSubscriptionPrompt(ctx);
        }
        
        const testId = ctx.match[1].split('_')[0]; // Simple safety
        const list = await loadPdfTests();
        const test = list.find(t => t.id === ctx.match[1]);
        if (!test) {
          return ctx.answerCbQuery("Test topilmadi!", { show_alert: true });
        }
        
        const domain = (globalSettings as any).baseUrl || 'https://math-test-bot-preview';
        const absolutePdfUrl = test.pdfUrl.startsWith('http') ? test.pdfUrl : `${domain}${test.pdfUrl}`;
        
        let infoText = `📂 **PDF Test:** ${test.title}\n\n`;
        infoText += `📝 **Savollar soni:** ${test.questionsCount} ta\n`;
        infoText += `📅 **Yuklangan vaqt:** ${new Date(test.createdAt).toLocaleDateString()}\n\n`;
        infoText += `📥 PDF faylini yuklab olib, savollarni yeching va javoblarni quyidagi ikki usuldan biri orqali topshiring:\n\n`;
        infoText += `1️⃣ **Tugmalar orqali belgilash:** Quyidagi 'Tugmalar orqali' tugmasini bosing va interaktiv tarzda A, B, C, D variantlarni belgilab chiqing.\n\n`;
        infoText += `2️⃣ **Matn orqali birda yuborish:** 'Matn orqali yuborish' tugmasini bosing, so'ngra bir qatorda (Masalan: \`1a2b3c4d...\` yoki \`abcdabcd...\`) javoblarni yozib jo'nating!`;
        
        const buttons = [
          [Markup.button.url("📥 PDF Yuklab Olish", absolutePdfUrl)],
          [
            Markup.button.callback("🔘 Tugmalar orqali", `pdf_solve_start_${test.id}`),
            Markup.button.callback("✍️ Matn orqali yuborish", `pdf_submit_text_${test.id}`)
          ],
          [Markup.button.callback("⬅️ Orqaga", "choose_pdf_tests")]
        ];
        
        await ctx.editMessageText(infoText, {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup
        }).catch(console.error);
        
        await ctx.answerCbQuery();
      });

      bot.action(/pdf_submit_text_(.+)/, async (ctx) => {
        const testId = ctx.match[1];
        const list = await loadPdfTests();
        const test = list.find(t => t.id === testId);
        if (!test) return ctx.answerCbQuery("Test topilmadi!", { show_alert: true });
        
        const chatId = ctx.chat?.id;
        if (!chatId) return;
        
        pdfSessions.set(chatId, { testId, currentQuestion: -1, answers: [] });
        
        await ctx.reply(`✍️ **${test.title}** muvaffaqiyatli tanlandi!\n\nJavoblaringizni bitta xabarda yuboring.\nMasalan: \`1a2b3c4d...\` yoki \`abcdabcd...\` ko'rinishida jo'nating.\n\nBekor qilish uchun: /cancel`, { parse_mode: 'Markdown' });
        await ctx.answerCbQuery();
      });

      const sendPdfQuestion = async (ctx: any, chatId: number) => {
        const session = pdfSessions.get(chatId);
        if (!session) return;
        
        const list = await loadPdfTests();
        const test = list.find(t => t.id === session.testId);
        if (!test) return;
        
        const text = `📁 **${test.title}**\n\nSavol ${session.currentQuestion + 1} / ${test.questionsCount}\n\nJavobingiz variantini belgilang:`;
        
        const options = ['A', 'B', 'C', 'D'];
        const buttons = [
          options.map((opt, idx) => Markup.button.callback(opt, `pdf_ans_${idx}`)),
          [Markup.button.callback("❌ Chiqish", "pdf_solve_cancel")]
        ];
        
        if (ctx.callbackQuery) {
          await ctx.editMessageText(text, Markup.inlineKeyboard(buttons)).catch(console.error);
        } else {
          await ctx.reply(text, Markup.inlineKeyboard(buttons)).catch(console.error);
        }
      };

      bot.action(/pdf_solve_start_(.+)/, async (ctx) => {
        const testId = ctx.match[1];
        const list = await loadPdfTests();
        const test = list.find(t => t.id === testId);
        if (!test) return ctx.answerCbQuery("Test topilmadi!", { show_alert: true });
        
        const chatId = ctx.chat?.id;
        if (!chatId) return;
        
        pdfSessions.set(chatId, { testId, currentQuestion: 0, answers: [] });
        await sendPdfQuestion(ctx, chatId);
        await ctx.answerCbQuery();
      });

      bot.action(/pdf_ans_(\d+)/, async (ctx) => {
        const chatId = ctx.chat?.id;
        if (!chatId) return;
        
        const session = pdfSessions.get(chatId);
        if (!session || session.currentQuestion === -1) {
          return ctx.answerCbQuery("Sessiya topilmadi!", { show_alert: true });
        }
        
        const list = await loadPdfTests();
        const test = list.find(t => t.id === session.testId);
        if (!test) return;
        
        const idxToLetter = ['a', 'b', 'c', 'd'];
        const chosen = idxToLetter[parseInt(ctx.match[1])];
        session.answers.push(chosen);
        session.currentQuestion++;
        
        if (session.currentQuestion < test.questionsCount) {
          await sendPdfQuestion(ctx, chatId);
        } else {
          let correctCount = 0;
          const correctKey = test.answers.toLowerCase();
          const resultsAnalysis: boolean[] = [];
          
          for (let i = 0; i < test.questionsCount; i++) {
            const userAns = session.answers[i];
            const correctAns = correctKey[i];
            const correct = (userAns === correctAns);
            resultsAnalysis.push(correct);
            if (correct) correctCount++;
          }
          
          const percentage = Math.round((correctCount / test.questionsCount) * 100);
          await trackTestResult(chatId, percentage);

          if (db) {
            try {
              await setDoc(doc(db, 'pdf_test_results', `${chatId}_${test.id}`), {
                userId: chatId,
                testId: test.id,
                testTitle: test.title,
                correctCount,
                totalQuestions: test.questionsCount,
                percentage,
                timestamp: Date.now()
              });
            } catch (e) {
              console.error("Error saving PDF test result to Firestore:", e);
            }
          }

          let resultText = `🎉 **${test.title}** muvaffaqiyatli yakunlandi!\n\n`;
          resultText += `📊 **To'g'ri javoblar:** ${correctCount} / ${test.questionsCount} ta (${percentage}%)\n\n`;
          resultText += `📝 **Ketma-ket tahlil:**\n`;
          
          resultsAnalysis.forEach((isCorrect, i) => {
            const userChoiceChar = session.answers[i] || '-';
            resultText += `${i + 1}-savol: ${isCorrect ? "✅ To'g'ri" : `❌ Noto'g'ri (Siz: ${userChoiceChar.toUpperCase()}, J: ${correctKey[i].toUpperCase()})`}\n`;
          });
          
          const buttons = [[Markup.button.callback("⬅️ Orqaga", "choose_pdf_tests")]];
          
          await ctx.editMessageText(resultText, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard(buttons).reply_markup
          }).catch(console.error);
          
          pdfSessions.delete(chatId);
        }
        await ctx.answerCbQuery();
      });

      bot.action('pdf_solve_cancel', async (ctx) => {
        const chatId = ctx.chat?.id;
        if (chatId) {
          pdfSessions.delete(chatId);
        }
        const buttons = [[Markup.button.callback("⬅️ Orqaga", "choose_pdf_tests")]];
        await ctx.editMessageText("❌ Test bekor qilindi.", Markup.inlineKeyboard(buttons)).catch(console.error);
        await ctx.answerCbQuery();
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
