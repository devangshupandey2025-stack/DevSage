import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Shield, Loader2, Mail, Lock, Underline } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { signIn } from '@/lib/auth-client';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const message = searchParams.get('message');

    if (errorParam === 'access_denied' && message) {
      toast.error('Access Denied', {
        description: message,
      });
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const { error: authError } = await signIn.email({ email, password });
      if (authError) {
        setError(authError.message || 'Invalid email or password.');
        return;
      }
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      window.location.href = redirectTo;
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
              Organizer Portal
            </div>
            <h1 className="mt-8 text-4xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
              Manage your hackathons with precision.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/60">
              Create events, manage teams, and oversee judging. The command center for world-class hackathons.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {[
              { label: 'Platform Uptime', value: '99.9%' },
              { label: 'Global Reach', value: 'Unlimited' },
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
                Secure Access
              </div>
              <CardTitle className="text-3xl text-white">Organizer Login</CardTitle>
              <CardDescription className="text-white/60">
                Sign in to access the organizer dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-white/80">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="border-white/20 bg-white/5 pl-10 text-white placeholder:text-white/30 focus-visible:ring-[#CCFF00]/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-white/80">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="border-white/20 bg-white/5 pl-10 text-white placeholder:text-white/30 focus-visible:ring-[#CCFF00]/50"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#CCFF00] text-black font-bold hover:bg-[#CCFF00]/90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <p className="text-center text-xs text-white/40">
                  By continuing you agree to the DevSage <a onClick={()=>window.open('https://devsage.org/terms', '_blank')} className="underline">Terms of Service</a> and <a onClick={()=>window.open('https://devsage.org/privacy', '_blank')} className="underline"> Privacy Policy.</a>.
                </p>
              </form>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </div>
  );
}