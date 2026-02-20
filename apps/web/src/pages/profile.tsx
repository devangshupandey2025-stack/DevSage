import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { apiRequest } from '@/lib/api';
import { Mail, Shield, Calendar, Key, Trash2, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface Session {
  family_id: string;
  created_at: string;
  last_used_at: string;
  is_current?: boolean;
}

export function ProfilePage() {
  const { user, isLoading, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteToken, setDeleteToken] = useState('');
  const [deleteStep, setDeleteStep] = useState<'idle' | 'requested' | 'confirming'>('idle');

  useEffect(() => {
    setSessionsLoading(true);
    apiRequest<{ data: Session[] }>('/auth/sessions')
      .then((res) => setSessions(res.data ?? []))
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, []);

  const revokeSession = async (familyId: string) => {
    try {
      await apiRequest(`/auth/sessions/${familyId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.family_id !== familyId));
      toast.success('Session revoked');
    } catch {
      toast.error('Failed to revoke session');
    }
  };

  const logoutEverywhere = async () => {
    try {
      await apiRequest('/auth/sessions', { method: 'DELETE' });
      toast.success('Logged out of all sessions');
      logout();
    } catch {
      toast.error('Failed to logout everywhere');
    }
  };

  const requestDeleteAccount = async () => {
    try {
      await apiRequest('/auth/delete-account', { method: 'POST' });
      setDeleteStep('confirming');
      toast.success('Confirmation token sent to your email');
    } catch {
      toast.error('Failed to initiate account deletion');
    }
  };

  const confirmDeleteAccount = async () => {
    if (!deleteToken.trim()) return;
    try {
      await apiRequest('/auth/delete-account/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: deleteToken }),
      });
      toast.success('Account deleted');
      logout();
    } catch {
      toast.error('Invalid or expired token');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold tracking-tight text-white">Profile</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 animate-pulse rounded-full bg-white/10" />
              <div className="space-y-2">
                <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDateString = (dateString: string | undefined | null | Date): string => {
    if (!dateString) return 'Unknown';
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };



  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight text-white">
        Profile <span className="text-[#CCFF00]">Settings</span>
      </h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identity card */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[#CCFF00]/30">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#CCFF00]/10 text-xl font-bold text-[#CCFF00]">
                  {getInitials(user.name)}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-2xl font-bold text-white">{user.name}</span>
              <span className="inline-flex w-fit rounded-full border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-3 py-0.5 text-xs font-semibold text-[#CCFF00]">
                {user.email}
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3">
            <Mail className="h-5 w-5 text-white/40" />
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Email Address
              </span>
              <span className="text-sm font-medium text-white/90">{user.email}</span>
            </div>
          </div>
        </div>

        {/* Account info card */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-6 backdrop-blur-sm">
          <div className="mb-5 flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#CCFF00]" />
            <span className="text-lg font-semibold text-white">Account Information</span>
          </div>
          <p className="mb-5 text-sm text-white/40">
            Details about your account and registration
          </p>

          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CCFF00]/10">
                <Shield className="h-4 w-4 text-[#CCFF00]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Sign-in Method
                </span>
                <span className="text-sm font-medium text-white/90">Email &amp; Password</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CCFF00]/10">
                <Calendar className="h-4 w-4 text-[#CCFF00]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Member Since
                </span>
                <span className="text-sm font-medium text-white/90">{formatDateString(user.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-6 backdrop-blur-sm">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[#CCFF00]" />
            <span className="text-lg font-semibold text-white">Active Sessions</span>
          </div>
          <button
            onClick={logoutEverywhere}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-red-500/20 hover:text-red-400"
          >
            <LogOut className="h-3 w-3" /> Logout Everywhere
          </button>
        </div>

        {sessionsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-white/40">No active sessions found.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.family_id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                <div>
                  <p className="text-sm text-white/80 font-mono">{s.family_id.slice(0, 8)}…</p>
                  <p className="text-[10px] text-white/30">
                    Created {formatDateString(s.created_at)}
                    {s.last_used_at && ` · Last used ${formatDateString(s.last_used_at)}`}
                  </p>
                </div>
                <button
                  onClick={() => revokeSession(s.family_id)}
                  className="rounded-lg px-2.5 py-1 text-xs text-white/40 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-6 backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-red-400" />
          <span className="text-lg font-semibold text-red-400/80">Danger Zone</span>
        </div>

        {deleteStep === 'idle' && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Delete Account</p>
              <p className="text-[10px] text-white/25 mt-0.5">Permanently delete your account and all associated data.</p>
            </div>
            <button
              onClick={requestDeleteAccount}
              className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Delete Account
            </button>
          </div>
        )}

        {deleteStep === 'confirming' && (
          <div className="space-y-3">
            <p className="text-sm text-white/60">Enter the confirmation token sent to your email:</p>
            <div className="flex gap-2">
              <input
                value={deleteToken}
                onChange={(e) => setDeleteToken(e.target.value)}
                placeholder="Confirmation token..."
                className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                onClick={confirmDeleteAccount}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setDeleteStep('idle')}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 hover:text-white/70"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
