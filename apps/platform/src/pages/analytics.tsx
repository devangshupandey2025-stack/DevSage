import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageHeader, MetricCard } from '@/components/common';
import {
  BarChart3,
  Users,
  FileText,
  Trophy,
  TrendingUp,
  GitCommit,
  Clock,
  Globe,
} from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

// Mock chart bar component
function BarChartSimple({ data, max }: { data: number[]; max: number }) {
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((val, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t bg-[#CCFF00]/20 relative overflow-hidden"
          initial={{ height: 0 }}
          animate={{ height: `${(val / max) * 100}%` }}
          transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#CCFF00]/30 to-transparent" />
        </motion.div>
      ))}
    </div>
  );
}

export function AnalyticsPage() {
  const { slug } = useParams<{ slug: string }>();

  const submissionsOverTime = [2, 5, 3, 8, 12, 7, 15, 20, 18, 25, 22, 30, 28, 35];
  const registrationsOverTime = [5, 12, 8, 15, 20, 18, 10, 22, 25, 15, 8, 5, 3, 2];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Insights and metrics for your hackathon."
      />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Metrics grid */}
        <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={Users} label="Total Registrations" value={168} />
          <MetricCard icon={FileText} label="Total Submissions" value={42} />
          <MetricCard icon={Trophy} label="Avg Judge Score" value="8.4" />
          <MetricCard icon={Clock} label="Avg Submission Time" value="3.2h" />
        </motion.div>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Submissions over time */}
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-white/80">Submissions</h3>
                <p className="text-[10px] text-white/25 mt-0.5">Over time</p>
              </div>
              <div className="flex items-center gap-1 text-[#CCFF00]">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">+24%</span>
              </div>
            </div>
            <BarChartSimple data={submissionsOverTime} max={35} />
            <div className="flex justify-between mt-2 text-[9px] text-white/15">
              <span>Mar 1</span>
              <span>Mar 14</span>
            </div>
          </motion.div>

          {/* Registrations over time */}
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-white/80">Registrations</h3>
                <p className="text-[10px] text-white/25 mt-0.5">Over time</p>
              </div>
              <div className="flex items-center gap-1 text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">+168</span>
              </div>
            </div>
            <BarChartSimple data={registrationsOverTime} max={25} />
            <div className="flex justify-between mt-2 text-[9px] text-white/15">
              <span>Mar 1</span>
              <span>Mar 14</span>
            </div>
          </motion.div>
        </div>

        {/* Stats breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tech stack breakdown */}
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <h3 className="text-sm font-bold text-white/80 mb-4">Top Technologies</h3>
            <div className="space-y-3">
              {[
                { name: 'React', pct: 68, color: 'bg-cyan-400' },
                { name: 'Python', pct: 52, color: 'bg-amber-400' },
                { name: 'TypeScript', pct: 45, color: 'bg-blue-400' },
                { name: 'Node.js', pct: 38, color: 'bg-emerald-400' },
                { name: 'Rust', pct: 12, color: 'bg-orange-400' },
              ].map((tech, i) => (
                <div key={tech.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/50">{tech.name}</span>
                    <span className="text-[10px] tabular-nums text-white/25">{tech.pct}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${tech.color} opacity-60`}
                      initial={{ width: 0 }}
                      animate={{ width: `${tech.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Team sizes */}
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <h3 className="text-sm font-bold text-white/80 mb-4">Team Sizes</h3>
            <div className="space-y-3">
              {[
                { size: 'Solo (1)', count: 8, pct: 19 },
                { size: 'Duo (2)', count: 12, pct: 29 },
                { size: 'Trio (3)', count: 14, pct: 33 },
                { size: 'Quad (4)', count: 6, pct: 14 },
                { size: '5+', count: 2, pct: 5 },
              ].map((row, i) => (
                <div key={row.size} className="flex items-center gap-3">
                  <span className="text-xs text-white/50 w-16 shrink-0">{row.size}</span>
                  <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[#CCFF00]/40"
                      initial={{ width: 0 }}
                      animate={{ width: `${row.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-white/25 w-6 text-right">{row.count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Geographic distribution */}
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <h3 className="text-sm font-bold text-white/80 mb-4">Regions</h3>
            <div className="space-y-3">
              {[
                { region: 'North America', count: 65, emoji: '🌎' },
                { region: 'Europe', count: 48, emoji: '🌍' },
                { region: 'Asia', count: 35, emoji: '🌏' },
                { region: 'South America', count: 12, emoji: '🌎' },
                { region: 'Others', count: 8, emoji: '🌐' },
              ].map((row) => (
                <div key={row.region} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{row.emoji}</span>
                    <span className="text-xs text-white/50">{row.region}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-white/40">{row.count}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
