import { useEffect, useState } from 'react';
import { config } from '@/config';

interface Team {
  id: string;
  name: string;
  member_count?: number;
  created_at: string;
}

interface TeamsResponse {
  ok: boolean;
  data: Team[];
  meta?: { total: number };
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${config.apiOrigin}/api/v1/hackathons/${config.slug}/teams`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json() as Promise<TeamsResponse>;
      })
      .then((json) => {
        setTeams(json.data || []);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Failed to fetch teams:', err);
        setError('Could not load teams');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const accent = config.accentColor;

  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <h2
        className="text-xs uppercase tracking-wider mb-8"
        style={{ color: `${accent}99` }}
      >
        Teams
      </h2>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-white/5 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <p className="text-white/40 text-sm">{error}</p>
      )}

      {!loading && !error && teams.length === 0 && (
        <p className="text-white/40 text-sm">No teams yet. Be the first to register!</p>
      )}

      {!loading && !error && teams.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-2xl p-5 border transition-colors"
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <h3 className="font-semibold text-white">{team.name}</h3>
              <p className="mt-1 text-sm text-white/50">
                {team.member_count != null
                  ? `${team.member_count} member${team.member_count !== 1 ? 's' : ''}`
                  : 'Team'}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
