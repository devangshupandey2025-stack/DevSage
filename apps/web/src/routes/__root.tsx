import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '@/features/auth/use-auth';
import { LogOut, User, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar />
      <Outlet />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'hsl(0 0% 8%)',
            border: '1px solid hsl(0 0% 12%)',
            color: 'hsl(0 0% 95%)',
          },
        }}
      />
    </div>
  );
}

function NavBar() {
  const { user, isAuthenticated, isPending, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
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

  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-black tracking-tighter">
            DEV<span className="text-[#CCFF00]">SAGE</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm sm:flex">
            <Link
              to="/"
              className="text-white/60 transition hover:text-white [&.active]:text-[#CCFF00] [&.active]:font-semibold"
            >
              Home
            </Link>
            {isAuthenticated && (
              <Link
                to="/dashboard"
                className="text-white/60 transition hover:text-white [&.active]:text-[#CCFF00] [&.active]:font-semibold"
              >
                Dashboard
              </Link>
            )}
            <Link
              to="/hackathon-shell"
              className="text-white/60 transition hover:text-white [&.active]:text-[#CCFF00] [&.active]:font-semibold"
            >
              Hackathon
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded-full bg-white/10" />
          ) : isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((p) => !p)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:border-[#CCFF00]/40 hover:bg-white/10"
              >
                {user.image ? (
                  <img src={user.image} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#CCFF00] text-xs font-bold text-black">
                    {initial}
                  </span>
                )}
                <span className="hidden text-sm text-white/80 sm:inline">{user.name}</span>
                <ChevronDown
                  className={`h-4 w-4 text-white/50 transition ${profileOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur-xl">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-white">{user.name ?? 'User'}</p>
                    <p className="truncate text-xs text-white/50">{user.email}</p>
                  </div>
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setProfileOpen(false);
                        await signOut();
                        window.location.href = '/';
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-[#CCFF00] px-5 py-2 text-sm font-bold text-black transition hover:bg-[#CCFF00]/90"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
