import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TeamManagementPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Team Management</h2>
      <Card>
        <CardHeader>
          <CardTitle>Teams for Hackathon {id}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Team management will be available here.</p>
        </CardContent>
      </Card>
    </>
  );
}
