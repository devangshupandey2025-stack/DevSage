import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { apiRequest } from '@/lib/api';
import { LogOut, User, ChevronDown, Bell } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    apiRequest<{ data: { count: number } }>('/api/v1/notifications/unread-count')
      .then((res) => setUnreadCount(res.data.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (notifOpen) {
      apiRequest<{ data: Notification[] }>('/api/v1/notifications?limit=10')
        .then((res) => setNotifications(res.data ?? []))
        .catch(() => {});
    }
  }, [notifOpen]);

  const markAllRead = async () => {
    try {
      await apiRequest('/api/v1/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navLinkClass = (path: string) =>
    location.pathname === path
      ? 'text-[#CCFF00] font-semibold'
      : 'text-white/60 hover:text-white';

  const initial = user?.name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(204,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(204,255,0,0.02)_1px,transparent_1px)] bg-size-[60px_60px]" />
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-[#CCFF00]/5 blur-[160px]" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#CCFF00]/5 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Left — branding + nav */}
          <div className="flex items-center gap-8">
            <Link
              to="/dashboard"
              className="text-xl font-black tracking-tighter"
            >
              DEV<span className="text-[#CCFF00]">SAGE</span>
            </Link>

            <nav className="hidden items-center gap-6 text-sm sm:flex">
              <Link to="/dashboard" className={`transition ${navLinkClass('/dashboard')}`}>
                Dashboard
              </Link>
            </nav>
          </div>

          {/* Right — notification + profile */}
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((p) => !p)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition hover:border-[#CCFF00]/40 hover:text-white"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#CCFF00] text-[8px] font-bold text-black">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <p className="text-sm font-semibold text-white">Notifications</p>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[10px] text-[#CCFF00] hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-white/30">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`px-4 py-3 border-b border-white/5 ${n.is_read ? 'opacity-50' : ''}`}>
                          <p className="text-xs font-medium text-white/80">{n.title}</p>
                          {n.body && <p className="text-[10px] text-white/30 mt-0.5">{n.body}</p>}
                          <p className="text-[9px] text-white/20 mt-0.5">
                            {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((p) => !p)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:border-[#CCFF00]/40 hover:bg-white/10"
            >
              {user?.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#CCFF00] text-xs font-bold text-black">
                  {initial}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 text-white/50 transition ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur-xl">
                {/* User info header */}
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">{user?.name ?? 'User'}</p>
                  <p className="truncate text-xs text-white/50">{user?.email}</p>
                </div>

                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/profile');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
