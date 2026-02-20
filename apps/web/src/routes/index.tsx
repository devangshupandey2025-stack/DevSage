import { createFileRoute, Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Zap, GitBranch, Shield, Rocket, ArrowRight } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[80px_80px]" />
          <div className="absolute inset-y-0 left-1/2 w-1/2 bg-[radial-gradient(circle_at_top,#CCFF00/20,transparent_65%)] blur-[60px]" />
          <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-[#CCFF00]/15 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-6 py-24 text-center lg:py-40">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
              <Zap className="h-4 w-4 text-[#CCFF00]" />
              Hackathon Management Platform
            </div>

            <h1 className="mt-8 text-5xl font-black leading-tight tracking-tight text-white md:text-7xl">
              Run hackathons{' '}
              <span className="bg-gradient-to-r from-[#CCFF00] to-[#88DD00] bg-clip-text text-transparent">
                that ship.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 md:text-xl">
              DevSage replaces spreadsheets, Google Forms, and manual score tallying with one end-to-end
              platform. Git-native submissions, automated judging, live leaderboards.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#CCFF00] px-8 py-3.5 text-sm font-bold text-black transition hover:bg-[#CCFF00]/90"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/hackathon-shell"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-8 py-3.5 text-sm font-medium text-white transition hover:bg-white/5"
              >
                View Demo Hackathon
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-3xl font-black text-white md:text-4xl">
            Built for <span className="text-[#CCFF00]">serious</span> hackathons
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/50">
            Everything organizers and participants need, from submission to scoring.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: GitBranch,
              title: 'Git-Native Submissions',
              desc: 'Teams submit via git tags. Webhooks capture every push with cryptographic verification.',
            },
            {
              icon: Shield,
              title: 'Tamper-Proof Audit Trail',
              desc: 'Every action is logged with hash-chain integrity. No disputes, no ambiguity.',
            },
            {
              icon: Rocket,
              title: 'Multi-Round Judging',
              desc: 'Weighted rubrics, auto-assigned judges, real-time scoring progress, elimination gates.',
            },
          ].map((feature) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 transition hover:border-[#CCFF00]/20"
            >
              <feature.icon className="h-8 w-8 text-[#CCFF00]" />
              <h3 className="mt-4 text-lg font-bold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-white/50">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-white/30">
          <p>&copy; {new Date().getFullYear()} DevSage by SHIKDD. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
