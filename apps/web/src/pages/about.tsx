import { Link } from "react-router-dom";
import { GitBranch, Rocket, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden border-b bg-muted/20">
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
            About DevSage
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            The complete platform for organizing, managing, and participating in world-class hackathons.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold tracking-tight">Our Mission</h2>
          <p className="text-lg leading-relaxed text-muted-foreground">
            DevSage is a platform designed to streamline the entire hackathon experience. 
            From team formation and project submission to judging and management, we provide 
            the tools necessary for organizers to host successful events and for developers 
            to build amazing things.
          </p>
        </div>
      </div>

      <div className="bg-muted/10 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">Key Features</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card transition-all hover:shadow-md">
              <CardHeader>
                <Trophy className="mb-4 h-10 w-10 text-primary" />
                <CardTitle>Hackathon Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Organizers can easily create, configure, and manage the entire lifecycle of their hackathons from a central dashboard.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-card transition-all hover:shadow-md">
              <CardHeader>
                <Users className="mb-4 h-10 w-10 text-primary" />
                <CardTitle>Team Formation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Participants can create teams, generate invite codes, and join existing squads to collaborate effectively.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-card transition-all hover:shadow-md">
              <CardHeader>
                <GitBranch className="mb-4 h-10 w-10 text-primary" />
                <CardTitle>GitHub Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Seamlessly link repositories to projects and track submissions directly through our GitHub integration.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-card transition-all hover:shadow-md">
              <CardHeader>
                <Rocket className="mb-4 h-10 w-10 text-primary" />
                <CardTitle>Real-time Lifecycle</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Experience a fluid workflow as hackathons progress through Draft, Registration, Hacking, Submission, and Completion stages.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="mb-6 text-3xl font-bold tracking-tight">Ready to Build?</h2>
        <p className="mb-8 text-muted-foreground">
          Join the community and start building your next big project today.
        </p>
        <Link to="/hackathons">
          <Button size="lg" className="px-8">
            Browse Hackathons
          </Button>
        </Link>
      </div>
    </div>
  );
}
