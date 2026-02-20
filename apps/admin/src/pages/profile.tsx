import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ProfilePage() {
  const { user, isPlatformAdmin, isOrganizer } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">Profile</h1>
        <p className="text-white/60">Your account details and roles.</p>
      </div>

      <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name}
                className="h-20 w-20 rounded-full object-cover border-2 border-[#CCFF00]/20"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#CCFF00] text-2xl font-bold text-black">
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{user.name}</h2>
              <p className="text-white/60">{user.email}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/60">Email</p>
              <p className="text-white">{user.email || 'Not provided'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/60">Auth Method</p>
              <p className="text-white">Email &amp; Password</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white/60">User ID</p>
              <p className="font-mono text-xs text-white/40">{user.id}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-white/60">Roles</p>
            <div className="flex flex-wrap gap-2">
              {isPlatformAdmin && (
                <Badge className="bg-[#CCFF00] text-black hover:bg-[#b3e600]">Platform Admin</Badge>
              )}
              {isOrganizer && (
                <Badge variant="outline" className="border-[#CCFF00] text-[#CCFF00]">
                  Organizer
                </Badge>
              )}
              {!isPlatformAdmin && !isOrganizer && (
                <Badge variant="secondary">User</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
