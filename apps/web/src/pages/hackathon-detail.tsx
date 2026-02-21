import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/api';
import { Trophy, Calendar, Users, ArrowRight, Code, Clock, MapPin, Globe, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
    prizes: any[];
}

export function HackathonDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [hackathon, setHackathon] = useState<Hackathon | null>(null);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);

    useEffect(() => {
        async function fetchHackathon() {
            try {
                const res = await apiRequest<{ data: Hackathon }>(`/api/v1/hackathons/${slug}`);
                setHackathon({ ...res.data, name: res.data.title || res.data.name });
            } catch {
                setHackathon(null);
            } finally {
                setLoading(false);
            }
        }
        if (slug) {
            fetchHackathon();
        }
    }, [slug]);

    const handleRegister = async () => {
        setRegistering(true);
        try {
            // In a fully built auth flow, this might first redirect to /login
            // For now we will hit the teams API to register the user by creating a team
            // Or we can just show an alert if it requires a specific modal.
            alert('Registration feature coming soon! You will be able to form teams here.');
            // Example API call to form a team (commented out for now to prevent unauthorized errors if not logged in):
            // await apiRequest(`/api/v1/hackathons/${slug}/teams`, {
            //   method: 'POST',
            //   body: JSON.stringify({ name: 'My Solo Team' })
            // });
        } catch (err) {
            console.error(err);
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
                        <button className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-semibold text-lg transition-all text-white/80">
                            View Rules
                        </button>
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
                            {/* If it's markdown, we could render it properly, but for now we'll just display it */}
                            <p className="whitespace-pre-wrap">{hackathon.description}</p>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
