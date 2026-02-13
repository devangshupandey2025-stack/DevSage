import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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

interface LifecycleResponse {
  version: number;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  REGISTRATION_OPEN: "Registration Open",
  HACKING: "Hacking in Progress",
  SUBMISSION_CLOSED: "Submissions Closed",
  COMPLETED: "Completed",
};

const NEXT_PHASE_ACTION: Record<string, string> = {
  DRAFT: "openRegistration",
  REGISTRATION_OPEN: "startHacking",
  HACKING: "closeSubmissions",
  SUBMISSION_CLOSED: "complete",
};

const NEXT_PHASE_LABEL: Record<string, string> = {
  DRAFT: "Open Registration",
  REGISTRATION_OPEN: "Start Hacking",
  HACKING: "Close Submissions",
  SUBMISSION_CLOSED: "Complete Hackathon",
};

export function OrganiserDashboardPage() {
  const { user } = useAuth();
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    registrationStartDate: '',
    hackingStartDate: '',
    submissionDeadline: '',
    maxTeamSize: '4',
  });

  useEffect(() => {
    fetchHackathons();
  }, []);

  const fetchHackathons = async () => {
    try {
      const response = await apiRequest<HackathonListResponse>('/api/v1/hackathons');
      setHackathons(response.data);
    } catch (error) {
      toast.error('Failed to load hackathons');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        registrationStartDate: new Date(formData.registrationStartDate).toISOString(),
        hackingStartDate: new Date(formData.hackingStartDate).toISOString(),
        submissionDeadline: new Date(formData.submissionDeadline).toISOString(),
        maxTeamSize: parseInt(formData.maxTeamSize, 10),
      };

      await apiRequest('/hackathons', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Hackathon created successfully');
      setCreateDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        registrationStartDate: '',
        hackingStartDate: '',
        submissionDeadline: '',
        maxTeamSize: '4',
      });
      fetchHackathons();
    } catch (error) {
      toast.error('Failed to create hackathon');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleAdvancePhase = async (hackathonId: string, currentStatus: string) => {
    const action = NEXT_PHASE_ACTION[currentStatus];
    if (!action) return;

    if (!confirm(`Are you sure you want to ${NEXT_PHASE_LABEL[currentStatus]}?`)) return;

    try {
      const lifecycle = await apiRequest<LifecycleResponse>(`/api/v1/hackathons/${hackathonId}/lifecycle`);
      
      await apiRequest(`/api/v1/hackathons/${hackathonId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          expectedVersion: lifecycle.version,
        }),
      });

      toast.success('Phase advanced successfully');
      fetchHackathons();
    } catch (error) {
      toast.error('Failed to advance phase');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Organiser Dashboard</h2>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
           <Skeleton className="h-48 w-full" />
           <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Organiser Dashboard</h2>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create Hackathon</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Hackathon</DialogTitle>
              <DialogDescription>
                Fill in the details for your new event.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Title</label>
                <Input id="title" name="title" required value={formData.title} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Description</label>
                <textarea 
                  id="description" 
                  name="description" 
                  required 
                  value={formData.description} 
                  onChange={handleInputChange} 
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="registrationStartDate" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Registration Start</label>
                  <Input 
                    id="registrationStartDate" 
                    name="registrationStartDate" 
                    type="datetime-local" 
                    required 
                    value={formData.registrationStartDate} 
                    onChange={handleInputChange} 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="maxTeamSize" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Max Team Size</label>
                  <Input 
                    id="maxTeamSize" 
                    name="maxTeamSize" 
                    type="number" 
                    min="1" 
                    required 
                    value={formData.maxTeamSize} 
                    onChange={handleInputChange} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="hackingStartDate" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Hacking Start</label>
                  <Input 
                    id="hackingStartDate" 
                    name="hackingStartDate" 
                    type="datetime-local" 
                    required 
                    value={formData.hackingStartDate} 
                    onChange={handleInputChange} 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="submissionDeadline" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Submission Deadline</label>
                  <Input 
                    id="submissionDeadline" 
                    name="submissionDeadline" 
                    type="datetime-local" 
                    required 
                    value={formData.submissionDeadline} 
                    onChange={handleInputChange} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Hackathon'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {hackathons.map((hackathon) => (
          <Card key={hackathon.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="line-clamp-1" title={hackathon.title}>{hackathon.title}</CardTitle>
                <Badge variant="outline">{STATUS_LABELS[hackathon.status]}</Badge>
              </div>
              <CardDescription className="line-clamp-2">
                {hackathon.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 text-sm">
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Teams:</span>
                 <span>-</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Registrations:</span>
                 <span>-</span>
               </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 pt-4 border-t bg-muted/5">
              <div className="flex gap-2 w-full">
                <Button variant="outline" asChild className="flex-1">
                  <Link to={`/hackathons/${hackathon.id}`}>Manage</Link>
                </Button>
                {NEXT_PHASE_ACTION[hackathon.status] && (
                  <Button 
                    variant="default" 
                    className="flex-1"
                    onClick={() => handleAdvancePhase(hackathon.id, hackathon.status)}
                  >
                    {NEXT_PHASE_LABEL[hackathon.status] || "Next Phase"}
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        ))}
        {hackathons.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            No hackathons found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
