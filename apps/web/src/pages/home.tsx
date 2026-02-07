import { Link } from "react-router-dom";
import { GitBranch, Rocket, Trophy, Users, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Rocket className="h-6 w-6 text-primary" />
            <span>DevSage</span>
          </div>
          <nav>
            {!isLoading && (
              isAuthenticated ? (
                <Link to="/dashboard">
                  <Button variant="default">Go to Dashboard</Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button variant="default">Login</Button>
                </Link>
              )
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-muted/20 py-24 lg:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight lg:text-6xl">
              Build the Future with <span className="text-primary">DevSage</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground lg:text-xl">
              The complete platform for organizing, managing, and participating in world-class hackathons. 
              Streamline your workflow from team formation to project submission.
            </p>
            <div className="flex justify-center gap-4">
              {!isLoading && (
                isAuthenticated ? (
                  <Link to="/dashboard">
                    <Button size="lg" className="gap-2">
                      Go to Dashboard <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link to="/login">
                    <Button size="lg" className="gap-2">
                      Get Started <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )
              )}
            </div>
          </div>
        </section>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Everything you need to run a hackathon
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful tools for organizers and a seamless experience for participants.
              </p>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-card transition-all hover:shadow-lg border-muted">
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

              <Card className="bg-card transition-all hover:shadow-lg border-muted">
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

              <Card className="bg-card transition-all hover:shadow-lg border-muted">
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

              <Card className="bg-card transition-all hover:shadow-lg border-muted">
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
        </section>
      </main>

      <footer className="border-t py-8 bg-muted/20">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>&copy; {new Date().getFullYear()} DevSage. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
