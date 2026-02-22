import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/api';
import { Trophy, ArrowLeft, Code2, Medal } from 'lucide-react';

interface LeaderboardEntry {
  team_id: string;
  team_name: string;
  total_score: number;
  judge_count: number;
  rank: number;
}

export function LeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hackathonName, setHackathonName] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [lbRes, hRes] = await Promise.all([
          apiRequest<{ ok: boolean; data: LeaderboardEntry[] }>(`/api/v1/hackathons/${slug}/judging/leaderboard`),
          apiRequest<{ ok: boolean; data: { title: string } }>(`/api/v1/hackathons/${slug}`),
        ]);
        setEntries(lbRes.data || []);
        setHackathonName(hRes.data?.title || slug || '');
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchData();
  }, [slug]);

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-amber-600';
    return 'text-white/30';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="h-10 w-10 border-2 border-white/20 border-t-[#CCFF00] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={`/hackathons/${slug}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <Code2 className="w-6 h-6 text-[#CCFF00]" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <Trophy className="w-12 h-12 text-[#CCFF00] mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
            <p className="text-white/50">{hackathonName}</p>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-16">
              <Trophy className="w-16 h-16 text-white/10 mx-auto mb-4" />
              <p className="text-white/40">Results haven&apos;t been published yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, idx) => (
                <motion.div
                  key={entry.team_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`flex items-center gap-4 p-5 rounded-2xl border transition-colors ${
                    entry.rank <= 3
                      ? 'border-[#CCFF00]/10 bg-[#CCFF00]/[0.02]'
                      : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <div className="w-10 text-center">
                    {entry.rank <= 3 ? (
                      <Medal className={`w-6 h-6 mx-auto ${getMedalColor(entry.rank)}`} />
                    ) : (
                      <span className="text-lg font-bold text-white/30">{entry.rank}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{entry.team_name}</p>
                    <p className="text-xs text-white/40">{entry.judge_count} judge(s) scored</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#CCFF00]">{entry.total_score.toFixed(1)}</p>
                    <p className="text-xs text-white/30">points</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
