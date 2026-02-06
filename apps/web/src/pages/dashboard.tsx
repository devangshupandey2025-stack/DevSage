import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Local interface matching snake_case API response
interface Hackathon {
  id: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'REGISTRATION_OPEN' | 'HACKING' | 'SUBMISSION_CLOSED' | 'COMPLETED';
  registration_start_date: string;
  hacking_start_date: string;
  submission_deadline: string;
  max_team_size: number;
  organiser_id: string;
  created_at: string;
  updated_at: string;
}

interface HackathonListResponse {
  data: Hackathon[];
  total: number;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  REGISTRATION_OPEN: "default", // Green-ish usually, default is black/primary
  HACKING: "default", 
  SUBMISSION_CLOSED: "destructive",
  COMPLETED: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  REGISTRATION_OPEN: "Registration Open",
  HACKING: "Hacking in Progress",
  SUBMISSION_CLOSED: "Submissions Closed",
  COMPLETED: "Completed",
};

export function DashboardPage() {
  const { user } = useAuth();
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);

  useEffect(() => {
    fetchHackathons();
  }, []);

  const fetchHackathons = async () => {
    try {
      const response = await apiRequest<HackathonListResponse>('/hackathons');
      setHackathons(response.data);
    } catch (error) {
      toast.error('Failed to load hackathons');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (hackathonId: string) => {
    setRegistering(hackathonId);
    try {
      await apiRequest(`/hackathons/${hackathonId}/register`, {
        method: 'POST',
      });
      toast.success('Successfully registered!');
      // Refresh to update UI if needed (though usually we'd navigate or change state)
      // For now, redirecting to details might be good, or just staying here
    } catch (error) {
      toast.error('Failed to register');
    } finally {
      setRegistering(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Browse Hackathons</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader>
                <Skeleton className="h-6 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent className="flex-1">
                <Skeleton className="h-20 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-28" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Browse Hackathons</h2>
      </div>

      {hackathons.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Hackathons Found</CardTitle>
            <CardDescription>
              Check back later for upcoming events.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {hackathons.map((hackathon) => (
            <Card key={hackathon.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-xl line-clamp-1" title={hackathon.title}>
                    {hackathon.title}
                  </CardTitle>
                  <Badge variant={STATUS_COLORS[hackathon.status] || "outline"} className="whitespace-nowrap shrink-0">
                    {STATUS_LABELS[hackathon.status] || hackathon.status}
                  </Badge>
                </div>
                <CardDescription className="text-xs space-y-1 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Registration:</span> {formatDate(hackathon.registration_start_date)}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Hacking:</span> {formatDate(hackathon.hacking_start_date)}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {hackathon.description}
                </p>
              </CardContent>
              <CardFooter className="pt-4 mt-auto border-t bg-muted/5 p-4 flex gap-2">
                {hackathon.status === 'REGISTRATION_OPEN' ? (
                  <>
                     <Button 
                      onClick={() => handleRegister(hackathon.id)} 
                      disabled={registering === hackathon.id}
                      className="w-full"
                    >
                      {registering === hackathon.id ? 'Registering...' : 'Register Now'}
                    </Button>
                    <Button variant="outline" asChild className="w-full">
                      <Link to={`/hackathons/${hackathon.id}`}>Details</Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild className="w-full" variant={hackathon.status === 'HACKING' ? 'default' : 'secondary'}>
                    <Link to={`/hackathons/${hackathon.id}`}>
                      {hackathon.status === 'HACKING' ? 'Enter Dashboard' : 'View Details'}
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
