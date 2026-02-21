import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Calendar } from 'lucide-react';

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-black tracking-tight">Profile</h1>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {user?.image ? (
              <img src={user.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#CCFF00] text-xl font-bold text-black">
                {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <p className="text-xl text-white">{user?.name}</p>
              <Badge variant="outline" className="border-[#CCFF00] text-[#CCFF00] mt-1">
                Judge
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-white/60">
            <Mail className="h-4 w-4" />
            <span>{user?.email}</span>
          </div>
          <div className="flex items-center gap-3 text-white/60">
            <Calendar className="h-4 w-4" />
            <span>Judge</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
