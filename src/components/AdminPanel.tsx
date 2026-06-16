import React, { useState, useEffect } from "react";
import { 
  Users, 
  Send, 
  Trophy, 
  BookOpen, 
  Activity, 
  Search, 
  Settings, 
  Layers, 
  Clock, 
  MessageSquare, 
  Bell, 
  Plus, 
  Trash, 
  Check, 
  RefreshCw, 
  ExternalLink,
  Shield,
  X,
  Ban,
  UserCheck,
  Image as ImageIcon,
  Briefcase,
  Phone,
  GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  timestamp: number;
  testsTaken?: number;
  averageScore?: number;
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

interface ChannelSettings {
  channelUsername: string;
  channels: string[];
  hdpLink?: string;
  omonLink?: string;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active Keypad Tab
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'broadcast' | 'channels' | 'candidates' | 'tests'>('stats');

  // Broadcast states
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastImage, setBroadcastImage] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    sent: number;
    failed: number;
    show: boolean;
  } | null>(null);

  // Channel settings states
  const [settings, setSettings] = useState<ChannelSettings>({
    channelUsername: "@dilmurodbekmatematika",
    channels: ["@dilmurodbekmatematika", "@DilnuraMadaminova"],
    hdpLink: "https://forms.gle/f6ZiQtiqCAH1CLy87",
    omonLink: "https://forms.gle/97m9hCsBFovYKKrX7"
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [newChannel, setNewChannel] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Individual message states
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [individualMessage, setIndividualMessage] = useState("");
  const [individualImage, setIndividualImage] = useState("");
  const [sendingIndividual, setSendingIndividual] = useState(false);
  const [individualSuccess, setIndividualSuccess] = useState(false);

  // Candidates HR states
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [updatingCandidateId, setUpdatingCandidateId] = useState<string | null>(null);

  // Custom tests states
  const [customTests, setCustomTests] = useState<any[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [testCategory, setTestCategory] = useState<'majburiy' | 'milliy' | 'matematika'>('majburiy');
  const [testTitle, setTestTitle] = useState("");
  const [testSectionId, setTestSectionId] = useState("algebra");
  const [testQuestions, setTestQuestions] = useState<any[]>([
    { text: "", imageUrl: "", options: ["", "", "", ""], correct: 0 }
  ]);

  const fetchUsers = async () => {
    try {
      if (activeTab === 'stats' || activeTab === 'users') {
        setIsRefreshing(true);
      }
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error("Error fetching admin users:", e);
    } finally {
      setLoadingUsers(false);
      setIsRefreshing(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error("Error fetching channel settings:", e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const res = await fetch("/api/candidates");
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      }
    } catch (e) {
      console.error("Error fetching candidates:", e);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const fetchTests = async () => {
    try {
      setLoadingTests(true);
      const res = await fetch("/api/tests");
      if (res.ok) {
        const data = await res.json();
        setCustomTests(data);
      }
    } catch (e) {
      console.error("Error fetching custom tests:", e);
    } finally {
      setLoadingTests(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSettings();
    fetchCandidates();
    fetchTests();
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setBroadcasting(true);
    setBroadcastResult(null);

    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: broadcastMessage,
          imageUrl: broadcastImage.trim() || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setBroadcastResult({
          sent: data.sentCount || 0,
          failed: data.failedCount || 0,
          show: true
        });
        setBroadcastMessage("");
        setBroadcastImage("");
        fetchUsers(); // Refresh stats
      } else {
        alert("Xabar yuborishda xatolik yuz berdi.");
      }
    } catch (e) {
      console.error("Error broadcasting:", e);
      alert("Aloqa xatosi.");
    } finally {
      setBroadcasting(false);
    }
  };

  const handleSendIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !individualMessage.trim()) return;

    setSendingIndividual(true);
    try {
      const res = await fetch("/api/message-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: selectedUser.id, 
          message: individualMessage,
          imageUrl: individualImage.trim() || undefined
        })
      });

      if (res.ok) {
        setIndividualSuccess(true);
        setIndividualMessage("");
        setIndividualImage("");
        setTimeout(() => {
          setIndividualSuccess(false);
          setSelectedUser(null);
        }, 1500);
      } else {
        alert("Xabar yuborilmadi. Foydalanuvchi botni o'chirgan yoki bloklagan bo'lishi mumkin.");
      }
    } catch (e) {
      console.error(e);
      alert("Aloqa xatosi.");
    } finally {
      setSendingIndividual(false);
    }
  };

  const handleToggleBan = async (user: UserProfile) => {
    const actionText = user.isBanned ? "blokdan chiqarishni" : "bloklashni";
    if (!window.confirm(`${user.firstName || user.id} foydalanuvchisini ${actionText} xohlaysizmi?`)) {
      return;
    }

    try {
      const res = await fetch("/api/users/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          isBanned: !user.isBanned
        })
      });

      if (res.ok) {
        fetchUsers(); // Refresh UI
      } else {
        alert("Amalni bajarishda xatolik yuz berdi.");
      }
    } catch (e) {
      console.error("Error toggling ban:", e);
    }
  };

  const handleCandidateStatus = async (candidate: Candidate, newStatus: 'approved' | 'rejected') => {
    const actionName = newStatus === 'approved' ? "Tasdiqlash" : "Rad etish";
    setUpdatingCandidateId(candidate.id);
    
    // Construct default message for Telegram status update
    const defaultFeedback = newStatus === 'approved' 
      ? `Tabriklaymiz, ${candidate.fullName}! Sizning "${candidate.direction}" yo'nalishidagi arizangiz tasdiqlandi. Tez orada aloqaga chiqamiz.`
      : `Muhtaram, ${candidate.fullName}. Afsuski, "${candidate.direction}" yo'nalishidagi arizangiz rad etildi. Kelgusi sinovlarda muvaffaqiyatlar tilaymiz.`;

    const feedback = feedbackMessage.trim() || defaultFeedback;

    try {
      const res = await fetch("/api/candidates/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          status: newStatus,
          message: feedback
        })
      });

      if (res.ok) {
        setFeedbackMessage("");
        setSelectedCandidate(null);
        fetchCandidates();
      } else {
        alert("Nomzod holatini yangilab bo'lmadi.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingCandidateId(null);
    }
  };

  const handleAddChannel = () => {
    if (!newChannel.trim()) return;
    let formatted = newChannel.trim();
    if (!formatted.startsWith("@")) {
      formatted = "@" + formatted;
    }
    if (settings.channels.includes(formatted)) {
      setNewChannel("");
      return;
    }
    setSettings(prev => ({
      ...prev,
      channels: [...prev.channels, formatted]
    }));
    setNewChannel("");
  };

  const handleRemoveChannel = (ch: string) => {
    if (ch.toLowerCase() === "@dilnuramadaminova") {
      alert("Bu tizimli kanalni o'chirib bo'lmaydi.");
      return;
    }
    setSettings(prev => ({
      ...prev,
      channels: prev.channels.filter(item => item !== ch)
    }));
  };

  const saveChannelSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          channels: settings.channels,
          hdpLink: settings.hdpLink,
          omonLink: settings.omonLink
        })
      });
      if (res.ok) {
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 2000);
      }
    } catch (e) {
      console.error("Error saving settings:", e);
    } finally {
      setSavingSettings(false);
    }
  };

  const exportToExcel = () => {
    if (users.length === 0) return;
    const headers = ["Foydalanuvchi ID", "Ism", "Username", "Testlar soni", "O'rtacha Ball", "Holati", "Sana"];
    const rows = users.map(u => [
      u.id,
      `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      u.username ? `@${u.username}` : "yo'q",
      u.testsTaken || 0,
      `${u.averageScore || 0}%`,
      u.isBanned ? "Bloklangan 🚫" : "Faol ✅",
      new Date(u.timestamp).toLocaleString("uz-UZ")
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(val => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tizim_foydalanuvchilari_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();
    const handle = (user.username || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || handle.includes(query) || user.id.includes(query);
  });

  const totalTests = users.reduce((acc, curr) => acc + (curr.testsTaken || 0), 0);
  const averageScore = users.length > 0
    ? Math.round(users.reduce((acc, curr) => acc + (curr.averageScore || 0), 0) / users.length)
    : 0;

  const totalHdp = users.reduce((acc, curr: any) => acc + (curr.hdp || 0), 0);
  const totalOmon = users.reduce((acc, curr: any) => acc + (curr.omon || 0), 0);

  const pendingCandidatesCount = candidates.filter(c => c.status === 'pending').length;

  return (
    <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
      
      {/* Absolute abstract background accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 rounded-full px-3 py-1 text-[10px] font-bold tracking-widest uppercase inline-block mb-1">
            🖥️ Tizim Boshqaruvchisi
          </span>
          <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Shield className="text-indigo-500" size={22} />
            Bot Admin Paneli
          </h2>
        </div>
        <button 
          onClick={() => { fetchUsers(); fetchSettings(); fetchCandidates(); }}
          className="p-2 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl transition duration-150"
          title="Tizimni Yangilash"
        >
          <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Slide-Up Workspace Screen (Emerges beautifully above the bottom keypad) */}
      <div className="min-h-[380px] bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 relative shadow-inner overflow-hidden flex flex-col justify-between">
        
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Statistika */}
          {activeTab === 'stats' && (
            <motion.div 
              key="stats"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 flex-1 flex flex-col justify-between"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider mb-4 border-b border-slate-900 pb-2">
                  <Activity size={16} className="text-indigo-400" /> Tizim Statistikasi & Holati
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60 hover:border-slate-750 transition-all">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">A'zolar</div>
                    <div className="text-2xl font-extrabold text-white mt-1">{users.length} nafar</div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Bot yoqilgan
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60 hover:border-slate-750 transition-all">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sinovlar</div>
                    <div className="text-2xl font-extrabold text-indigo-300 mt-1">{totalTests} marta</div>
                    <div className="text-[10px] text-slate-400 mt-1">Imtihon topshirildi</div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/60 hover:border-slate-750 transition-all">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">O'rtacha ball</div>
                    <div className="text-2xl font-extrabold text-emerald-400 mt-1">{averageScore}%</div>
                    <div className="text-[10px] text-slate-400 mt-1">Umumiy o'zlashtirish</div>
                  </div>

                </div>
              </div>

              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850/80 text-xs text-slate-400 mt-4 leading-relaxed">
                <span className="font-bold text-white block mb-1">💡 Yo'riqnoma:</span>
                Ushbu Admin paneli maxsus bot arxitekturasi asosida tayyorlandi. Pastdagi kalkulyator tugmachalari orqali xabar yozish, majburiy kanallarni boshqarish va a'zolarni bloklash bilan tizimni to'liq nazorat qilishingiz mumkin.
              </div>
            </motion.div>
          )}

          {/* TAB 2: Foydalanuvchilar */}
          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 flex-1 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-2">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Users size={16} className="text-indigo-400" /> A'zolar Boshqaruvi ({filteredUsers.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={exportToExcel}
                      className="bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                    >
                       Excelga yuklash
                    </button>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="ID yoki Ism bo'yicha qidirish..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs w-44 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="max-h-[220px] overflow-y-auto border border-slate-900 rounded-xl divide-y divide-slate-900 custom-scrollbar">
                  {loadingUsers ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Foydalanuvchilar yuklanmoqda...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Ushbu so'rov bo'yicha a'zolar topilmadi.
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <div key={user.id} className="p-3 hover:bg-slate-900/40 flex items-center justify-between text-xs transition gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-200 flex items-center gap-1.5 truncate">
                            {user.firstName || "Noma'lum"} {user.lastName || ""}
                            {user.isBanned && (
                              <span className="bg-red-950 text-red-400 border border-red-900 px-1.5 py-0.2 rounded text-[8px] font-bold">BLOKLANGAN</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                            <span className="font-mono">ID: {user.id}</span>
                            {user.username && (
                              <a href={`https://t.me/${user.username}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                                @{user.username}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded">Score: <span className="font-bold text-emerald-400">{user.averageScore || 0}%</span></span>
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 font-bold px-2 py-1 rounded text-[10px] transition"
                          >
                            Xabar
                          </button>
                          <button
                            onClick={() => handleToggleBan(user)}
                            className={`p-1 px-1.5 rounded transition ${
                              user.isBanned 
                                ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-400' 
                                : 'bg-red-950/80 hover:bg-red-900 text-red-400'
                            }`}
                            title={user.isBanned ? "Blokdan chiqarish" : "Bloklash"}
                          >
                            {user.isBanned ? <UserCheck size={12} /> : <Ban size={12} />}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: Reklama yuborish */}
          {activeTab === 'broadcast' && (
            <motion.div 
              key="broadcast"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 flex-1 flex flex-col justify-between"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider border-b border-slate-900 pb-2">
                  <Bell size={16} className="text-indigo-400 animate-pulse" /> Telegram Reklama Tarqatuvchi
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Matnli reklamadan tashqari endi Suratli (Photo Ad) reklama yuborish imkoni va rasm havolasini kiritish paneli ham qo'shildi.
                </p>
              </div>

              <form onSubmit={handleBroadcast} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Surat Havolasi (Ixtiyoriy)</label>
                    <div className="relative">
                      <ImageIcon size={14} className="absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="url"
                        placeholder="https://example.com/photo.jpg"
                        value={broadcastImage}
                        onChange={(e) => setBroadcastImage(e.target.value)}
                        className="pl-8 pr-3 py-2 w-full text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Reklama Matni</label>
                    <textarea
                      rows={3}
                      placeholder="Reklama xabari matnini kiriting..."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      className="p-3 w-full text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="md:col-span-4 flex flex-col justify-end">
                  <button
                    type="submit"
                    disabled={broadcasting || !broadcastMessage.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    {broadcasting ? (
                      <>
                        <RefreshCw className="animate-spin" size={14} />
                        Kuting...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Yuborishni Boshlash
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {broadcastResult && broadcastResult.show && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-slate-900 p-3 rounded-lg border border-slate-800 mt-3 space-y-1 text-[10px]"
                      >
                        <div className="flex justify-between items-center text-slate-300 font-bold mb-1 border-b border-slate-850 pb-1">
                          <span>📊 Natija:</span>
                          <button onClick={() => setBroadcastResult(null)} className="text-slate-500 hover:text-slate-300">
                            <X size={12} />
                          </button>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-400">Yuborildi:</span>
                          <span className="text-emerald-400 font-bold">{broadcastResult.sent} ta</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-400">Xatolik:</span>
                          <span className="text-red-400 font-bold">{broadcastResult.failed} ta</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </form>
            </motion.div>
          )}

          {/* TAB 4: Obuna kanallari */}
          {activeTab === 'channels' && (
            <motion.div 
              key="channels"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 flex-1 flex flex-col justify-between"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider border-b border-slate-900 pb-2">
                  <Settings size={16} className="text-indigo-400" /> Obuna Kanallari (Majburiy)
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Foydalanuvchilar testlarni boshlashlari uchun ro'yxatdagi kanallarga obuna bo'lishi shart.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar border border-slate-900 p-2.5 rounded-xl">
                  {settings.channels.map((channel, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-900/60 border border-slate-850 rounded-lg p-2 text-xs">
                      <span className="font-semibold flex items-center gap-1 text-slate-300">
                        <Layers size={12} className="text-indigo-400" />
                        {channel}
                      </span>
                      {channel.toLowerCase() !== "@dilnuramadaminova" && (
                        <button
                          onClick={() => handleRemoveChannel(channel)}
                          className="text-red-400 hover:text-red-500 p-1 rounded-md transition"
                        >
                          <Trash size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-3 flex flex-col justify-end">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="@yangi_kanal"
                      value={newChannel}
                      onChange={(e) => setNewChannel(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddChannel}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 px-3 rounded-lg transition text-xs font-bold"
                    >
                      Qo'shish
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={saveChannelSettings}
                    disabled={savingSettings}
                    className="w-full bg-slate-100 hover:bg-white text-slate-900 font-extrabold py-2 px-4 rounded-lg text-xs transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    {savingSettings ? (
                      <RefreshCw className="animate-spin" size={14} />
                    ) : (
                      "Sozlamalarni Saqlash"
                    )}
                  </button>

                  <AnimatePresence>
                    {settingsSuccess && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-1.5 bg-emerald-950 border border-emerald-900 text-emerald-400 rounded-md text-[9px] text-center font-bold"
                      >
                        Kanallar saqlandi va sinxronizatsiya qilindi!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 5: Ustoz-Shogird Kandidatlari */}
          {activeTab === 'candidates' && (
            <motion.div 
               key="candidates"
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: -20, opacity: 0 }}
               transition={{ duration: 0.25 }}
               className="space-y-4 flex-1 flex flex-col justify-between"
            >
               <div>
                 <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider border-b border-slate-900 pb-2">
                   <Briefcase size={16} className="text-teal-400" /> Ustoz Shogird Kandidatlari
                 </h3>
                 <p className="text-[10px] text-slate-500 mt-1">
                   Bot orqali ariza topshirgan o'qituvchilar va hamkorlar ro'yxati.
                 </p>
               </div>

               <div className="flex-1 overflow-y-auto max-h-[280px] space-y-2 pr-1 custom-scrollbar border border-slate-900 p-3 rounded-2xl">
                 {candidates.length === 0 ? (
                   <div className="text-center py-12">
                     <p className="text-xs text-slate-500">Hozircha arizalar kelib tushmagan.</p>
                   </div>
                 ) : (
                   candidates.map((cand) => (
                     <div 
                       key={cand.id} 
                       className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl flex items-center justify-between text-xs gap-4"
                     >
                       <div className="space-y-1">
                         <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                           <span>{cand.fullName}</span>
                           <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                             cand.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-950' :
                             cand.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-950' :
                             'bg-amber-500/10 text-amber-400 border border-amber-950'
                           }`}>
                             {cand.status === 'approved' ? "Tasdiqlangan" : cand.status === 'rejected' ? "Rad etilgan" : "Kutilmoqda"}
                           </span>
                         </div>
                         <div className="text-slate-400 text-[10px] flex items-center gap-3">
                           <span>📞 {cand.phone}</span>
                           <span>💼 {cand.role === 'teacher' ? 'O\'qituvchi' : 'Hamkor'}</span>
                         </div>
                         <div className="text-slate-500 text-[9px] max-w-[280px] drop-shadow-sm italic">
                           "{cand.experience}"
                         </div>
                       </div>
                       
                       <div className="flex gap-1.5 shrink-0">
                         <button
                           onClick={async () => {
                             if (!window.confirm("Tasdiqlashni xohlaysizmi?")) return;
                             try {
                               const r = await fetch(`/api/candidates/${cand.id}/status`, {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({ status: 'approved' })
                               });
                               if (r.ok) {
                                  setCandidates(p => p.map(c => c.id === cand.id ? { ...c, status: 'approved' } : c));
                               }
                             } catch(err) { console.error(err); }
                           }}
                           className="p-1.5 bg-emerald-950/40 border border-emerald-900 hover:bg-emerald-900 text-emerald-400 rounded-lg cursor-pointer transition duration-150"
                           title="Tasdiqlash"
                         >
                           <Check size={14} />
                         </button>
                         <button
                           onClick={async () => {
                             if (!window.confirm("Rad etishni xohlaysizmi?")) return;
                             try {
                               const r = await fetch(`/api/candidates/${cand.id}/status`, {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({ status: 'rejected' })
                               });
                               if (r.ok) {
                                  setCandidates(p => p.map(c => c.id === cand.id ? { ...c, status: 'rejected' } : c));
                               }
                             } catch(err) { console.error(err); }
                           }}
                           className="p-1.5 bg-red-950/40 border border-red-950 hover:bg-red-905 text-red-405 rounded-lg cursor-pointer transition duration-150"
                           title="Rad etish"
                         >
                           <X size={14} />
                         </button>
                       </div>
                     </div>
                   ))
                 )}
               </div>
            </motion.div>
          )}

          {/* TAB 6: Test Savollari Boshqaruvi */}
          {activeTab === 'tests' && (
            <motion.div 
               key="tests"
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: -20, opacity: 0 }}
               transition={{ duration: 0.25 }}
               className="space-y-4 flex-1 flex flex-col justify-between"
            >
               <div>
                 <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                   <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                     <BookOpen size={16} className="text-indigo-400" /> Test Savollari Boshqaruvi
                   </h3>
                   <button
                     onClick={() => setIsAddingTest(!isAddingTest)}
                     className="bg-indigo-600 hover:bg-indigo-505 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs transition duration-150 flex items-center gap-1 cursor-pointer"
                   >
                     {isAddingTest ? <X size={14} /> : <Plus size={14} />}
                     <span>{isAddingTest ? "Bekor qilish" : "Yangi Test"}</span>
                   </button>
                 </div>
               </div>

               {isAddingTest ? (
                 <form onSubmit={async (e) => {
                   e.preventDefault();
                   if (!testTitle.trim()) {
                     alert("Sarlavhani kiriting!");
                     return;
                   }
                   for (const q of testQuestions) {
                     if (!q.text.trim()) {
                       alert("Savol matnini kiriting!");
                       return;
                     }
                   }
                   try {
                     const r = await fetch("/api/tests", {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({
                         category: testCategory,
                         title: testTitle,
                         sectionId: testCategory === 'matematika' ? testSectionId : undefined,
                         questions: testQuestions
                       })
                     });
                     if (r.ok) {
                       alert("Test muvaffaqiyatli saqlandi va botga joylandi!");
                       setTestTitle("");
                       setTestQuestions([{ text: "", imageUrl: "", options: ["", "", "", ""], correct: 0 }]);
                       setIsAddingTest(false);
                       fetchTests();
                     } else {
                       alert("Saqlashda xatolik yuz berdi");
                     }
                   } catch(err) { console.error(err); }
                 }} className="space-y-4 overflow-y-auto max-h-[280px] pr-1 scrollbar-thin">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                     <div className="space-y-1">
                       <label className="text-slate-400 font-bold block">Sarlavha (masalan: 12-Variant)</label>
                       <input
                         type="text"
                         value={testTitle}
                         onChange={(e) => setTestTitle(e.target.value)}
                         placeholder="Test variant nomi..."
                         className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-white outline-none"
                         required
                       />
                     </div>
                     <div className="space-y-1">
                       <label className="text-slate-400 font-bold block">Kategoriya</label>
                       <select
                         value={testCategory}
                         onChange={(e) => setTestCategory(e.target.value as any)}
                         className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white outline-none"
                       >
                         <option value="majburiy">📕 Majburiy Matematika</option>
                         <option value="milliy">🎓 Milliy Sertifikat</option>
                         <option value="matematika">🧮 Ixtisoslashtirilgan Matematika</option>
                       </select>
                     </div>
                   </div>

                   {testCategory === 'matematika' && (
                     <div className="space-y-1 text-xs">
                       <label className="text-slate-400 font-bold block">Matematika Bo'limi</label>
                       <select
                         value={testSectionId}
                         onChange={(e) => setTestSectionId(e.target.value)}
                         className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white outline-none"
                       >
                         <option value="algebra">📁 Algebra</option>
                         <option value="geometriya">📁 Geometriya</option>
                         <option value="trigonometriya">📁 Trigonometriya</option>
                         <option value="matematik_analiz">📁 Matematik Analiz</option>
                       </select>
                     </div>
                   )}

                   <div className="border-t border-slate-850 pt-3 space-y-4">
                     <div className="flex justify-between items-center">
                       <h4 className="text-xs font-bold text-slate-300">Savollar ({testQuestions.length} ta)</h4>
                       <button
                         type="button"
                         onClick={() => setTestQuestions(p => [...p, { text: "", imageUrl: "", options: ["", "", "", ""], correct: 0 }])}
                         className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded text-[10px] font-bold transition duration-150 flex items-center gap-1 cursor-pointer"
                       >
                         <Plus size={12} /> Savol qo'shish
                       </button>
                     </div>

                     {testQuestions.map((q, qIndex) => (
                       <div key={qIndex} className="bg-slate-900/40 border border-slate-850 p-3 rounded-xl space-y-3 text-xs relative">
                         <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                           <span>Savol #{qIndex + 1}</span>
                           {testQuestions.length > 1 && (
                             <button
                               type="button"
                               onClick={() => setTestQuestions(p => p.filter((_, idx) => idx !== qIndex))}
                               className="text-red-400 hover:text-red-300 transition"
                             >
                               O'chirish
                             </button>
                           )}
                         </div>

                         <div className="space-y-1">
                           <label className="text-[10px] text-slate-505 font-bold">Savol matni</label>
                           <textarea
                             value={q.text}
                             onChange={(e) => setTestQuestions(p => p.map((item, idx) => idx === qIndex ? { ...item, text: e.target.value } : item))}
                             placeholder="Masalan: Tenglamani yeching: 2x + 5 = 15"
                             className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-slate-200 outline-none"
                             rows={2}
                             required
                           />
                         </div>

                         <div className="space-y-1">
                           <label className="text-[10px] text-slate-505 font-bold block">Rasm havolasi (ixtiyoriy)</label>
                           <input
                             type="url"
                             value={q.imageUrl || ""}
                             onChange={(e) => setTestQuestions(p => p.map((item, idx) => idx === qIndex ? { ...item, imageUrl: e.target.value } : item))}
                             placeholder="https://..."
                             className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white outline-none"
                           />
                         </div>

                         <div className="grid grid-cols-2 gap-2">
                           {q.options.map((opt: string, optIdx: number) => (
                             <div key={optIdx} className="space-y-1">
                               <label className="text-[9px] text-slate-500 font-bold">{String.fromCharCode(65 + optIdx)} Variant</label>
                               <input
                                 type="text"
                                 value={opt}
                                 onChange={(e) => setTestQuestions(p => p.map((item, idx) => {
                                   if (idx !== qIndex) return item;
                                   const nextOpt = [...item.options];
                                   nextOpt[optIdx] = e.target.value;
                                   return { ...item, options: nextOpt };
                                 }))}
                                 placeholder="Javob matni..."
                                 className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white outline-none"
                                 required
                               />
                             </div>
                           ))}
                         </div>

                         <div className="space-y-1">
                           <label className="text-[9px] text-slate-500 font-bold block">To'g'ri javob</label>
                           <select
                             value={q.correct}
                             onChange={(e) => setTestQuestions(p => p.map((item, idx) => idx === qIndex ? { ...item, correct: parseInt(e.target.value) } : item))}
                             className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white outline-none"
                           >
                             <option value={0}>A Variant</option>
                             <option value={1}>B Variant</option>
                             <option value={2}>C Variant</option>
                             <option value={3}>D Variant</option>
                           </select>
                         </div>
                       </div>
                     ))}
                   </div>

                   <button
                     type="submit"
                     className="w-full bg-slate-100 hover:bg-white text-slate-900 font-black py-2.5 rounded-xl text-xs transition active:scale-95 cursor-pointer"
                   >
                     Test Variantini Saqlash
                   </button>
                 </form>
               ) : (
                 <div className="flex-1 overflow-y-auto max-h-[280px] space-y-2 pr-1 custom-scrollbar border border-slate-900 p-3 rounded-2xl">
                   {loadingTests ? (
                     <div className="flex justify-center items-center py-12">
                       <RefreshCw className="animate-spin text-slate-500" size={18} />
                     </div>
                   ) : customTests.length === 0 ? (
                     <p className="text-xs text-slate-500 text-center py-8">Hozircha qo'shimcha testlar kiritilmagan.</p>
                   ) : (
                     customTests.map((t) => (
                       <div key={t.id} className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl flex items-center justify-between text-xs gap-3">
                         <div>
                           <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                             <span>{t.title}</span>
                             <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-950">
                               {t.category === 'majburiy' ? 'Majburiy' : t.category === 'milliy' ? 'Milliy' : `Ixtisoslik (${t.sectionId})`}
                             </span>
                           </div>
                           <div className="text-slate-500 text-[9px] mt-1 flex items-center gap-2">
                             <span>📄 {t.questions.length} ta savol</span>
                             <span>•</span>
                             <span>📅 {new Date(t.timestamp).toLocaleDateString()}</span>
                           </div>
                         </div>
                         <button
                           onClick={async () => {
                             if (!window.confirm("Rostdan o'chirilsinmi?")) return;
                             try {
                               const r = await fetch("/api/tests/delete", {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({ testId: t.id })
                               });
                               if (r.ok) {
                                 setCustomTests(prev => prev.filter(item => item.id !== t.id));
                               }
                             } catch(err) { console.error(err); }
                           }}
                           className="p-1.5 bg-slate-950/40 border border-slate-850 hover:border-red-900 hover:text-red-400 text-slate-400 rounded-lg cursor-pointer transition duration-150"
                           title="O'chirish"
                         >
                           <Trash size={14} />
                         </button>
                       </div>
                     ))
                   )}
                 </div>
               )}
            </motion.div>
          )}



        </AnimatePresence>

      </div>

      {/* Tactile BOTTOM CALCULATOR-STYLE KEYPAD / MENU (replicates a premium Telegram Reply Keyboard) */}
      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl shadow-inner">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-3">
          🎛️ Boshqaruv Kalkulyator Tugmachalari
        </label>
        
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-3.5 px-3 rounded-xl font-bold text-xs transition duration-150 flex flex-col items-center justify-center gap-1.5 border cursor-pointer active:scale-95 ${
              activeTab === 'stats'
                ? 'bg-indigo-600/[0.15] border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-950'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Activity size={18} />
            <span>Statistika</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`py-3.5 px-3 rounded-xl font-bold text-xs transition duration-150 flex flex-col items-center justify-center gap-1.5 border cursor-pointer active:scale-95 ${
              activeTab === 'users'
                ? 'bg-indigo-600/[0.15] border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-950'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Users size={18} />
            <span>Foydalanuvchilar</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`py-3.5 px-3 rounded-xl font-bold text-xs transition duration-150 flex flex-col items-center justify-center gap-1.5 border cursor-pointer active:scale-95 ${
              activeTab === 'broadcast'
                ? 'bg-indigo-600/[0.15] border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-950'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Bell size={18} />
            <span>Reklama</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`py-3.5 px-3 rounded-xl font-bold text-xs transition duration-150 flex flex-col items-center justify-center gap-1.5 border cursor-pointer active:scale-95 ${
              activeTab === 'channels'
                ? 'bg-indigo-600/[0.15] border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-950'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Layers size={18} />
            <span>Kanallar</span>
          </button>

          <button
            onClick={() => setActiveTab('candidates')}
            className={`py-3.5 px-3 rounded-xl font-bold text-xs transition duration-150 flex flex-col items-center justify-center gap-1.5 border cursor-pointer active:scale-95 ${
              activeTab === 'candidates'
                ? 'bg-indigo-600/[0.15] border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-950'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Briefcase size={18} />
            <span>Kandidatlar</span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`py-3.5 px-3 rounded-xl font-bold text-xs transition duration-150 flex flex-col items-center justify-center gap-1.5 border cursor-pointer active:scale-95 col-span-2 lg:col-span-1 ${
              activeTab === 'tests'
                ? 'bg-indigo-600/[0.15] border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-950'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <BookOpen size={18} />
            <span>Testlar</span>
          </button>

        </div>
      </div>

      {/* Individual Message Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-950 border-b border-slate-850 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <MessageSquare size={16} className="text-indigo-400" />
                    Shaxsiy xabar yuborish
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Foydalanuvchi: {selectedUser.firstName || "Noma'lum"} ({selectedUser.id})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSendIndividual} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Rasmli Xabar yuborish (Ixtiyoriy rasm havolasi)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/rasm.png"
                    value={individualImage}
                    onChange={(e) => setIndividualImage(e.target.value)}
                    className="w-full border border-slate-800 rounded-xl p-2.5 text-xs bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Xabar matni
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Foydalanuvchiga yuboriladigan shaxsiy xabarni kiriting..."
                    value={individualMessage}
                    onChange={(e) => setIndividualMessage(e.target.value)}
                    className="w-full border border-slate-800 rounded-xl p-3 text-xs bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2 rounded-xl text-xs transition text-center"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={sendingIndividual || !individualMessage.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    {sendingIndividual ? (
                      <RefreshCw className="animate-spin" size={13} />
                    ) : (
                      <>
                        <Send size={13} />
                        Yuborish
                      </>
                    )}
                  </button>
                </div>

                <AnimatePresence>
                  {individualSuccess && (
                     <motion.div
                       initial={{ opacity: 0, y: 5 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="p-2 bg-emerald-950 border border-emerald-900 text-emerald-400 rounded-xl text-[10px] text-center font-bold"
                     >
                       Xabar foydalanuvchiga muvaffaqiyatli jo'natildi!
                     </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HR Candidates Details & Approval Modal */}
      <AnimatePresence>
        {selectedCandidate && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-950 border-b border-slate-850 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Briefcase size={16} className="text-indigo-400" />
                    Nomzod Rezyumesi tahlili
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Bot orqali o'tgan nomzod ma'lumotlari
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-slate-950/80 p-4 border border-slate-850 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400">To'liq ism:</span>
                    <span className="font-bold text-white">{selectedCandidate.fullName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400">Telefon:</span>
                    <span className="font-bold text-indigo-300">{selectedCandidate.phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400">Yo'nalish (Lavozimi):</span>
                    <span className="font-bold text-slate-200">{selectedCandidate.direction}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-400">Imtihondagi o'zlashtirish:</span>
                    <span className="font-bold text-emerald-400">{selectedCandidate.score}%</span>
                  </div>
                  <div className="flex flex-col pt-1">
                    <span className="text-slate-400 mb-1">Tajribasi & Izohi:</span>
                    <span className="text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-900/80 leading-relaxed font-sans">{selectedCandidate.experience}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Telegramga boradigan bildirishnoma matni (Ixtiyoriy feedback)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Bo'sh qoldirilsa, avtomatik shablon xabar yuboriladi..."
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    className="w-full border border-slate-850 rounded-xl p-2.5 text-xs bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleCandidateStatus(selectedCandidate, 'rejected')}
                    disabled={updatingCandidateId === selectedCandidate.id}
                    className="flex-1 bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 font-bold py-2.5 rounded-xl text-xs transition"
                  >
                    {updatingCandidateId === selectedCandidate.id ? "Saqlanmoqda..." : "Rad etish ❌"}
                  </button>
                  <button
                    onClick={() => handleCandidateStatus(selectedCandidate, 'approved')}
                    disabled={updatingCandidateId === selectedCandidate.id}
                    className="flex-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-900 text-emerald-400 font-bold py-2.5 rounded-xl text-xs transition"
                  >
                    {updatingCandidateId === selectedCandidate.id ? "Saqlanmoqda..." : "Tasdiqlash ✅"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
