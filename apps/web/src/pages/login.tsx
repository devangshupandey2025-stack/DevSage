import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Github, ArrowLeft, Sparkles, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const providers = [
  {
    id: 'google' as const,
    label: 'Continue with Google',
    icon: (
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
        <title>Google</title>
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.04-3.71 1.04-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    id: 'github' as const,
    label: 'Continue with GitHub',
    icon: <Github className="mr-2 h-4 w-4" />,
  },
];

export function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = (provider: 'google' | 'github') => {
    window.location.href = `/api/auth/${provider}`;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[80px_80px]" />
      <div className="absolute inset-y-0 left-1/2 w-1/2 bg-[radial-gradient(circle_at_top,#CCFF00/25,transparent_65%)] blur-[60px]" />
      <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-[#CCFF00]/20 blur-[120px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-300 flex-col-reverse items-center gap-16 px-6 py-16 lg:flex-row lg:items-stretch lg:py-24">
        <motion.section
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-1 flex-col justify-between"
        >
          <div>
            <button
              type="button"
              className="group mb-10 inline-flex items-center gap-2 text-sm text-white/70 transition"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
              <span className="inline-block h-px w-8 bg-white/30 transition group-hover:w-14" />
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
              <Sparkles className="h-4 w-4 text-[#CCFF00]" />
              DevSage Sign-in
            </div>
            <h1 className="mt-8 text-4xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
              Rejoin the builders pushing software beyond limits.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/60">
              Your dashboard, teams, and live hackathons live here. Restore the same neon energy from the landing page and keep shipping.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {[
              { label: 'Active hackathons', value: '18' },
              { label: 'Builders online', value: '3,204' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">{stat.label}</p>
                <p className="mt-3 text-4xl font-black text-[#CCFF00]">{stat.value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <Card className="border-white/10 bg-black/60 backdrop-blur-xl">
            <CardHeader className="space-y-4 text-center">
              <div className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
                <Shield className="h-3.5 w-3.5 text-[#CCFF00]" />
                Secure OAuth
              </div>
              <CardTitle className="text-3xl text-white">Welcome back</CardTitle>
              <CardDescription className="text-white/60">
                Sign in using your preferred provider. We will redirect you to continue your hackathon journey.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {providers.map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  className="w-full border-white/20 bg-transparent text-white hover:border-[#CCFF00] hover:bg-[#CCFF00]/10"
                  onClick={() => handleLogin(provider.id)}
                >
                  {provider.icon}
                  {provider.label}
                </Button>
              ))}
              <p className="text-center text-xs text-white/40">
                By continuing you agree to the DevSage Terms of Participation and Code of Conduct.
              </p>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </div>
  );
}
