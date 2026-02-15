import { useEffect, useState } from 'react';
import { config } from '@/config';

interface AuthUser {
  id: string;
  github_username: string;
  display_name: string;
  avatar_url: string | null;
}

interface Team {
  id: string;
  name: string;
  invite_code: string;
  member_count?: number;
}

interface DashboardProps {
  user: AuthUser | null;
  loading: boolean;
}

function loginUrl(provider: 'github' | 'google'): string {
  const origin = encodeURIComponent(window.location.origin);
  return `${config.apiOrigin}/auth/${provider}?origin=${origin}`;
}

export default function Dashboard({ user, loading }: DashboardProps) {
  const [team, setTeam] = useState<Team | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setTeamLoading(true);
    const controller = new AbortController();

    fetch(`${config.apiOrigin}/api/v1/hackathons/${config.slug}/teams`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.ok) return;
        const myTeam = (json.data || []).find((t: Team & { members?: { user_id: string }[] }) =>
          t.members?.some((m: { user_id: string }) => m.user_id === user.id)
        );
        if (myTeam) setTeam(myTeam);
      })
      .catch(() => {})
      .finally(() => setTeamLoading(false));

    return () => controller.abort();
  }, [user]);

  const accent = config.accentColor;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <h1 className="text-3xl font-bold">Sign in to continue</h1>
          <p className="text-white/60">Join {config.title} by signing in with your GitHub or Google account.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={loginUrl('github')}
              className="px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
              style={{ background: accent, color: '#0b1120' }}
            >
              Sign in with GitHub
            </a>
            <a
              href={loginUrl('google')}
              className="px-6 py-3 rounded-xl font-bold border border-white/20 text-white/90 hover:bg-white/5 transition-all"
            >
              Sign in with Google
            </a>
          </div>
          <a href="/" className="inline-block text-sm text-white/40 hover:text-white/60 transition-colors mt-4">
            Back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {user.avatar_url && (
            <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full border border-white/10" />
          )}
          <div>
            <h1 className="text-2xl font-bold">{user.display_name}</h1>
            <p className="text-sm text-white/50">@{user.github_username}</p>
          </div>
        </div>
        <a href="/" className="text-sm text-white/40 hover:text-white/60 transition-colors">
          Home
        </a>
      </div>

      <div
        className="rounded-2xl p-6 border"
        style={{ background: 'rgba(255,255,255,0.03)', borderColor: `${accent}33` }}
      >
        <h2 className="text-lg font-semibold mb-1" style={{ color: accent }}>{config.title}</h2>
        <p className="text-sm text-white/50">{config.description}</p>
      </div>

      {teamLoading ? (
        <div className="rounded-2xl p-8 border border-white/10 bg-white/5 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      ) : team ? (
        <div className="rounded-2xl p-6 border border-white/10 bg-white/5 space-y-3">
          <h3 className="font-semibold">Your Team: {team.name}</h3>
          <p className="text-sm text-white/50">
            Invite code: <span className="font-mono text-white/70">{team.invite_code}</span>
          </p>
          {team.member_count != null && (
            <p className="text-sm text-white/50">{team.member_count} member{team.member_count !== 1 ? 's' : ''}</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-6 border border-white/10 bg-white/5 text-center space-y-3">
          <p className="text-white/60">You haven't joined a team yet.</p>
          <p className="text-sm text-white/40">Create or join a team to get started.</p>
        </div>
      )}
    </div>
  );
}
