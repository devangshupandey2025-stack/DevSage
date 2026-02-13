import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Github, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';

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
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (error === 'access_denied') {
      toast.error('Access Denied', {
        description: message || 'You do not have permission to access the admin portal.',
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      });
    }
  }, [searchParams]);

  const handleLogin = (provider: 'google' | 'github') => {
    const apiOriginRaw = import.meta.env.VITE_API_ORIGIN as string | undefined;
    const apiOrigin = apiOriginRaw ? apiOriginRaw.replace(/\/$/, '') : '';
    const origin = encodeURIComponent(window.location.origin);
    window.location.href = `${apiOrigin}/auth/${provider}?origin=${origin}`;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[80px_80px]" />
      <div className="absolute inset-y-0 left-1/2 w-1/2 bg-[radial-gradient(circle_at_top,#CCFF00/25,transparent_65%)] blur-[60px]" />
      <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-[#CCFF00]/20 blur-[120px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-300 flex-col items-center justify-center px-6 py-16">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
              <Shield className="h-4 w-4 text-[#CCFF00]" />
              SHIKDD Admin
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight text-white">
              Platform Administration
            </h1>
            <p className="mt-4 text-lg text-white/60">
              Restricted access for SHIKDD team members only.
            </p>
          </div>

          <Card className="border-white/10 bg-black/60 backdrop-blur-xl">
            <CardHeader className="space-y-4 text-center">
              <CardTitle className="text-2xl text-white">Sign In</CardTitle>
              <CardDescription className="text-white/60">
                Authenticate with your provider to continue.
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
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </div>
  );
}
