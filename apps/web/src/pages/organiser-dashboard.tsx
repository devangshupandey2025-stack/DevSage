import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function OrganiserDashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Organiser Dashboard</h2>
      <div className="flex justify-end mb-4">
        <Button>Create Hackathon</Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Manage Hackathons</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No hackathons created yet.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
