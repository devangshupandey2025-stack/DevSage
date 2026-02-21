import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

// Online map images from Wikimedia Commons (CC0 licensed)
const regionMapImages: Record<string, string> = {
  'Chennai, Tamil Nadu, INDIA': 'data:image/jpeg;base64,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',
};

// Sparkle positions scattered around the popup
const sparklePositions = [
  { top: '10%', left: '5%', delay: 0 },
  { top: '5%', right: '15%', delay: 0.5 },
  { bottom: '15%', left: '10%', delay: 1 },
  { bottom: '8%', right: '8%', delay: 1.5 },
  { top: '50%', left: '2%', delay: 0.8 },
  { top: '30%', right: '3%', delay: 1.2 },
];

// Region row with hover-triggered map popup + glittering border
function RegionRow({
  row,
  maxCount,
  isLast,
}: {
  row: { region: string; count: number; emoji: string };
  maxCount: number;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const mapUrl = regionMapImages[row.region];

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Row */}
      <div
        className={`flex items-center justify-between py-2 cursor-pointer transition-all duration-200 ${
          !isLast ? 'border-b border-white/[0.03]' : ''
        } ${hovered ? 'bg-white/[0.04] -mx-2 px-2 rounded-lg' : ''}`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`text-sm filter transition-all duration-200 ${hovered ? '' : 'grayscale'}`}>
            {row.emoji}
          </span>
          <span className={`text-xs transition-colors duration-200 ${hovered ? 'text-white/70' : 'text-white/45'}`}>
            {row.region}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-12 h-1 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full bg-sky-400/40" style={{ width: `${(row.count / maxCount) * 100}%` }} />
          </div>
          <span className="text-[11px] font-bold tabular-nums text-white/50">{row.count}</span>
        </div>
      </div>

      {/* Floating map popup */}
      <AnimatePresence>
        {hovered && mapUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 3, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 pointer-events-none"
          >
            {/* Glitter border wrapper */}
            <div className="relative p-[2px] rounded-2xl">
              {/* Spinning conic-gradient = glittering border */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="absolute inset-[-100%] glitter-gradient" />
              </div>

              {/* Inner card */}
              <div className="relative rounded-[14px] bg-[#0a0a0a] p-5 w-52 z-10">
                {/* Sparkle particles */}
                {sparklePositions.map((pos, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-sky-400"
                    style={pos as React.CSSProperties}
                    animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
                    transition={{
                      duration: 2,
                      delay: pos.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                ))}

                {/* Online map image */}
                <div className="relative mb-3 rounded-lg overflow-hidden">
                  {/* Subtle dot-grid overlay */}
                  <div
                    className="absolute inset-0 z-10 pointer-events-none"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                      backgroundSize: '10px 10px',
                    }}
                  />
                  {/* Gradient overlay for tinting */}
                  <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-br from-sky-500/10 via-transparent to-violet-500/10" />
                  <img
                    src={mapUrl}
                    alt={`Map of ${row.region}`}
                    className="w-full h-auto max-h-36 object-contain invert brightness-75 opacity-50"
                    loading="eager"
                    draggable={false}
                  />
                </div>

                {/* Label */}
                <div className="text-center">
                  <span className="text-sm font-bold text-white/80">
                    {row.emoji} {row.region}
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="text-xs text-sky-400/70 font-medium">{row.count}</span>
                    <span className="text-[10px] text-white/30">participants</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Down-arrow caret */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 bg-[#0a0a0a] rotate-45 border-r border-b border-sky-400/20" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
            <div className="space-y-0.5">
              {[
                { region: 'Chennai, Tamil Nadu, INDIA', count: 2, emoji: '🌎' },
              ].map((row, idx, arr) => (
                <RegionRow
                  key={row.region}
                  row={row}
                  maxCount={65}
                  isLast={idx === arr.length - 1}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
