import React, { useState, useEffect } from 'react';
import { Users, Lock, LogOut, Activity, Send, CheckCircle2 } from 'lucide-react';

interface UserData {
  id: number;
  timestamp: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  testsTaken?: number;
  averageScore?: number;
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

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setPassword(savedToken);
      fetchStats(savedToken);
    }
  }, []);

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
