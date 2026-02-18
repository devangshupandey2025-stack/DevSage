/* ─────────────────────────────────────────────────────────────
   NoTeamCTA — Call-to-action when participant has no team
   
   Prompts user to create or join a team, with invite code
   entry and team creation link.
   ───────────────────────────────────────────────────────────── */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ArrowRight, UserPlus, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Hackathon } from '../types';

interface NoTeamCTAProps {
  hackathon: Hackathon;
}

export function NoTeamCTA({ hackathon }: NoTeamCTAProps) {
  const canRegister =
    hackathon.status === 'draft' || hackathon.status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-dashed border-white/10 bg-white/2 p-8 md:p-12"
    >
      <div className="max-w-lg mx-auto text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/20">
              <Users className="h-7 w-7 text-[#CCFF00]" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">!</span>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {canRegister
            ? "You haven't joined a team yet"
            : 'No team found'}
        </h2>
        <p className="text-sm text-white/40 mb-8 max-w-md mx-auto">
          {canRegister
            ? 'Create a new team or join an existing one with an invite code to start participating.'
            : 'Registration is no longer open for this hackathon. If you have an invite code, try joining a team.'}
        </p>

        {canRegister && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={`/hackathons/${hackathon.slug}`}>
              <Button className="bg-[#CCFF00] text-black hover:bg-[#CCFF00]/80 font-semibold px-6">
                <UserPlus className="h-4 w-4 mr-2" />
                Create a Team
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>

            <Link to={`/hackathons/${hackathon.slug}`}>
              <Button
                variant="outline"
                className="border-white/15 text-white/60 hover:text-white hover:bg-white/5 px-6"
              >
                <Ticket className="h-4 w-4 mr-2" />
                Join with Code
              </Button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
