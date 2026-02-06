import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Participant Dashboard</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>My Hackathons</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You haven't joined any hackathons yet.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
