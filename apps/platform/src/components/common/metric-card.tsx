import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changePositive?: boolean;
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, change, changePositive, className }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04]',
        className
      )}
    >
      {/* Subtle hover glow */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#CCFF00]/[0.04] blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CCFF00]/10 text-[#CCFF00]">
            <Icon className="h-5 w-5" />
          </div>
          {change && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold',
                changePositive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}
            >
              {change}
            </span>
          )}
        </div>
        <p className="mt-4 text-3xl font-black tracking-tight text-white">{value}</p>
        <p className="mt-1 text-sm text-white/35">{label}</p>
      </div>
    </motion.div>
  );
}
