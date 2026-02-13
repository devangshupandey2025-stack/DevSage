import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Admin {
  id: string;
  github_id: number;
  github_username: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface AdminsResponse {
  ok: boolean;
  data: Admin[];
}

export function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAdmins() {
      try {
        const response = await apiRequest<AdminsResponse>('/api/v1/admin/admins');
        setAdmins(response.data);
      } catch (error) {
        toast.error('Failed to fetch admins');
      } finally {
        setIsLoading(false);
      }
    }
    fetchAdmins();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">Platform Admins</h1>
        <p className="text-white/60">List of users with platform administration privileges.</p>
      </div>

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
                    <th className="h-12 px-4 align-middle font-medium text-white/60">GitHub</th>
                    <th className="h-12 px-4 align-middle font-medium text-white/60">Email</th>
                    <th className="h-12 px-4 align-middle font-medium text-white/60">Joined</th>
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
                            {admin.avatar_url ? (
                              <img
                                src={admin.avatar_url}
                                alt={admin.display_name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CCFF00] text-xs font-bold text-black">
                                {admin.display_name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-white">{admin.display_name}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle text-white/80">
                          <a
                            href={`https://github.com/${admin.github_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#CCFF00] hover:underline"
                          >
                            @{admin.github_username}
                          </a>
                        </td>
                        <td className="p-4 align-middle text-white/60">
                          {admin.email || 'N/A'}
                        </td>
                        <td className="p-4 align-middle text-white/60">
                          {new Date(admin.created_at).toLocaleDateString()}
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
