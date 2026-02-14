/* ─────────────────────────────────────────────────────────────
   ChecklistPanel — Progress tracker for participant readiness
   
   Shows a step-by-step checklist of tasks the participant
   needs to complete (join team, connect repo, submit, etc.)
   ───────────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChecklistItem } from '../types';

interface ChecklistPanelProps {
  items: ChecklistItem[];
}

export function ChecklistPanel({ items }: ChecklistPanelProps) {
  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="border-white/8 bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[#CCFF00]" />
            Getting Started
          </CardTitle>
          <span className="text-xs text-white/30 font-medium">
            {completed}/{total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#CCFF00] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-1">
        {items.map((item) => {
          const content = (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                item.completed
                  ? 'opacity-50'
                  : 'hover:bg-white/[0.03] cursor-pointer'
              }`}
            >
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-[#CCFF00] mt-0.5 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-white/20 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    item.completed
                      ? 'text-white/40 line-through'
                      : 'text-white/70'
                  }`}
                >
                  {item.label}
                </p>
                <p className="text-[11px] text-white/25 mt-0.5">
                  {item.description}
                </p>
              </div>
            </div>
          );

          if (item.href && !item.completed) {
            return (
              <Link key={item.id} to={item.href}>
                {content}
              </Link>
            );
          }
          return <div key={item.id}>{content}</div>;
        })}

        {completed === total && total > 0 && (
          <div className="rounded-lg bg-[#CCFF00]/5 border border-[#CCFF00]/15 p-3 text-center mt-2">
            <p className="text-xs font-medium text-[#CCFF00]">
              All set! You're ready to go. 🎉
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
