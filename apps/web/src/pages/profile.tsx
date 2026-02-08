import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Mail, Shield, Calendar, Github, Globe } from 'lucide-react';

export function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'github':
        return <Github className="h-4 w-4" />;
      case 'google':
        return <Globe className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Profile Settings</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border bg-muted">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-xl font-bold text-primary">
                  {getInitials(user.name)}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-2xl">{user.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={user.role === 'organiser' ? 'default' : 'secondary'}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="mt-4 grid gap-4">
            <div className="flex items-center gap-3 rounded-md border p-3 shadow-sm">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">Email Address</span>
                <span className="text-sm font-medium">{user.email}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Details about your account and registration
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between rounded-md border p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  {getProviderIcon(user.provider)}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground">Sign-in Provider</span>
                  <span className="text-sm font-medium capitalize">{user.provider}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground">Member Since</span>
                  <span className="text-sm font-medium">{formatDate(user.createdAt)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
