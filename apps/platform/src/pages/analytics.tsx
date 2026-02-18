import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/common';
import {
  Users,
  FileText,
  Trophy,
  Clock,
  TrendingUp,
  Globe,
  Sparkles,
  Activity,
  Zap,
} from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

// Enhanced chart bar component
function BarChartSimple({ data, max, colorClass }: { data: number[]; max: number; colorClass: string }) {
  return (
    <div className="flex items-end gap-1 h-28 w-full">
      {data.map((val, i) => (
        <motion.div
          key={i}
          className="flex-1 relative group"
          initial={{ height: 0 }}
          animate={{ height: `${(val / max) * 100}%` }}
          transition={{ duration: 0.6, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* The Bar */}
          <div className={`w-full h-full rounded-sm ${colorClass} opacity-40 group-hover:opacity-100 transition-opacity duration-200`} />
          {/* Gradient Overlay */}
          <div className={`absolute inset-x-0 bottom-0 h-full rounded-sm bg-gradient-to-t ${colorClass.replace('bg-', 'from-').replace('/40', '/60')} to-transparent`} />
        </motion.div>
      ))}
    </div>
  );
}

// Reusable Stat Card Component
function StatCard({ icon: Icon, label, value, trend, color, bgColor }: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  trend?: string; 
  color: string; 
  bgColor: string;
}) {
  return (
    <motion.div
      variants={item}
      className="relative flex flex-col justify-between h-40 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden group"
    >
      {/* Decorative Icon Background */}
      <div className={`absolute -top-4 -right-4 w-24 h-24 ${bgColor} rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500`} />
      
      <div className="relative flex justify-between items-start z-10">
        <div className={`p-2.5 rounded-xl ${bgColor} border border-white/[0.05]`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-bold ${color} bg-white/[0.03] px-2 py-1 rounded-full`}>
            <TrendingUp className="w-3 h-3" />
            {trend}
          </div>
        )}
      </div>
      
      <div className="relative z-10">
        <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
        <p className="text-xs text-white/40 mt-1 font-medium">{label}</p>
      </div>
    </motion.div>
  );
}

export function AnalyticsPage() {
  const { slug } = useParams<{ slug: string }>();

  // Mock data kept exactly as provided
  const submissionsOverTime = [2, 5, 3, 8, 12, 7, 15, 20, 18, 25, 22, 30, 28, 35];
  const registrationsOverTime = [5, 12, 8, 15, 20, 18, 10, 22, 25, 15, 8, 5, 3, 2];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="relative space-y-8 max-w-7xl mx-auto"
    >
      {/* Background Ambient Light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-96 bg-[#CCFF00]/[0.02] blur-[120px] pointer-events-none" />

      <PageHeader
        title="Analytics"
        description="Real-time insights and metrics for your hackathon."
      />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        
        {/* Top Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            icon={Users} 
            label="Total Registrations" 
            value={168} 
            trend="+12%" 
            color="text-emerald-400" 
            bgColor="bg-emerald-500/10" 
          />
          <StatCard 
            icon={FileText} 
            label="Total Submissions" 
            value={42} 
            trend="+5" 
            color="text-sky-400" 
            bgColor="bg-sky-500/10" 
          />
          <StatCard 
            icon={Trophy} 
            label="Avg Judge Score" 
            value="8.4" 
            color="text-amber-400" 
            bgColor="bg-amber-500/10" 
          />
          <StatCard 
            icon={Clock} 
            label="Avg Submission Time" 
            value="3.2h" 
            color="text-violet-400" 
            bgColor="bg-violet-500/10" 
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submissions Chart */}
          <motion.div
            variants={item}
            className="relative rounded-2xl border border-white/[0.06] bg-[#0A0A0A] p-6 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#CCFF00]/[0.02] to-transparent opacity-50" />
            
            <div className="relative flex items-center justify-between mb-6 z-10">
              <div>
                <h3 className="text-base font-bold text-white/90">Submissions Volume</h3>
                <p className="text-[11px] text-white/35 mt-0.5 font-medium">Last 14 days</p>
              </div>
              <div className="flex items-center gap-1.5 text-[#CCFF00] bg-[#CCFF00]/10 px-2.5 py-1 rounded-full">
                <Activity className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">+24% Growth</span>
              </div>
            </div>
            
            <div className="relative z-10 border border-white/[0.03] rounded-xl p-3 bg-black/20">
              <BarChartSimple data={submissionsOverTime} max={35} colorClass="bg-[#CCFF00]" />
              <div className="flex justify-between mt-3 text-[9px] font-mono text-white/20">
                <span>Mar 1</span>
                <span>Mar 7</span>
                <span>Mar 14</span>
              </div>
            </div>
          </motion.div>

          {/* Registrations Chart */}
          <motion.div
            variants={item}
            className="relative rounded-2xl border border-white/[0.06] bg-[#0A0A0A] p-6 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] to-transparent opacity-50" />

            <div className="relative flex items-center justify-between mb-6 z-10">
              <div>
                <h3 className="text-base font-bold text-white/90">Registrations Flow</h3>
                <p className="text-[11px] text-white/35 mt-0.5 font-medium">Last 14 days</p>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">Total: 168</span>
              </div>
            </div>

            <div className="relative z-10 border border-white/[0.03] rounded-xl p-3 bg-black/20">
              <BarChartSimple data={registrationsOverTime} max={25} colorClass="bg-emerald-400" />
              <div className="flex justify-between mt-3 text-[9px] font-mono text-white/20">
                <span>Mar 1</span>
                <span>Mar 7</span>
                <span>Mar 14</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Tech Stack */}
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="p-1.5 rounded-lg bg-cyan-500/10">
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              <h3 className="text-sm font-bold text-white/80">Top Technologies</h3>
            </div>
            <div className="space-y-4">
              {[
                { name: 'React', pct: 68, color: 'bg-cyan-400' },
                { name: 'Python', pct: 52, color: 'bg-amber-400' },
                { name: 'TypeScript', pct: 45, color: 'bg-blue-400' },
                { name: 'Node.js', pct: 38, color: 'bg-emerald-400' },
                { name: 'Rust', pct: 12, color: 'bg-orange-400' },
              ].map((tech, i) => (
                <div key={tech.name} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white/50 font-medium group-hover:text-white/70 transition-colors">{tech.name}</span>
                    <span className="text-[10px] tabular-nums text-white/25 font-mono">{tech.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${tech.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${tech.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Team Sizes */}
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <div className="flex items-center gap-2 mb-6">
               <div className="p-1.5 rounded-lg bg-violet-500/10">
                <Users className="w-4 h-4 text-violet-400" />
              </div>
              <h3 className="text-sm font-bold text-white/80">Team Sizes</h3>
            </div>
            <div className="space-y-3">
              {[
                { size: 'Solo', count: 8, pct: 19 },
                { size: 'Duo', count: 12, pct: 29 },
                { size: 'Trio', count: 14, pct: 33 },
                { size: 'Quad', count: 6, pct: 14 },
                { size: 'Large (5+)', count: 2, pct: 5 },
              ].map((row, i) => (
                <div key={row.size} className="flex items-center gap-3 group">
                  <span className="text-[11px] text-white/40 w-16 shrink-0 font-medium">{row.size}</span>
                  <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500/60 to-violet-400/30"
                      initial={{ width: 0 }}
                      animate={{ width: `${row.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-white/30 w-6 text-right font-mono">{row.count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Geographic Distribution */}
          <motion.div
            variants={item}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
             <div className="flex items-center gap-2 mb-6">
               <div className="p-1.5 rounded-lg bg-sky-500/10">
                <Globe className="w-4 h-4 text-sky-400" />
              </div>
              <h3 className="text-sm font-bold text-white/80">Regions</h3>
            </div>
            <div className="space-y-2.5">
              {[
                { region: 'North America', count: 65, emoji: '🌎' },
                { region: 'Europe', count: 48, emoji: '🌍' },
                { region: 'Asia', count: 35, emoji: '🌏' },
                { region: 'South America', count: 12, emoji: '🌎' },
                { region: 'Others', count: 8, emoji: '🌐' },
              ].map((row, idx, arr) => (
                <div key={row.region} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm filter grayscale">{row.emoji}</span>
                    <span className="text-xs text-white/45">{row.region}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                       <div className="h-full bg-sky-400/40" style={{ width: `${(row.count / 65) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums text-white/50">{row.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
