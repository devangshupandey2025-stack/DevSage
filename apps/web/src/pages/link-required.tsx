import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Github, ArrowLeft, Link2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const steps = [
  {
    number: '1',
    title: 'Sign in with GitHub',
    description: 'Create your DevSage identity using your GitHub account.',
    active: true,
  },
  {
    number: '2',
    title: 'Link Google (optional)',
    description:
      'Sign in with Google afterwards to link both accounts. If they share the same email, linking is automatic.',
    active: false,
  },
];

export function LinkRequiredPage() {
  const navigate = useNavigate();

  const handleGitHubSignIn = () => {
    const apiOriginRaw = import.meta.env.VITE_API_ORIGIN as string | undefined;
    const apiOrigin = apiOriginRaw ? apiOriginRaw.replace(/\/$/, '') : '';
    window.location.href = `${apiOrigin}/auth/github`;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[80px_80px]" />
      <div className="absolute inset-y-0 left-1/2 w-1/2 bg-[radial-gradient(circle_at_top,#CCFF00/25,transparent_65%)] blur-[60px]" />
      <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-[#CCFF00]/20 blur-[120px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-lg"
        >
          <button
            type="button"
            className="group mb-8 inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
            onClick={() => navigate('/login')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
            <span className="inline-block h-px w-8 bg-white/30 transition group-hover:w-14" />
          </button>

          <Card className="border-white/10 bg-black/60 backdrop-blur-xl">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#CCFF00]/30 bg-[#CCFF00]/10">
                <Link2 className="h-6 w-6 text-[#CCFF00]" />
              </div>
              <CardTitle className="text-2xl text-white">
                GitHub Account Required
              </CardTitle>
              <CardDescription className="text-white/60">
                DevSage is GitHub-native — we track commits, PRs, and repository
                activity for hackathon scoring. A GitHub account is your primary
                identity.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-4">
                {steps.map((step) => (
                  <div
                    key={step.number}
                    className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        step.active
                          ? 'bg-[#CCFF00] text-black'
                          : 'border border-white/20 text-white/50'
                      }`}
                    >
                      {step.active ? (
                        step.number
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${step.active ? 'text-white' : 'text-white/50'}`}
                      >
                        {step.title}
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full border-[#CCFF00]/40 bg-[#CCFF00]/10 text-white hover:border-[#CCFF00] hover:bg-[#CCFF00]/20"
                onClick={handleGitHubSignIn}
              >
                <Github className="mr-2 h-4 w-4" />
                Sign in with GitHub
              </Button>

              <p className="text-center text-xs text-white/40">
                After signing in with GitHub, you can link Google from your
                profile for faster future logins.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
