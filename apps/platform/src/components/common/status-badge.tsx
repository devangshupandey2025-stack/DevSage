import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type StatusType =
  | 'draft'
  | 'active'
  | 'judging'
  | 'completed'
  | 'archived';

const statusConfig: Record<StatusType, { label: string; color: string; bg: string; dot: string }> = {
  draft: {
    label: 'Draft',
    color: 'text-white/60',
    bg: 'bg-white/[0.06] border-white/[0.08]',
    dot: 'bg-white/40',
  },
  active: {
    label: 'Hacking',
    color: 'text-[#CCFF00]',
    bg: 'bg-[#CCFF00]/10 border-[#CCFF00]/20',
    dot: 'bg-[#CCFF00]',
  },
  judging: {
    label: 'Judging',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    dot: 'bg-violet-400',
  },
  completed: {
    label: 'Completed',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    dot: 'bg-sky-400',
  },
  archived: {
    label: 'Archived',
    color: 'text-white/30',
    bg: 'bg-white/[0.03] border-white/[0.06]',
    dot: 'bg-white/25',
  },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = 'md', pulse = false, className }: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] ?? statusConfig.draft;
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold',
        config.bg,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <motion.span
        className={cn('h-1.5 w-1.5 rounded-full', config.dot)}
        animate={pulse ? { scale: [1, 1.3, 1] } : undefined}
        transition={pulse ? { duration: 2, repeat: Infinity } : undefined}
      />
      {config.label}
    </span>
  );
}
