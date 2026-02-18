import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void } | ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/8 bg-white/1 px-8 py-16 text-center',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/4 text-white/20 mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-bold text-white/70">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-white/30 leading-relaxed">{description}</p>
      {action && (
        <div className="mt-6">
          {typeof action === 'object' && action !== null && 'label' in action ? (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={(action as { label: string; onClick: () => void }).onClick}
              className="rounded-xl bg-[#CCFF00] px-5 py-2.5 text-sm font-bold text-black transition-shadow hover:shadow-[0_0_24px_rgba(204,255,0,0.25)]"
            >
              {(action as { label: string; onClick: () => void }).label}
            </motion.button>
          ) : (
            action
          )}
        </div>
      )}
    </motion.div>
  );
}
