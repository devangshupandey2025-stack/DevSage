import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  LogOut,
  User,
  ChevronDown,
  Command,
  Check,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { apiRequest } from '@/lib/api';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

interface TopBarProps {
  sidebarCollapsed: boolean;
}

export function TopBar({ sidebarCollapsed }: TopBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
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

  const markRead = async (id: string) => {
    try {
      await apiRequest(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/api/v1/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };
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

  // Keyboard shortcut for search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchFocused(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const initial =
    user?.name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    '?';

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center border-b border-white/6 bg-black/80 backdrop-blur-xl px-6"
    >
      {/* Search bar */}
      <div className="relative flex-1 max-w-md">
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-300 ${
            searchFocused
              ? 'border-[#CCFF00]/40 bg-white/4'
              : 'border-white/ bg-white/2 hover:border-white/12'
          }`}
        >
          <Search className="h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Search hackathons, teams, users..."
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5 text-[10px] text-white/30 font-mono">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-4">
        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((p) => !p)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/ bg-white/2 text-white/40 transition hover:border-white/12 hover:bg-white/4 hover:text-white/60"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#CCFF00] text-[8px] font-bold text-black pulse-lime">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-white/8 bg-black/95 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex items-center justify-between border-b border-white/ px-4 py-3">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] text-[#CCFF00] hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-white/30">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => !n.is_read && markRead(n.id)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/4 ${n.is_read ? 'opacity-50' : ''}`}
                      >
                        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-[#CCFF00]'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/80 truncate">{n.title}</p>
                          {n.body && <p className="text-[10px] text-white/30 truncate">{n.body}</p>}
                          <p className="text-[9px] text-white/20 mt-0.5">
                            {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Connection indicator */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/ bg-white/2 px-2.5 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-lime" />
          <span className="text-[10px] text-white/30 font-medium">Live</span>
        </div>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((p) => !p)}
            className="flex items-center gap-2 rounded-xl border border-white/ bg-white/2 px-2.5 py-1.5 transition hover:border-[#CCFF00]/30 hover:bg-white/4"
          >
            {user?.image ? (
              <img
                src={user.image}
                alt=""
                className="h-7 w-7 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#CCFF00] text-xs font-bold text-black">
                {initial}
              </span>
            )}
            <span className="hidden sm:block text-sm font-medium text-white/70 max-w-25 truncate">
              {user?.name ?? 'User'}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-white/30 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/8 bg-black/95 shadow-2xl backdrop-blur-xl"
              >
                <div className="border-b border-white/ px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">
                    {user?.name ?? 'User'}
                  </p>
                  <p className="truncate text-xs text-white/40">{user?.email}</p>
                </div>
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/profile');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/50 transition hover:bg-white/6 hover:text-white"
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400/70 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
