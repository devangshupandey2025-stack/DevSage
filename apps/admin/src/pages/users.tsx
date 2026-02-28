import { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ChevronLeft, ChevronRight, Search, Mail, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface PaginatedRes {
  ok: boolean;
  data: User[];
  meta: { total: number; limit: number; offset: number; has_more: boolean };
}

type SortField = 'name' | 'created_at' | 'last_login_at';

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const limit = 20;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiRequest<PaginatedRes>(`/api/v1/admin/users?limit=${limit}&offset=${offset}`);
        setUsers(res.data);
        setTotal(res.meta.total);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [offset]);

  // Client-side search and sort
  const filtered = useMemo(() => {
    let result = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      const av = a[sortBy] ?? '';
      const bv = b[sortBy] ?? '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [users, search, sortBy, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const sortIcon = (field: SortField) =>
    sortBy === field ? (sortDir === 'asc' ? '↑' : '↓') : '';

  const activeCount = users.filter((u) => {
    if (!u.last_login_at) return false;
    return Date.now() - new Date(u.last_login_at).getTime() < 7 * 86400000;
  }).length;

  const neverLoggedIn = users.filter((u) => !u.last_login_at).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="mt-1 text-sm text-white/50">All registered users on the platform ({total} total)</p>
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-6 text-xs">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {activeCount} active this week
        </span>
        {neverLoggedIn > 0 && (
          <span className="text-white/30">{neverLoggedIn} never logged in</span>
        )}
        <span className="text-white/20">{filtered.length} shown</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search by name, email, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-md border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[#CCFF00]/40 focus:outline-none"
        />
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="h-12 px-4 font-medium text-white/60">User</th>
                  <th className="h-12 px-4 font-medium text-white/60">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-white transition">
                      <Mail className="h-3 w-3" /> Email {sortIcon('name')}
                    </button>
                  </th>
                  <th className="h-12 px-4 font-medium text-white/60">
                    <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 hover:text-white transition">
                      <Calendar className="h-3 w-3" /> Joined {sortIcon('created_at')}
                    </button>
                  </th>
                  <th className="h-12 px-4 font-medium text-white/60">
                    <button onClick={() => toggleSort('last_login_at')} className="flex items-center gap-1 hover:text-white transition">
                      <Clock className="h-3 w-3" /> Last Active {sortIcon('last_login_at')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${String(i)}`}>
                      <td colSpan={4} className="p-4"><Skeleton className="h-8 w-full" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-24 text-center text-white/60">
                      {search ? 'No users match your search' : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const isRecent = Date.now() - new Date(u.created_at).getTime() < 7 * 86400000;
                    const isActive = u.last_login_at && Date.now() - new Date(u.last_login_at).getTime() < 7 * 86400000;

                    return (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {u.image ? (
                              <img src={u.image} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/5" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#CCFF00]/10 text-xs font-bold text-[#CCFF00]">
                                {u.name?.charAt(0)?.toUpperCase() ?? '?'}
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-white">{u.name}</span>
                              {isRecent && (
                                <Badge className="ml-2 bg-[#CCFF00]/10 text-[#CCFF00] text-[9px] px-1.5 py-0">new</Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-white/50 font-mono text-xs">{u.email}</td>
                        <td className="p-4 text-white/50 text-xs">{timeAgo(u.created_at)}</td>
                        <td className="p-4">
                          {u.last_login_at ? (
                            <span className={`text-xs ${isActive ? 'text-emerald-400' : 'text-white/40'}`}>
                              {isActive && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle" />}
                              {timeAgo(u.last_login_at)}
                            </span>
                          ) : (
                            <span className="text-xs text-white/20">Never</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
            <p className="text-xs text-white/40">Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="border-white/10 text-white/60">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="border-white/10 text-white/60">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
