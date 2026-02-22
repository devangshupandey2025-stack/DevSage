import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { Code2, User, Mail, Github, ArrowLeft } from 'lucide-react';

export function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <Code2 className="w-6 h-6 text-[#CCFF00]" />
            <span className="text-xl font-bold">DevSage</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-8">My Profile</h1>

          <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-start gap-6">
              {user?.image ? (
                <img src={user.image} alt="" className="w-20 h-20 rounded-full border-2 border-[#CCFF00]/20" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border-2 border-white/10">
                  <User className="w-10 h-10 text-white/30" />
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{user?.name || 'Anonymous'}</h2>
                <div className="flex items-center gap-2 mt-2 text-white/50">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{user?.email}</span>
                </div>
                {user?.github_username && (
                  <div className="flex items-center gap-2 mt-1 text-white/50">
                    <Github className="w-4 h-4" />
                    <a
                      href={`https://github.com/${user.github_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#CCFF00] hover:underline"
                    >
                      @{user.github_username}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={logout}
              className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
