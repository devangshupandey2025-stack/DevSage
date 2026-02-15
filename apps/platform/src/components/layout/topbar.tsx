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
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface TopBarProps {
  sidebarCollapsed: boolean;
}

export function TopBar({ sidebarCollapsed }: TopBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
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
    user?.display_name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    '?';

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center border-b border-white/[0.06] bg-black/80 backdrop-blur-xl px-6"
    >
      {/* Search bar */}
      <div className="relative flex-1 max-w-md">
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-300 ${
            searchFocused
              ? 'border-[#CCFF00]/40 bg-white/[0.04]'
              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
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
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/30 font-mono">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-4">
        {/* Notification bell */}
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] text-white/40 transition hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/60"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#CCFF00] text-[8px] font-bold text-black pulse-lime">
            3
          </span>
        </button>

        {/* Connection indicator */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-lime" />
          <span className="text-[10px] text-white/30 font-medium">Live</span>
        </div>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((p) => !p)}
            className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 transition hover:border-[#CCFF00]/30 hover:bg-white/[0.04]"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-7 w-7 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#CCFF00] text-xs font-bold text-black">
                {initial}
              </span>
            )}
            <span className="hidden sm:block text-sm font-medium text-white/70 max-w-[100px] truncate">
              {user?.display_name ?? 'User'}
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
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/[0.08] bg-black/95 shadow-2xl backdrop-blur-xl"
              >
                <div className="border-b border-white/[0.06] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">
                    {user?.display_name ?? 'User'}
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/50 transition hover:bg-white/[0.06] hover:text-white"
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
