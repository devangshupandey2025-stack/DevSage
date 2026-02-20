import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, UserPlus } from 'lucide-react';

interface Admin {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  image?: string | null;
  created_at: string;
}

interface AdminsResponse {
  ok: boolean;
  data: Admin[];
}

export function AdminsPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUserId, setNewUserId] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchAdmins = async () => {
    try {
      const response = await apiRequest<AdminsResponse>('/api/v1/admin/admins');
      setAdmins(response.data);
    } catch {
      toast.error('Failed to fetch admins');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) return;
    setAdding(true);
    try {
      await apiRequest('/api/v1/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: newUserId.trim() }),
      });
      toast.success('Admin added');
      setNewUserId('');
      fetchAdmins();
    } catch {
      toast.error('Failed to add admin');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await apiRequest(`/api/v1/admin/admins/${userId}`, { method: 'DELETE' });
      toast.success('Admin removed');
      fetchAdmins();
    } catch {
      toast.error('Failed to remove admin');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">Platform Admins</h1>
        <p className="text-white/60">Manage platform administration privileges.</p>
      </div>

      {/* Add Admin Form */}
      <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">Add Administrator</CardTitle>
          <CardDescription className="text-white/60">Grant admin access by entering a user ID.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-3">
            <Input
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="Enter user UUID..."
              className="bg-black/20 border-white/10 text-white flex-1"
            />
            <Button type="submit" disabled={adding} className="bg-[#CCFF00] text-black hover:bg-[#b3e600]">
              {adding ? 'Adding...' : <><UserPlus className="mr-2 h-4 w-4" /> Add Admin</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">Administrators</CardTitle>
          <CardDescription className="text-white/60">
            These users have full access to the admin portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-white/10">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm text-left">
                <thead className="[&_tr]:border-b [&_tr]:border-white/10">
                  <tr className="border-b border-white/10 transition-colors hover:bg-white/5 data-[state=selected]:bg-white/10">
                    <th className="h-12 px-4 align-middle font-medium text-white/60">User</th>
                    <th className="h-12 px-4 align-middle font-medium text-white/60">Email</th>
                    <th className="h-12 px-4 align-middle font-medium text-white/60">Joined</th>
                    <th className="h-12 px-4 align-middle font-medium text-white/60">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="h-24 text-center text-white/60">
                        Loading...
                      </td>
                    </tr>
                  ) : admins.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="h-24 text-center text-white/60">
                        No admins found.
                      </td>
                    </tr>
                  ) : (
                    admins.map((admin) => (
                      <tr
                        key={admin.id}
                        className="border-b border-white/10 transition-colors hover:bg-white/5 data-[state=selected]:bg-white/10"
                      >
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-3">
                            {admin.image ? (
                              <img
                                src={admin.image}
                                alt={admin.name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CCFF00] text-xs font-bold text-black">
                                {admin.name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-white">{admin.name}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle text-white/60">
                          {admin.email || 'N/A'}
                        </td>
                        <td className="p-4 align-middle text-white/60">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 align-middle">
                          {admin.user_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemove(admin.user_id)}
                              className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
