import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function HackathonDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">Hackathon Details</h2>
      <Card>
        <CardHeader>
          <CardTitle>Hackathon {id}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Hackathon details will be loaded here.</p>
        </CardContent>
      </Card>
    </>
  );
}
