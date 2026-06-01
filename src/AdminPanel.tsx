import React, { useState, useEffect } from 'react';
import { Users, Lock, LogOut, Activity, Send, CheckCircle2, FileText, FileUp, Trash2, Plus, Settings } from 'lucide-react';

interface UserData {
  id: number;
  timestamp: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  testsTaken?: number;
  averageScore?: number;
}

interface PdfTest {
  id: string;
  title: string;
  pdfUrl: string;
  answers: string;
  questionsCount: number;
  createdAt: number;
}

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<{ usersCount: number, monthlyUsers: number } | null>(null);
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState('');

  // PDF Tests state
  const [pdfTests, setPdfTests] = useState<PdfTest[]>([]);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfAnswers, setPdfAnswers] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadingTest, setUploadingTest] = useState(false);

  // Bot sections settings state
  const [mandatoryTestsEnabled, setMandatoryTestsEnabled] = useState(true);
  const [otherSectionEnabled, setOtherSectionEnabled] = useState(true);
  const [otherSectionTitle, setOtherSectionTitle] = useState('');
  const [otherSectionContent, setOtherSectionContent] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setPassword(savedToken);
      fetchStats(savedToken);
      fetchPdfTests(savedToken);
    }
  }, []);

  const fetchPdfTests = async (token: string) => {
    try {
      const response = await fetch('/api/pdf-tests');
      if (response.ok) {
        const data = await response.json();
        setPdfTests(data);
      }
    } catch (err) {
      console.error('Error fetching pdf tests:', err);
    }
  };

  const fetchSettings = async (token: string) => {
    try {
      const response = await fetch('/api/admin/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMandatoryTestsEnabled(data.mandatoryTestsEnabled !== undefined ? data.mandatoryTestsEnabled : true);
        setOtherSectionEnabled(data.otherSectionEnabled !== undefined ? data.otherSectionEnabled : true);
        setOtherSectionTitle(data.otherSectionTitle || '');
        setOtherSectionContent(data.otherSectionContent || '');
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsSuccess('');
    setSettingsError('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({
          mandatoryTestsEnabled,
          otherSectionEnabled,
          otherSectionTitle,
          otherSectionContent
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSettingsSuccess("Bot sozlamalari muvaffaqiyatli saqlandi!");
      } else {
        setSettingsError(data.error || "Saqlashda xatolik yuz berdi.");
      }
    } catch (err) {
      setSettingsError("Tarmoq xatoligi yuz berdi.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchUsers = async (token: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error('Error fetching users list:', err);
    }
  };

  const fetchStats = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setIsAuthenticated(true);
        localStorage.setItem('admin_token', token);
        fetchUsers(token);
        fetchPdfTests(token);
        fetchSettings(token);
      } else {
        setError('Noto\'g\'ri parol');
        setIsAuthenticated(false);
        localStorage.removeItem('admin_token');
      }
    } catch (err) {
      setError('Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStats(password);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setStats(null);
    localStorage.removeItem('admin_token');
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    
    setBroadcasting(true);
    setBroadcastStatus('');
    
    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({ message: broadcastMessage })
      });
      
      if (response.ok) {
        setBroadcastMessage('');
        setBroadcastStatus('Xabar yuborish boshlandi!');
        setTimeout(() => setBroadcastStatus(''), 5000);
      } else {
        setBroadcastStatus('Xatolik yuz berdi');
      }
    } catch (err) {
      setBroadcastStatus('Xatolik yuz berdi');
    } finally {
      setBroadcasting(false);
    }
  };

  const handleDeletePdfTest = async (id: string) => {
    if (!window.confirm("Haqiqatan ham ushbu PDF testni o'chirib tashlamoqchimisiz?")) return;
    try {
      const response = await fetch(`/api/admin/pdf-tests/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${password}`
        }
      });
      if (response.ok) {
        setPdfTests(prev => prev.filter(t => t.id !== id));
      } else {
        alert("O'chirishda xatolik yuz berdi");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadPdfTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfTitle.trim() || !pdfAnswers.trim() || !pdfFile) {
      setUploadError("Barcha maydonlar va PDF fayli majburiy!");
      return;
    }

    setUploadingTest(true);
    setUploadError('');
    setUploadSuccess('');

    const formData = new FormData();
    formData.append('title', pdfTitle);
    formData.append('answers', pdfAnswers);
    formData.append('pdf', pdfFile);

    try {
      const response = await fetch('/api/admin/pdf-tests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${password}`
        },
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        setUploadSuccess("PDF test muvaffaqiyatli yuklandi!");
        setPdfTitle('');
        setPdfAnswers('');
        setPdfFile(null);
        const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        fetchPdfTests(password);
      } else {
        setUploadError(data.error || "Muvaffaqiyatsiz yuklash.");
      }
    } catch (err) {
      setUploadError("Tarmoq xatoligi yuz berdi.");
    } finally {
      setUploadingTest(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={32} className="text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Admin Panel</h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parol</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Parolni kiriting"
                required
              />
            </div>
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-70"
            >
              {loading ? 'Tekshirilmoqda...' : 'Kirish'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Admin Panel</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-600 hover:text-red-600 transition-colors font-medium"
          >
            <LogOut size={20} />
            Chiqish
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
            <div className="bg-blue-100 p-4 rounded-xl text-blue-600">
              <Users size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Jami foydalanuvchilar</p>
              <p className="text-3xl font-bold text-slate-800">
                {stats?.usersCount !== undefined ? stats.usersCount : '...'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
            <div className="bg-emerald-100 p-4 rounded-xl text-emerald-600">
              <Activity size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Oylik faol</p>
              <p className="text-3xl font-bold text-slate-800">
                {stats?.monthlyUsers !== undefined ? stats.monthlyUsers : '...'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Send size={24} className="text-indigo-600" />
            Xabar yuborish (Broadcast)
          </h2>
          <form onSubmit={handleBroadcast} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Barcha foydalanuvchilarga xabar yuborish
              </label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-y min-h-[100px]"
                placeholder="Xabar matnini kiriting..."
                required
              />
            </div>
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={broadcasting || !broadcastMessage.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-70 flex items-center gap-2"
              >
                {broadcasting ? 'Yuborilmoqda...' : 'Yuborish'}
                {!broadcasting && <Send size={18} />}
              </button>
              {broadcastStatus && (
                <span className={`text-sm font-medium flex items-center gap-1 ${broadcastStatus.includes('Xatolik') ? 'text-red-500' : 'text-emerald-600'}`}>
                  {!broadcastStatus.includes('Xatolik') && <CheckCircle2 size={16} />}
                  {broadcastStatus}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* PDF Testlar Tizimi (New Feature!) */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText size={24} className="text-indigo-600" />
            PDF Testlar Boshqaruvi
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Upload form */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-1">
                <FileUp size={18} className="text-slate-500" />
                Yangi test yuklash
              </h3>
              
              <form onSubmit={handleUploadPdfTest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Test Sarlavhasi
                  </label>
                  <input
                    type="text"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all bg-white"
                    placeholder="Masalan: Fizika xonadoni 1-birlik"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    To'g'ri Javoblar Kaliti
                  </label>
                  <input
                    type="text"
                    value={pdfAnswers}
                    onChange={(e) => setPdfAnswers(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all font-mono bg-white"
                    placeholder="Masalan: abcdabcd yoki 1a2b3c4d"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Uzunlik cheklanmagan. Harflar avtomatik tozalanadi va tartiblanadi.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    PDF Fayli (.pdf)
                  </label>
                  <input
                    id="pdf-file-input"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    required
                  />
                </div>

                {uploadError && <p className="text-red-500 text-xs font-medium">{uploadError}</p>}
                {uploadSuccess && <p className="text-emerald-600 text-xs font-semibold">{uploadSuccess}</p>}

                <button
                  type="submit"
                  disabled={uploadingTest}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-75 flex items-center justify-center gap-1.5"
                >
                  {uploadingTest ? 'Yuklanmoqda...' : 'Faylni Tasdiqlash'}
                  {!uploadingTest && <Plus size={16} />}
                </button>
              </form>
            </div>

            {/* List of uploaded PDF tests */}
            <div className="flex flex-col">
              <h3 className="font-semibold text-slate-700 mb-4">Yuklangan PDF Testlar ({pdfTests.length})</h3>
              
              <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-200 rounded-xl bg-slate-50 divide-y divide-slate-100">
                {pdfTests.map((t) => (
                  <div key={t.id} className="p-3.5 flex items-center justify-between hover:bg-slate-100/50 transition-colors">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm font-semibold text-slate-700 truncate">{t.title}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium whitespace-nowrap overflow-hidden mt-0.5">
                        <span className="bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                          {t.questionsCount} TA SAVOL
                        </span>
                        <span className="truncate">
                          Kalit: {t.answers.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePdfTest(t.id)}
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors hover:bg-white"
                      title="Testni o'chirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {pdfTests.length === 0 && (
                  <div className="h-full min-h-[160px] flex items-center justify-center p-8 text-slate-400 text-sm italic">
                    Hozircha PDF testlar yuklanmagan
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bot Bo'limlari Sozlamalari */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Settings size={24} className="text-indigo-600" />
            Bot Bo'limlari & Tugmalar Sozlamalari
          </h2>
          <p className="text-sm text-slate-500 mb-6 font-medium">
            Ushbu bo'lim orqali Telegram bot pastki menyusidagi interaktiv tugmalar (Reply Keyboard) va unga bog'liq tarkibni boshqarishingiz mumkin.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
              
              {/* Mandatory Tests Toggle */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 text-sm">📝 Testlar Bo'limi</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mandatoryTestsEnabled}
                        onChange={(e) => setMandatoryTestsEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 font-medium font-sans">
                    Bot pastida "📝 Testlar Bo'limi" tugmasining ko'rinishini sozlaydi (onlayn va PDF testlar).
                  </p>
                </div>
              </div>

              {/* Other Section Toggle */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700 text-sm">ℹ️ Boshqa Bo'lim</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={otherSectionEnabled}
                        onChange={(e) => setOtherSectionEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 font-medium font-sans">
                    Ma'lumot va yordamga bag'ishlangan uchinchi moslashtiriladigan tugmani yoqadi/o'chiradi.
                  </p>
                </div>
              </div>

            </div>

            {/* Editing fields for other section content */}
            <div className="grid grid-cols-1 gap-6 mt-4">

              {/* Other Section settings */}
              {otherSectionEnabled && (
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-5 space-y-3 shadow-sm font-sans">
                  <h3 className="font-semibold text-sm text-slate-700">ℹ️ "Boshqa bo'lim" nomi & tarkibi</h3>
                  
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Tugma Sarlavhasi (Maks 30 ta harf)
                    </label>
                    <input
                      type="text"
                      value={otherSectionTitle}
                      onChange={(e) => setOtherSectionTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                      placeholder="Ma'lumot va Qoidalar"
                      required={otherSectionEnabled}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Bo'lim tarkibi (Matn yoki Qo'llanma)
                    </label>
                    <textarea
                      value={otherSectionContent}
                      onChange={(e) => setOtherSectionContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
                      placeholder="Qoidalar, ko'rsatmalar yoki boshqa ma'lumotlar..."
                      required={otherSectionEnabled}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Alert boxes */}
            {settingsError && <p className="text-red-500 text-xs font-semibold">{settingsError}</p>}
            {settingsSuccess && <p className="text-emerald-600 text-xs font-semibold">{settingsSuccess}</p>}

            {/* Submission buttons */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={settingsLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors disabled:opacity-70 flex items-center gap-1.5"
              >
                {settingsLoading ? 'Saqlanmoqda...' : 'O\'zgarishlarni Saqlash'}
                {!settingsLoading && <CheckCircle2 size={16} />}
              </button>
            </div>

          </form>
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800">Foydalanuvchilar ro'yxati</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                  <th className="p-4 font-medium">ID</th>
                  <th className="p-4 font-medium">Ism</th>
                  <th className="p-4 font-medium">Username</th>
                  <th className="p-4 font-medium">Testlar soni</th>
                  <th className="p-4 font-medium">O'rtacha natija</th>
                  <th className="p-4 font-medium">Oxirgi faollik</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm text-slate-600 font-mono">{user.id}</td>
                    <td className="p-4 text-sm text-slate-800 font-medium">
                      {user.firstName || ''} {user.lastName || ''}
                      {!user.firstName && !user.lastName && <span className="text-slate-400 italic">Noma'lum</span>}
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {user.username ? (
                        <a href={`https://t.me/${user.username}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                          @{user.username}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium text-center">
                      {user.testsTaken || 0}
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium text-center">
                      {user.averageScore ? `${user.averageScore}%` : '-'}
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {new Date(user.timestamp).toLocaleString('uz-UZ')}
                    </td>
                  </tr>
                ))}
                {usersList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Hozircha foydalanuvchilar yo'q
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
