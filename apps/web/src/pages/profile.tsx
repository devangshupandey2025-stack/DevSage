import { useAuth } from '@/contexts/auth-context';
import { Mail, Shield, Calendar } from 'lucide-react';

export function ProfilePage() {
  const { user, isLoading } = useAuth();

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
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
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
    </div>
  );
}
