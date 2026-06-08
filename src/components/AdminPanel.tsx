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
  X
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
}

interface ChannelSettings {
  channelUsername: string;
  channels: string[];
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Broadcast states
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    sent: number;
    failed: number;
    show: boolean;
  } | null>(null);

  // Channel settings states
  const [settings, setSettings] = useState<ChannelSettings>({
    channelUsername: "@dilmurodbekmatematika",
    channels: ["@dilmurodbekmatematika", "@DilnuraMadaminova"]
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [newChannel, setNewChannel] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Individual message states
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [individualMessage, setIndividualMessage] = useState("");
  const [sendingIndividual, setSendingIndividual] = useState(false);
  const [individualSuccess, setIndividualSuccess] = useState(false);

  const fetchUsers = async () => {
    try {
      setIsRefreshing(true);
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

  useEffect(() => {
    fetchUsers();
    fetchSettings();
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
        body: JSON.stringify({ message: broadcastMessage })
      });

      if (res.ok) {
        const data = await res.json();
        setBroadcastResult({
          sent: data.sentCount || 0,
          failed: data.failedCount || 0,
          show: true
        });
        setBroadcastMessage("");
        fetchUsers(); // Refresh stats potentially
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
          message: individualMessage 
        })
      });

      if (res.ok) {
        setIndividualSuccess(true);
        setIndividualMessage("");
        setTimeout(() => {
          setIndividualSuccess(false);
          setSelectedUser(null);
        }, 1500);
      } else {
        alert("Xabar yuborilmadi. Foydalanuvchi botni bloklagan bo'lishi mumkin.");
      }
    } catch (e) {
      console.error(e);
      alert("Aloqa xatosi.");
    } finally {
      setSendingIndividual(false);
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
    // DilnuraMadaminova channels are mandatory and cannot be deleted per custom user instruction triggers
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
        body: JSON.stringify({ channels: settings.channels })
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

  return (
    <div className="space-y-8 font-sans">
      {/* Intro Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Foydalanuvchilar</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {loadingUsers ? "..." : users.length} nafar
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
            <Activity size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Ishlangan Testlar</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {loadingUsers ? "..." : totalTests} marta
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-xl">
            <Trophy size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">O'rtacha ball</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {loadingUsers ? "..." : averageScore}%
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-xl">
            <Shield size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase">Kanallar soni</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {loadingSettings ? "..." : settings.channels.length} ta hamkor
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Users list */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users size={20} className="text-indigo-600" />
                Foydalanuvchilar Ro'yxati
              </h2>
              <p className="text-xs text-slate-500">Bot orqali ro'yxatdan o'tgan foydalanuvchilar (Qidiruv ID yoki ism bo'yicha)</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                disabled={isRefreshing}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition duration-150 cursor-pointer disabled:opacity-50"
                title="Yangilash"
              >
                <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
              </button>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ism yoki username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 bg-slate-50"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loadingUsers ? (
              <div className="py-20 text-center text-slate-500">
                <RefreshCw className="animate-spin mx-auto mb-2 text-indigo-600" size={24} />
                Foydalanuvchilar yuklanmoqda...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-sm">
                Foydalanuvchilar topilmadi.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 uppercase tracking-wider text-[10px] text-slate-500 font-bold">
                    <th className="px-6 py-4">Foydalanuvchi</th>
                    <th className="px-6 py-4">Telegram ID</th>
                    <th className="px-6 py-4 text-center">Ishlangan Testlar</th>
                    <th className="px-6 py-4 text-center">O'rtacha ball</th>
                    <th className="px-6 py-4">Oxirgi faollik</th>
                    <th className="px-6 py-4 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition duration-150">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {user.firstName || "Noma'lum"} {user.lastName || ""}
                        </div>
                        {user.username ? (
                          <a
                            href={`https://t.me/${user.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-0.5 mt-0.5 font-medium"
                          >
                            @{user.username} <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-slate-400 font-normal">username yo'q</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500 font-medium">
                        {user.id}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">
                        {user.testsTaken || 0}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          (user.averageScore || 0) >= 80 
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                            : (user.averageScore || 0) >= 50
                            ? "bg-amber-50 text-amber-800 border border-amber-100"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {user.averageScore || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-300" />
                          {new Date(user.timestamp).toLocaleString("uz-UZ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition duration-150 inline-flex items-center gap-1 cursor-pointer hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200"
                        >
                          <MessageSquare size={13} />
                          Xabar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Operations */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Main Broadcast Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Bell size={18} className="text-indigo-600 animate-bounce" />
              Barcha foydalanuvchilarga xabar yuborish
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Yozilgan xabar bot a'zolariga ketma-ket yuboriladi. Telegram cheklovlari hisobga olinadi.
            </p>

            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <textarea
                  rows={4}
                  placeholder="Xabarni shu yerda yozing (Masalan: Yangi testlar joylandi, urinib ko'ring!)..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={broadcasting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-indigo-100"
              >
                {broadcasting ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    Yuborilmoqda...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Hozir yuborish
                  </>
                )}
              </button>
            </form>

            <AnimatePresence>
              {broadcastResult && broadcastResult.show && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-50 p-4 border border-slate-200 rounded-xl mt-4 space-y-1 text-xs"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800 flex items-center gap-1 text-xs">
                      <Check className="text-emerald-500" size={14} /> Xabar yuborildi!
                    </span>
                    <button 
                      onClick={() => setBroadcastResult(null)} 
                      className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex justify-between font-medium text-slate-600">
                    <span>Muvaffaqiyatli:</span>
                    <span className="text-emerald-600 font-bold">{broadcastResult.sent} ta</span>
                  </div>
                  <div className="flex justify-between font-medium text-slate-600">
                    <span>Muvaffaqiyatsiz:</span>
                    <span className="text-red-500 font-bold">{broadcastResult.failed} ta</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Subscription Channels Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Settings size={18} className="text-indigo-600" />
              Kanal Obunasi Sozlamalari
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Foydalanuvchilar test ishlashlari uchun a'zo bo'lishi shart bo'lgan Telegram kanallari.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                {settings.channels.map((channel, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs text-slate-800">
                    <span className="font-semibold flex items-center gap-1">
                      <Layers size={13} className="text-slate-400" />
                      {channel}
                    </span>
                    {channel.toLowerCase() !== "@dilnuramadaminova" && (
                      <button
                        onClick={() => handleRemoveChannel(channel)}
                        className="text-red-500 hover:text-red-700 p-1 cursor-pointer hover:bg-red-50 rounded-lg transition duration-150"
                      >
                        <Trash size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="@uz_matematika"
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none bg-slate-50 focus:ring-1 focus:ring-indigo-500 text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleAddChannel}
                  className="bg-slate-900 hover:bg-slate-850 text-white p-2.5 rounded-xl cursor-pointer flex items-center justify-center transition duration-150"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={saveChannelSettings}
                disabled={savingSettings}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
              >
                {savingSettings ? (
                  <RefreshCw className="animate-spin" size={14} />
                ) : (
                  "Kanallarni Saqlash"
                )}
              </button>

              <AnimatePresence>
                {settingsSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[11px] text-center font-bold"
                  >
                    Obuna kanallari muvaffaqiyatli saqlandi!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Message Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-xl overflow-hidden"
            >
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MessageSquare size={16} className="text-indigo-600" />
                    Shaxsiy xabar yuborish
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Foydalanuvchi: {selectedUser.firstName} ({selectedUser.id})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSendIndividual} className="p-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    Xabar matni
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Foydalanuvchiga yuboriladigan shaxsiy xabar..."
                    value={individualMessage}
                    onChange={(e) => setIndividualMessage(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-3 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition duration-150 cursor-pointer text-center"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={sendingIndividual || !individualMessage.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                      className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[11px] text-center font-bold"
                    >
                      Xabar @{selectedUser.username || selectedUser.id} ga jo'natildi!
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
