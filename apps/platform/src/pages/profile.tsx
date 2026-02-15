import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/common';
import { Github, Mail, Calendar, Hash, Shield, LogOut } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export function ProfilePage() {
  const { user, isOrganizer, isPlatformAdmin, logout } = useAuth();

  if (!user) return null;

  return (
    <div>
      <PageHeader title="Profile" description="Your account details." />

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Profile card */}
        <motion.div variants={item} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
          <div className="flex items-center gap-6">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="h-20 w-20 rounded-2xl border-2 border-[#CCFF00]/15 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#CCFF00] text-black text-2xl font-black">
                {user.display_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-black text-white/90">{user.display_name}</h2>
              <p className="text-sm text-white/40 mt-0.5">{user.email}</p>
              <div className="flex gap-2 mt-3">
                {isPlatformAdmin && (
                  <span className="rounded-full bg-red-500/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                    Platform Admin
                  </span>
                )}
                {isOrganizer && (
                  <span className="rounded-full bg-[#CCFF00]/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#CCFF00]">
                    Organizer
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: Github, label: 'GitHub Username', value: user.github_username || '—' },
            { icon: Mail, label: 'Email', value: user.email || '—' },
            { icon: Hash, label: 'User ID', value: user.id, mono: true },
            { icon: Calendar, label: 'Joined', value: new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
          ].map((field) => (
            <motion.div
              key={field.label}
              variants={item}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <field.icon className="h-3.5 w-3.5 text-white/25" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{field.label}</span>
              </div>
              <p className={`text-sm text-white/70 ${field.mono ? 'font-mono text-xs' : ''}`}>{field.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <motion.div variants={item}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={logout}
            className="flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-5 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/[0.08]"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
