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
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'broadcast' | 'channels' | 'candidates'>('stats');

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

  useEffect(() => {
    fetchUsers();
    fetchSettings();
    fetchCandidates();
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



        </AnimatePresence>

      </div>

      {/* Tactile BOTTOM CALCULATOR-STYLE KEYPAD / MENU (replicates a premium Telegram Reply Keyboard) */}
      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl shadow-inner">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-3">
          🎛️ Boshqaruv Kalkulyator Tugmachalari
        </label>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
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
            className={`py-3.5 px-3 rounded-xl font-bold text-xs transition duration-150 flex flex-col items-center justify-center gap-1.5 border cursor-pointer active:scale-95 col-span-2 md:col-span-1 ${
              activeTab === 'channels'
                ? 'bg-indigo-600/[0.15] border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-950'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Layers size={18} />
            <span>Sponsor Kanallar</span>
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
                    Nomzod Rezyumesi tahlili (HR)
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
