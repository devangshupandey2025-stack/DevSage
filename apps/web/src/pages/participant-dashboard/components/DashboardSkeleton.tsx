/* ─────────────────────────────────────────────────────────────
   DashboardSkeleton — Loading placeholder for the dashboard
   ───────────────────────────────────────────────────────────── */
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-6 w-32 rounded-full bg-white/5" />
        <Skeleton className="h-8 w-80 mt-4 bg-white/5" />
        <Skeleton className="h-4 w-64 mt-2 bg-white/[0.03]" />
      </div>

      {/* Deadline bar skeleton */}
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="h-14 w-48 rounded-xl bg-white/[0.03]"
          />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Team card */}
          <Skeleton className="h-72 rounded-xl bg-white/[0.03]" />
          {/* Submission card */}
          <Skeleton className="h-64 rounded-xl bg-white/[0.03]" />
        </div>
        <div className="space-y-6">
          {/* Checklist */}
          <Skeleton className="h-56 rounded-xl bg-white/[0.03]" />
          {/* Activity */}
          <Skeleton className="h-80 rounded-xl bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}
