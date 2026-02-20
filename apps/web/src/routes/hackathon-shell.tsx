import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Clock,
  GitBranch,
  FileCode,
  AlertCircle,
  BookOpen,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/hackathon-shell')({
  component: HackathonShellPage,
});

// Stubbed hackathon data — will be replaced by API fetch in future story
const STUBBED_HACKATHON = {
  name: 'DevSage Launch Hackathon 2026',
  tagline: 'Build something extraordinary in 48 hours',
  description:
    'Join hundreds of developers, designers, and innovators for our flagship hackathon. Push your limits, ship real code, and compete for prizes worth over 1,00,000.',
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function HackathonShellPage() {
  const h = STUBBED_HACKATHON;

  return (
    <main className="mx-auto max-w-[960px] px-6 py-10">
      {/* Live data badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-400">
          <AlertCircle className="h-3.5 w-3.5" />
          Live data coming soon
        </div>

        {/* Header */}
        <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">{h.name}</h1>
        <p className="mt-3 text-lg text-[#CCFF00]/80">{h.tagline}</p>
        <p className="mt-4 text-white/60 leading-relaxed">{h.description}</p>

        {/* Dates */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: CalendarDays, label: 'Starts', value: formatDate(h.starts_at) },
            { icon: CalendarDays, label: 'Ends', value: formatDate(h.ends_at) },
            { icon: Clock, label: 'Submission Deadline', value: formatDate(h.submission_deadline) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40">
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </div>
              <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tracks */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-12"
      >
        <h2 className="text-xl font-bold text-white">Tracks</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {h.tracks.map((track) => (
            <span
              key={track}
              className="rounded-full border border-[#CCFF00]/20 bg-[#CCFF00]/10 px-4 py-1.5 text-sm font-medium text-[#CCFF00]"
            >
              {track}
            </span>
          ))}
        </div>
      </motion.section>

      {/* Rules */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-12"
      >
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
      </motion.section>

      {/* Submit via Git Tags */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-12"
      >
        <div className="rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.03] p-8">
          <div className="flex items-center gap-3">
            <GitBranch className="h-6 w-6 text-[#CCFF00]" />
            <h2 className="text-xl font-bold text-white">Submit via Git Tags</h2>
          </div>
          <p className="mt-4 text-sm text-white/60 leading-relaxed">
            DevSage uses a git-native submission workflow. When you push a tag matching the configured
            pattern, our webhook automatically captures your submission with a server-side timestamp.
            No forms, no uploads — just push your code.
          </p>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-widest text-white/40">Tag Pattern</p>
            <code className="mt-2 block rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-[#CCFF00]">
              {h.tag_pattern}
            </code>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-widest text-white/40">Example</p>
            <code className="mt-2 block rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-white/80">
              git tag r1_submission_v1 && git push origin --tags
            </code>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-white/40" />
            <a href="#" className="text-sm text-[#CCFF00]/70 hover:text-[#CCFF00] hover:underline">
              Read the full submission documentation
            </a>
          </div>
        </div>
      </motion.section>

      {/* Manual SHA Upload (Coming Soon) */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mt-8"
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          <div className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-white/30" />
            <h2 className="text-xl font-bold text-white/40">Manual SHA Upload</h2>
            <span className="rounded-full bg-white/10 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Coming soon
            </span>
          </div>
          <p className="mt-4 text-sm text-white/40">
            Can&apos;t use git tags? A manual commit SHA upload fallback is coming soon.
            You&apos;ll be able to paste your commit hash directly.
          </p>
          <Button
            disabled
            className="mt-6 bg-white/10 text-white/40 cursor-not-allowed"
            title="Manual SHA upload is not yet available"
          >
            <FileCode className="mr-2 h-4 w-4" />
            Upload Commit SHA (Coming Soon)
          </Button>
        </div>
      </motion.section>
    </main>
  );
}
