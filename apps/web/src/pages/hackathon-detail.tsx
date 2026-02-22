import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiRequest, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Trophy, Calendar, Users, ArrowRight, Code, Clock, Globe, Sparkles, GitBranch, Tag, ScrollText } from 'lucide-react';

interface Hackathon {
    id: string;
    name: string;
    title: string;
    slug: string;
    tagline: string | null;
    description: string | null;
    rules_md: string | null;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
    judging_starts: string | null;
    min_team_size: number;
    max_team_size: number;
    max_teams: number | null;
    registration_mode: string;
    prizes: unknown[];
}

interface MyTeam {
    id: string;
    name: string;
    status: string;
}

export function HackathonDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [hackathon, setHackathon] = useState<Hackathon | null>(null);
    const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [showRegisterDialog, setShowRegisterDialog] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [regMode, setRegMode] = useState<'create' | 'join'>('create');
    const [regError, setRegError] = useState('');
    const [showRules, setShowRules] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await apiRequest<{ data: Hackathon }>(`/api/v1/hackathons/${slug}`);
                setHackathon({ ...res.data, name: res.data.title || res.data.name });

                if (isAuthenticated) {
                    try {
                        const teamRes = await apiRequest<{ ok: boolean; data: MyTeam }>(`/api/v1/hackathons/${slug}/teams/me`);
                        setMyTeam(teamRes.data);
                    } catch {
                        setMyTeam(null);
                    }
                }
            } catch {
                setHackathon(null);
            } finally {
                setLoading(false);
            }
        }
        if (slug && !authLoading) {
            fetchData();
        }
    }, [slug, isAuthenticated, authLoading]);

    const handleRegister = () => {
        if (!isAuthenticated) {
            navigate(`/login?redirect=${encodeURIComponent(`/hackathons/${slug}`)}`);
            return;
        }
        if (myTeam) {
            navigate(`/hackathons/${slug}/team`);
            return;
        }
        setShowRegisterDialog(true);
    };

    const handleCreateTeam = async () => {
        if (!teamName.trim()) return;
        setRegistering(true);
        setRegError('');
        try {
            const res = await apiRequest<{ ok: boolean; data: MyTeam }>(`/api/v1/hackathons/${slug}/teams`, {
                method: 'POST',
                body: JSON.stringify({ name: teamName.trim() }),
            });
            setMyTeam(res.data);
            setShowRegisterDialog(false);
        } catch (err) {
            setRegError(err instanceof ApiError ? err.message : 'Failed to create team');
        } finally {
            setRegistering(false);
        }
    };

    const handleJoinTeam = async () => {
        if (!joinCode.trim()) return;
        setRegistering(true);
        setRegError('');
        try {
            await apiRequest(`/api/v1/invites/team/${joinCode.trim()}`, { method: 'POST' });
            const teamRes = await apiRequest<{ ok: boolean; data: MyTeam }>(`/api/v1/hackathons/${slug}/teams/me`);
            setMyTeam(teamRes.data);
            setShowRegisterDialog(false);
        } catch (err) {
            setRegError(err instanceof ApiError ? err.message : 'Failed to join team');
        } finally {
            setRegistering(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="h-10 w-10 border-2 border-white/20 border-t-[#CCFF00] rounded-full" />
            </div>
        );
    }

    if (!hackathon) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <Trophy className="h-16 w-16 text-white/20 mb-4" />
                <h1 className="text-3xl font-bold mb-2">Hackathon Not Found</h1>
                <p className="text-white/40 max-w-sm text-center">We couldn't find the hackathon you were looking for. It may have been removed.</p>
                <button onClick={() => navigate('/hackathons')} className="mt-8 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-full font-medium transition-colors">
                    Browse Hackathons
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-hidden selection:bg-[#CCFF00]/30 selection:text-[#CCFF00]">
            {/* Dynamic Background */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex justify-center">
                <div className="absolute -top-[20%] w-[120%] h-[60%] bg-[radial-gradient(ellipse_at_top,#CCFF0015_0%,transparent_60%)] blur-[100px]" />
            </div>

            <div className="relative z-10 mx-auto max-w-5xl px-6 py-20 lg:py-32">

                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto"
                >
                    <div className="flex justify-center items-center gap-3 mb-6">
                        <span className="px-3 py-1 bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#CCFF00] rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5" />
                            {hackathon.status === 'active' ? 'Live Now' : hackathon.status}
                        </span>
                    </div>

                    <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6">
                        {hackathon.name}
                    </h1>

                    {hackathon.tagline && (
                        <p className="text-xl lg:text-2xl text-white/60 mb-10 leading-relaxed font-light">
                            {hackathon.tagline}
                        </p>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        {myTeam ? (
                            <Link
                                to={`/hackathons/${slug}/team`}
                                className="w-full sm:w-auto px-8 py-4 bg-[#CCFF00] hover:bg-[#bbf000] text-black rounded-full font-bold text-lg shadow-[0_0_40px_-10px_#CCFF00] transition-all flex items-center justify-center gap-3 group"
                            >
                                <Users className="w-5 h-5" />
                                View My Team
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        ) : hackathon.status === 'active' ? (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleRegister}
                                disabled={registering}
                                className="w-full sm:w-auto px-8 py-4 bg-[#CCFF00] hover:bg-[#bbf000] text-black rounded-full font-bold text-lg shadow-[0_0_40px_-10px_#CCFF00] transition-all flex items-center justify-center gap-3 group"
                            >
                                {registering ? 'Processing...' : 'Register Now'}
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </motion.button>
                        ) : null}

                        {(hackathon.status === 'completed' || hackathon.status === 'judging') && (
                            <Link
                                to={`/hackathons/${slug}/leaderboard`}
                                className="w-full sm:w-auto px-8 py-4 bg-[#CCFF00] hover:bg-[#bbf000] text-black rounded-full font-bold text-lg transition-all flex items-center justify-center gap-3"
                            >
                                <Trophy className="w-5 h-5" />
                                View Leaderboard
                            </Link>
                        )}

                        {hackathon.rules_md && (
                            <button
                                onClick={() => setShowRules(!showRules)}
                                className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold text-lg transition-all text-white/80 flex items-center justify-center gap-2"
                            >
                                <ScrollText className="w-5 h-5" />
                                {showRules ? 'Hide Rules' : 'View Rules'}
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* Info Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20"
                >
                    {[
                        { label: 'Date', value: hackathon.starts_at ? new Date(hackathon.starts_at).toLocaleDateString() : 'TBA', icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                        { label: 'Team Size', value: `${hackathon.min_team_size} - ${hackathon.max_team_size} members`, icon: Users, color: 'text-violet-400', bg: 'bg-violet-400/10' },
                        { label: 'Location', value: 'Online / Global', icon: Globe, color: 'text-sky-400', bg: 'bg-sky-400/10' },
                    ].map((stat, i) => (
                        <div key={i} className="p-6 rounded-3xl border border-white/5 bg-white/2 hover:bg-white-[0.04] transition-colors relative overflow-hidden group">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-white/40 text-sm font-medium mb-1">{stat.label}</p>
                                    <h3 className="text-xl font-semibold text-white/90">{stat.value}</h3>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Description Section */}
                {hackathon.description && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="mt-16 p-8 lg:p-12 rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md"
                    >
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <Code className="text-[#CCFF00] w-6 h-6" /> About The Event
                        </h2>
                        <div className="prose prose-invert prose-lg max-w-none text-white/70 leading-relaxed font-light">
                            <p className="whitespace-pre-wrap">{hackathon.description}</p>
                        </div>
                    </motion.div>
                )}

                {/* Rules Section */}
                {showRules && hackathon.rules_md && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 p-8 lg:p-12 rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md"
                    >
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <ScrollText className="text-[#CCFF00] w-6 h-6" /> Rules
                        </h2>
                        <div className="prose prose-invert prose-lg max-w-none text-white/70 leading-relaxed font-light">
                            <p className="whitespace-pre-wrap">{hackathon.rules_md}</p>
                        </div>
                    </motion.div>
                )}

                {/* How It Works */}
                {hackathon.status === 'active' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                        className="mt-8 p-8 lg:p-12 rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md"
                    >
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <GitBranch className="text-[#CCFF00] w-6 h-6" /> How It Works
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { step: '1', title: 'Register & Form Team', desc: 'Sign up, create or join a team, and link your GitHub repository.', icon: Users },
                                { step: '2', title: 'Build & Push', desc: 'Code your project and push to your linked GitHub repo.', icon: Code },
                                { step: '3', title: 'Submit via Git Tag', desc: 'Push a git tag (e.g. submission_v1) to submit. No forms needed!', icon: Tag },
                            ].map((item) => (
                                <div key={item.step} className="text-center">
                                    <div className="w-12 h-12 rounded-full bg-[#CCFF00]/10 text-[#CCFF00] flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                                        {item.step}
                                    </div>
                                    <h3 className="font-semibold mb-2">{item.title}</h3>
                                    <p className="text-sm text-white/40">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Registration Dialog */}
            {showRegisterDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md p-8 rounded-3xl border border-white/10 bg-[#0a0a0a]"
                    >
                        <h2 className="text-2xl font-bold mb-6">Join Hackathon</h2>

                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => { setRegMode('create'); setRegError(''); }}
                                className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${regMode === 'create' ? 'bg-[#CCFF00] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                                Create Team
                            </button>
                            <button
                                onClick={() => { setRegMode('join'); setRegError(''); }}
                                className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${regMode === 'join' ? 'bg-[#CCFF00] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                                Join Team
                            </button>
                        </div>

                        {regError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                {regError}
                            </div>
                        )}

                        {regMode === 'create' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-white/60 mb-2">Team Name</label>
                                    <input
                                        type="text"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        placeholder="e.g., Team Rocket"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#CCFF00]/50"
                                    />
                                </div>
                                <button
                                    onClick={handleCreateTeam}
                                    disabled={registering || !teamName.trim()}
                                    className="w-full py-3 bg-[#CCFF00] hover:bg-[#bbf000] text-black rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {registering ? 'Creating...' : 'Create & Register'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-white/60 mb-2">Team Invite Code</label>
                                    <input
                                        type="text"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value)}
                                        placeholder="Paste your invite code"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#CCFF00]/50"
                                    />
                                </div>
                                <button
                                    onClick={handleJoinTeam}
                                    disabled={registering || !joinCode.trim()}
                                    className="w-full py-3 bg-[#CCFF00] hover:bg-[#bbf000] text-black rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {registering ? 'Joining...' : 'Join Team'}
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => { setShowRegisterDialog(false); setRegError(''); }}
                            className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
