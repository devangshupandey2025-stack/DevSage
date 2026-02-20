/**
 * Test helpers — export page components stripped from TanStack Router route wrappers.
 * These components are identical to the route components but can be rendered
 * without a full router context.
 */

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  Shield,
  Github,
  Loader2,
  Zap,
  Rocket,
  Trophy,
  Clock,
  CalendarDays,
  Users,
  ArrowRight,
  GitBranch,
  FileCode,
  AlertCircle,
  BookOpen,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/use-auth';
import { useState } from 'react';

/* ─── Login Page ─── */

export function LoginPageForTest() {
  const { signIn } = useAuth();
  const [signingIn, setSigningIn] = useState<'github' | 'google' | null>(null);

  const handleOAuth = async (provider: 'github' | 'google') => {
    setSigningIn(provider);
    try {
      await signIn.social({ provider, callbackURL: '/dashboard' });
    } catch {
      setSigningIn(null);
    }
  };

  return (
    <div>
      <Card className="w-full border-white/10 bg-black/60 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60">
            <Shield className="h-3.5 w-3.5 text-[#CCFF00]" />
            Secure Login
          </div>
          <CardTitle className="text-3xl text-white">Welcome back</CardTitle>
          <CardDescription className="text-white/60">
            Sign in with your preferred provider to continue your hackathon journey.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => handleOAuth('github')}
            disabled={signingIn !== null}
            className="w-full bg-[#CCFF00] text-black font-bold"
          >
            {signingIn === 'github' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Github className="mr-2 h-4 w-4" />
            )}
            Sign in with GitHub
          </Button>

          <Button
            variant="outline"
            onClick={() => handleOAuth('google')}
            disabled={signingIn !== null}
            className="w-full border-white/20 bg-transparent text-white"
          >
            {signingIn === 'google' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Sign in with Google
          </Button>

          <p className="pt-2 text-center text-xs text-white/40">
            By continuing you agree to the DevSage Terms of Participation and Code of Conduct.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Dashboard Page ─── */

export function DashboardPageForTest() {
  const { user, isAuthenticated, isPending } = useAuth();

  if (isPending) {
    return <div>Loading...</div>;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="space-y-10">
        <div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            {user?.image && (
              <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
            )}
            <p className="text-white/50">{user?.email}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {['Upcoming', 'Ongoing', 'Past'].map((tab) => (
            <button key={tab} type="button" className="rounded-full px-4 py-2 text-sm">
              {tab}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

/* ─── Hackathon Shell Page ─── */

const STUBBED_HACKATHON = {
  name: 'DevSage Launch Hackathon 2026',
  tagline: 'Build something extraordinary in 48 hours',
  description: 'Join hundreds of developers for our flagship hackathon.',
  starts_at: '2026-03-15T09:00:00Z',
  ends_at: '2026-03-17T09:00:00Z',
  submission_deadline: '2026-03-17T06:00:00Z',
  rules: [
    'Teams of 2–5 members',
    'All code must be written during the hackathon window',
    'Submissions via git tags only (or manual SHA upload when available)',
    'Each team gets one final submission per round',
    'Late submissions are accepted but flagged — penalty at organizer discretion',
    'No plagiarism — all repos should be original work',
  ],
  tracks: ['Web Platform', 'AI/ML', 'DevTools', 'Open Innovation'],
  tag_pattern: 'r{round}_submission_v{version}',
};

export function HackathonShellPageForTest() {
  const h = STUBBED_HACKATHON;

  return (
    <main className="mx-auto max-w-[960px] px-6 py-10">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-400">
        <AlertCircle className="h-3.5 w-3.5" />
        Live data coming soon
      </div>

      <h1 className="text-4xl font-black tracking-tight text-white">{h.name}</h1>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-white">Rules</h2>
        <ul className="mt-4 space-y-3">
          {h.rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-white/70">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#CCFF00]/10 text-[10px] font-bold text-[#CCFF00]">
                {i + 1}
              </span>
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <div className="rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.03] p-8">
          <div className="flex items-center gap-3">
            <GitBranch className="h-6 w-6 text-[#CCFF00]" />
            <h2 className="text-xl font-bold text-white">Submit via Git Tags</h2>
          </div>
          <div className="mt-6">
            <code className="mt-2 block rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-white/80">
              git tag r1_submission_v1 && git push origin --tags
            </code>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          <Button
            disabled
            className="mt-6 bg-white/10 text-white/40 cursor-not-allowed"
            title="Manual SHA upload is not yet available"
          >
            <FileCode className="mr-2 h-4 w-4" />
            Upload Commit SHA (Coming Soon)
          </Button>
        </div>
      </section>
    </main>
  );
}
