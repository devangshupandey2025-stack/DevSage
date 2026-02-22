import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { apiRequest } from '@/lib/api';
import { Trophy, Users, GitBranch, Bell, ArrowRight, Code2, LogOut, User } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  hackathon_slug: string;
  hackathon_name: string;
  member_count: number;
  repo_url: string | null;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [notifRes] = await Promise.all([
          apiRequest<{ ok: boolean; data: Notification[] }>('/api/v1/notifications?limit=5').catch(() => ({ data: [] as Notification[] })),
        ]);
        setNotifications(notifRes.data || []);
      } catch {
        // Non-critical, continue
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Code2 className="w-6 h-6 text-[#CCFF00]" />
            <span className="text-xl font-bold">DevSage</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/notifications" className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-white/60" />
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#CCFF00] rounded-full" />
              )}
            </Link>
            <Link to="/profile" className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors">
              {user?.image ? (
                <img src={user.image} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <User className="w-5 h-5 text-white/60" />
              )}
              <span className="text-sm text-white/70">{user?.name || 'Profile'}</span>
            </Link>
            <button onClick={logout} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white/60">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name?.split(' ')[0] || 'Hacker'}!</h1>
          <p className="text-white/50 mb-10">Your hackathon dashboard</p>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Link to="/hackathons" className="group p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#CCFF00]/20 transition-all">
            <Trophy className="w-8 h-8 text-[#CCFF00] mb-3" />
            <h3 className="font-semibold mb-1">Browse Hackathons</h3>
            <p className="text-sm text-white/40">Find and join hackathons</p>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[#CCFF00] mt-3 transition-colors" />
          </Link>
          <Link to="/profile" className="group p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#CCFF00]/20 transition-all">
            <User className="w-8 h-8 text-violet-400 mb-3" />
            <h3 className="font-semibold mb-1">My Profile</h3>
            <p className="text-sm text-white/40">View and edit your profile</p>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-violet-400 mt-3 transition-colors" />
          </Link>
          <Link to="/hackathons" className="group p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#CCFF00]/20 transition-all">
            <Users className="w-8 h-8 text-emerald-400 mb-3" />
            <h3 className="font-semibold mb-1">My Teams</h3>
            <p className="text-sm text-white/40">Manage your teams</p>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-emerald-400 mt-3 transition-colors" />
          </Link>
        </div>

        {/* Recent Notifications */}
        {notifications.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#CCFF00]" />
              Recent Notifications
            </h2>
            <div className="space-y-2">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} className={`p-4 rounded-xl border ${n.read ? 'border-white/5 bg-white/[0.01]' : 'border-[#CCFF00]/10 bg-[#CCFF00]/[0.02]'}`}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-white/40 mt-1">{n.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
