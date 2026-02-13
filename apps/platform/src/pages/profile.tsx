import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ProfilePage() {
  const { user, isOrganizer, isPlatformAdmin } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-white">Profile</h2>
      
      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader className="flex flex-row items-center gap-4">
          {user.avatar_url ? (
            <img 
              src={user.avatar_url} 
              alt={user.display_name} 
              className="h-20 w-20 rounded-full border-2 border-[#CCFF00]/20 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#CCFF00] text-black text-xl font-bold">
              {user.display_name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="space-y-1">
            <CardTitle className="text-2xl">{user.display_name}</CardTitle>
            <CardDescription className="text-white/60">{user.email}</CardDescription>
            <div className="flex gap-2 mt-2">
              {isPlatformAdmin && <Badge variant="destructive">Platform Admin</Badge>}
              {isOrganizer && <Badge variant="secondary" className="bg-[#CCFF00] text-black hover:bg-[#b3e600]">Organizer</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-medium text-white/60">GitHub Username</div>
              <div className="text-lg">{user.github_username}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-white/60">User ID</div>
              <div className="text-sm font-mono text-white/40">{user.id}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-white/60">Joined</div>
              <div className="text-lg">{new Date(user.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
