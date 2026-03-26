import React, { useState, useEffect } from 'react';
import { Users, Lock, LogOut, Activity } from 'lucide-react';

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<{ usersCount: number, monthlyUsers: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setPassword(savedToken);
      fetchStats(savedToken);
    }
  }, []);

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
      </div>
    </div>
  );
}
