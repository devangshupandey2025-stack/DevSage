import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Trophy,
  Users,
  FileCode,
  Scale,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Activity,
  Award,
  Sparkles,
  Copy,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import logo from '@/photos/logo.png';

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string | number;
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
];

function getHackathonNavItems(slug: string): NavItem[] {
  const items: NavItem[] = [
    { label: 'Overview', icon: Sparkles, path: `/hackathons/${slug}` },
    { label: 'Teams', icon: Users, path: `/hackathons/${slug}/teams` },
    { label: 'Submissions', icon: FileCode, path: `/hackathons/${slug}/submissions` },
    { label: 'Judging', icon: Scale, path: `/hackathons/${slug}/judging` },
  ];

  items.push(
    { label: 'Leaderboard', icon: Trophy, path: `/hackathons/${slug}/leaderboard` },
    { label: 'Rounds', icon: Award, path: `/hackathons/${slug}/rounds` },
    { label: 'Announcements', icon: Megaphone, path: `/hackathons/${slug}/announcements` },
    { label: 'Activity', icon: Activity, path: `/hackathons/${slug}/activity` },
    { label: 'Analytics', icon: BarChart3, path: `/hackathons/${slug}/analytics` },
    { label: 'Settings', icon: Settings, path: `/hackathons/${slug}/settings` },
  );

  return items;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { slug } = useParams();
  const isHackathonRoute = location.pathname.startsWith('/hackathons/') && slug;

  const navItems = isHackathonRoute
    ? getHackathonNavItems(slug)
    : mainNavItems;

  const isActive = (path: string) => {
    // Exact match for overview page
    if (path === `/hackathons/${slug}`) {
      return location.pathname === path;
    }
    // Segment-based matching to avoid prefix overlap
    // e.g. /judge shouldn't match /judging
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-white/ bg-black"
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/">
        <Link to="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-black">
            <img src={logo} alt="Logo" className="h-5 w-5" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-lg font-black tracking-tighter whitespace-nowrap overflow-hidden"
              >
                DEV<span className="text-[#CCFF00]">SAGE</span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Hackathon context label */}
      <AnimatePresence>
        {isHackathonRoute && !collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mt-3 overflow-hidden"
          >
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-lg border border-white/ bg-white/2 px-3 py-2 text-xs text-white/40 transition hover:border-[#CCFF00]/20 hover:text-white/60"
            >
              <ChevronLeft className="h-3 w-3" />
              <span className="truncate">Back to Dashboard</span>
            </Link>
            <div className="mt-2 px-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#CCFF00]/60">
                Hackathon
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-white/80 mb-2">
                {slug}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://devsage.org/hackathons/${slug}`);
                  toast.success('Registration link copied');
                }}
                className="flex items-center justify-center w-full gap-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 px-3 py-1.5 text-[11px] font-bold text-white/60 hover:text-white transition-all shadow-sm"
              >
                <Copy className="h-3 w-3" />
                Copy Link
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'text-white/40 hover:bg-white/4 hover:text-white/70'
                )}
              >
                {/* Active indicator */}
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.75 rounded-r-full bg-[#CCFF00]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={cn('h-4.5 w-4.5 shrink-0', active ? 'text-[#CCFF00]' : '')} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {item.badge && !collapsed && (
                  <span className="ml-auto rounded-full bg-[#CCFF00]/15 px-2 py-0.5 text-[10px] font-bold text-[#CCFF00]">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-white/ p-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-xl py-2 text-white/30 transition hover:bg-white/4 hover:text-white/60"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  );
}
