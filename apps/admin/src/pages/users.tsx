import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
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

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="mt-1 text-sm text-white/50">All registered users on the platform ({total} total)</p>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="h-12 px-4 font-medium text-white/60">User</th>
                  <th className="h-12 px-4 font-medium text-white/60">Email</th>
                  <th className="h-12 px-4 font-medium text-white/60">Joined</th>
                  <th className="h-12 px-4 font-medium text-white/60">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${String(i)}`}>
                      <td colSpan={4} className="p-4"><Skeleton className="h-8 w-full" /></td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-24 text-center text-white/60">No users found.</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {u.image ? (
                            <img src={u.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CCFF00] text-xs font-bold text-black">
                              {u.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                          )}
                          <span className="font-medium text-white">{u.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-white/60">{u.email}</td>
                      <td className="p-4 text-white/60">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-white/60">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))
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
