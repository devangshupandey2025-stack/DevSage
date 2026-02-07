import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  useInView,
} from 'framer-motion';
import {
  Zap,
  GitBranch,
  Globe,
  Cpu,
  ChevronRight,
  ChevronLeft,
  Star,
  Menu,
  X,
  Shield,
  Rocket,
  Trophy,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Play,
  Github,
  Twitter,
  Linkedin,
  Instagram,
  Code2,
  Layers,
  Box,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ─────────────────────────────────────────────
   CUSTOM CURSOR
   ───────────────────────────────────────────── */
const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a, button, [data-hover]')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', updatePosition);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', updatePosition);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 w-4 h-4 bg-[#CCFF00] rounded-full pointer-events-none z-[9999] mix-blend-difference"
        animate={{
          x: position.x - 8,
          y: position.y - 8,
          scale: isHovering ? 2.5 : 1,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      />
      <motion.div
        className="fixed top-0 left-0 w-10 h-10 border border-white/30 rounded-full pointer-events-none z-[9998]"
        animate={{
          x: position.x - 20,
          y: position.y - 20,
          scale: isHovering ? 1.5 : 1,
        }}
        transition={{ type: 'spring', stiffness: 250, damping: 20 }}
      />
    </>
  );
};

/* ─────────────────────────────────────────────
   NAVBAR
   ───────────────────────────────────────────── */
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 w-full z-50 transition-all duration-700 ${
          scrolled ? 'bg-black/90 backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        <div className="max-w-[1450px] mx-auto px-6 md:px-12 h-20 md:h-24 flex items-center justify-between">
          <motion.div className="relative z-10 cursor-pointer" whileHover={{ scale: 1.05 }}>
            <span className="text-2xl md:text-3xl font-black tracking-tighter text-white">
              DEV<span className="text-[#CCFF00]">SAGE</span>
            </span>
          </motion.div>

          <div className="hidden lg:flex items-center gap-12">
            {['Platform', 'Solutions', 'Developers', 'Enterprise', 'Pricing'].map(
              (item, i) => (
                <motion.span
                  key={item}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors relative group cursor-pointer"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                >
                  {item}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#CCFF00] group-hover:w-full transition-all duration-300" />
                </motion.span>
              ),
            )}
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <motion.button
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/login')}
            >
              Sign In
            </motion.button>
            <motion.button
              className="bg-[#CCFF00] text-black text-sm font-bold px-6 py-3 rounded-full hover:bg-white transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/login')}
            >
              Get Started
            </motion.button>
          </div>

          <button
            type="button"
            className="lg:hidden text-white z-50"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ clipPath: 'circle(0% at calc(100% - 40px) 40px)' }}
            animate={{ clipPath: 'circle(150% at calc(100% - 40px) 40px)' }}
            exit={{ clipPath: 'circle(0% at calc(100% - 40px) 40px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-[#CCFF00] z-40 flex items-center justify-center"
          >
            <nav className="flex flex-col items-center gap-8">
              {['Platform', 'Solutions', 'Developers', 'Enterprise', 'Pricing'].map(
                (item, i) => (
                  <motion.button
                    type="button"
                    key={item}
                    className="text-5xl md:text-7xl font-black text-black hover:text-white transition-colors bg-transparent border-none cursor-pointer"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i + 0.3 }}
                    onClick={() => setIsOpen(false)}
                  >
                    {item}
                  </motion.button>
                ),
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ─────────────────────────────────────────────
   HERO
   ───────────────────────────────────────────── */
const Hero = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black"
    >
      {/* Background grid */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(204,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(204,255,0,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#CCFF00]/10 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#CCFF00]/5 rounded-full blur-[120px]"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <motion.div
        style={{ y, opacity, scale }}
        className="relative z-10 max-w-[1450px] mx-auto px-6 md:px-12 text-center"
      >
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8"
        >
          <Sparkles className="w-4 h-4 text-[#CCFF00]" />
          <span className="text-sm text-white/70">
            The Future of Hackathons is Here
          </span>
          <ArrowRight className="w-4 h-4 text-[#CCFF00]" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-[120px] font-black tracking-tighter leading-[0.9] mb-8"
        >
          <span className="text-white">BUILD</span>
          <br />
          <span className="text-[#CCFF00]">BEYOND</span>
          <br />
          <span className="text-white/40">LIMITS</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-lg md:text-xl text-white/50 max-w-xl mx-auto mb-12"
        >
          The platform where developers compete, collaborate, and create the
          impossible. Join 50,000+ builders shaping the future.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.button
            className="group bg-[#CCFF00] text-black font-bold px-8 py-4 rounded-full text-lg flex items-center gap-2 hover:bg-white transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login')}
          >
            Start Building
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
          <motion.button
            className="group border border-white/20 text-white font-medium px-8 py-4 rounded-full text-lg flex items-center gap-2 hover:bg-white/10 transition-all"
            whileHover={{ scale: 1.05 }}
          >
            <Play className="w-5 h-5" />
            Watch Demo
          </motion.button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="flex items-center justify-center gap-12 mt-20"
        >
          {[
            { value: '50K+', label: 'Builders' },
            { value: '2,400+', label: 'Hackathons' },
            { value: '$12M+', label: 'In Prizes' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-black text-white">
                {stat.value}
              </div>
              <div className="text-sm text-white/40">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-2"
        >
          <motion.div className="w-1 h-2 bg-[#CCFF00] rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ─────────────────────────────────────────────
   MARQUEE TEXT
   ───────────────────────────────────────────── */
interface MarqueeTextProps {
  children: React.ReactNode;
  direction?: number;
}

const MarqueeText = ({ children, direction = 1 }: MarqueeTextProps) => {
  return (
    <div className="overflow-hidden py-6 bg-[#CCFF00] rotate-[-1deg] scale-105">
      <motion.div
        className="flex whitespace-nowrap gap-8"
        animate={{ x: direction > 0 ? [0, -1920] : [-1920, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={`m${String(i)}`} className="text-black font-black text-2xl md:text-4xl">
            {children} <span className="text-black/20">✦</span>{' '}
          </span>
        ))}
      </motion.div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   BENTO GRID
   ───────────────────────────────────────────── */
interface BentoCard {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  span: string;
}

const BentoGrid = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const cards: BentoCard[] = [
    {
      title: 'Real-Time Collaboration',
      description:
        'Code together in real-time with your team. Built-in version control, live cursors, and instant sync.',
      icon: Zap,
      gradient: 'from-yellow-500/20 to-transparent',
      span: 'md:col-span-2',
    },
    {
      title: 'AI-Powered Matching',
      description:
        'Our AI matches you with the perfect teammates based on skills, timezone, and experience.',
      icon: Cpu,
      gradient: 'from-purple-500/20 to-transparent',
      span: 'md:col-span-1',
    },
    {
      title: 'Global Network',
      description:
        'Connect with developers from 120+ countries. Build diverse teams that bring unique perspectives.',
      icon: Globe,
      gradient: 'from-blue-500/20 to-transparent',
      span: 'md:col-span-1',
    },
    {
      title: 'Smart Submissions',
      description:
        'Git integration, automated testing, deployment previews. Submit with confidence every time.',
      icon: GitBranch,
      gradient: 'from-green-500/20 to-transparent',
      span: 'md:col-span-2',
    },
    {
      title: 'Enterprise Security',
      description:
        'SOC 2 compliant, end-to-end encryption, SSO support. Your code and data are always protected.',
      icon: Shield,
      gradient: 'from-red-500/20 to-transparent',
      span: 'md:col-span-1',
    },
    {
      title: 'Instant Deployment',
      description:
        'One-click deploy to any cloud provider. Showcase your project to judges and the world instantly.',
      icon: Rocket,
      gradient: 'from-orange-500/20 to-transparent',
      span: 'md:col-span-2',
    },
  ];

  return (
    <section className="py-32 bg-black relative" ref={ref}>
      <div className="max-w-[1450px] mx-auto px-6 md:px-12">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <span className="text-[#CCFF00] text-sm font-bold tracking-widest uppercase">
            Features
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white mt-4 tracking-tight">
            Everything You Need
            <br />
            <span className="text-white/30">To Win.</span>
          </h2>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className={`${card.span} group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 hover:bg-white/[0.06] transition-all duration-500 overflow-hidden`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center mb-6 group-hover:bg-[#CCFF00]/20 transition-colors">
                    <Icon className="w-6 h-6 text-[#CCFF00]" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    {card.title}
                  </h3>
                  <p className="text-white/50 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────
   HACKATHON GALLERY
   ───────────────────────────────────────────── */
interface HackathonEvent {
  id: number;
  title: string;
  image: string;
  category: string;
  date: string;
  prize: string;
  participants: string;
  gradient: string;
}

const hackathonEvents: HackathonEvent[] = [
  {
    id: 1,
    title: 'AI/ML Frontier',
    image:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=600&fit=crop',
    category: 'Artificial Intelligence',
    date: 'Mar 15-17, 2025',
    prize: '$50,000',
    participants: '2,400+',
    gradient: 'from-violet-600 to-purple-900',
  },
  {
    id: 2,
    title: 'Web3 Summit',
    image:
      'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=600&fit=crop',
    category: 'Blockchain',
    date: 'Apr 5-7, 2025',
    prize: '$75,000',
    participants: '1,800+',
    gradient: 'from-cyan-600 to-blue-900',
  },
  {
    id: 3,
    title: 'Green Tech Hack',
    image:
      'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800&h=600&fit=crop',
    category: 'Sustainability',
    date: 'May 20-22, 2025',
    prize: '$40,000',
    participants: '1,200+',
    gradient: 'from-emerald-600 to-green-900',
  },
  {
    id: 4,
    title: 'DevOps Challenge',
    image:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=600&fit=crop',
    category: 'Infrastructure',
    date: 'Jun 10-12, 2025',
    prize: '$35,000',
    participants: '900+',
    gradient: 'from-orange-600 to-red-900',
  },
  {
    id: 5,
    title: 'Mobile First',
    image:
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop',
    category: 'Mobile Development',
    date: 'Jul 8-10, 2025',
    prize: '$45,000',
    participants: '1,500+',
    gradient: 'from-pink-600 to-rose-900',
  },
  {
    id: 6,
    title: 'Cybersecurity CTF',
    image:
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=600&fit=crop',
    category: 'Security',
    date: 'Aug 15-17, 2025',
    prize: '$60,000',
    participants: '2,000+',
    gradient: 'from-red-600 to-rose-900',
  },
  {
    id: 7,
    title: 'Data Science Sprint',
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
    category: 'Data & Analytics',
    date: 'Sep 5-7, 2025',
    prize: '$55,000',
    participants: '1,700+',
    gradient: 'from-indigo-600 to-violet-900',
  },
  {
    id: 8,
    title: 'GameDev Jam',
    image:
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop',
    category: 'Game Development',
    date: 'Oct 20-22, 2025',
    prize: '$30,000',
    participants: '1,100+',
    gradient: 'from-amber-600 to-yellow-900',
  },
];

const HackathonGallery = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const navigate = useNavigate();

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    checkScroll();
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = direction === 'left' ? -400 : 400;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  return (
    <section className="py-32 bg-black relative" ref={containerRef}>
      <div className="max-w-[1450px] mx-auto px-6 md:px-12 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="flex items-end justify-between"
        >
          <div>
            <span className="text-[#CCFF00] text-sm font-bold tracking-widest uppercase">
              Upcoming Events
            </span>
            <h2 className="text-4xl md:text-6xl font-black text-white mt-4 tracking-tight">
              Join the
              <br />
              <span className="text-white/30">Next Wave.</span>
            </h2>
          </div>
          <div className="hidden md:flex gap-3">
            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Scrollable gallery */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide px-6 md:px-12 pb-4 cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: 'none' }}
      >
        {hackathonEvents.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, duration: 0.6 }}
            className="flex-shrink-0 w-[350px] md:w-[420px] group"
          >
            <div className="relative h-[500px] rounded-2xl overflow-hidden">
              {/* Image */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${event.gradient}`}
              />
              <img
                src={event.image}
                alt={event.title}
                className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60 group-hover:scale-110 transition-transform duration-700"
              />

              {/* Content overlay */}
              <div className="absolute inset-0 flex flex-col justify-between p-6">
                <div className="flex items-center justify-between">
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                    {event.category}
                  </span>
                  <motion.div
                    whileHover={{ scale: 1.2 }}
                    className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center cursor-pointer"
                  >
                    <ArrowUpRight className="w-5 h-5 text-white" />
                  </motion.div>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-white mb-2">
                    {event.title}
                  </h3>
                  <div className="flex items-center gap-4 text-white/70 text-sm">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {event.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" /> {event.participants}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#CCFF00]" />
                    <span className="text-[#CCFF00] font-bold">
                      {event.prize}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* CTA end card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="flex-shrink-0 w-[350px] md:w-[420px]"
        >
          <div className="h-[500px] rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-6 hover:border-[#CCFF00]/50 transition-colors">
            <div className="w-20 h-20 rounded-full bg-[#CCFF00]/10 flex items-center justify-center">
              <Rocket className="w-10 h-10 text-[#CCFF00]" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">
                Host Your Own
              </h3>
              <p className="text-white/50 max-w-[250px]">
                Create and manage your hackathon in minutes
              </p>
            </div>
            <motion.button
              className="bg-[#CCFF00] text-black font-bold px-6 py-3 rounded-full"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/login')}
            >
              Get Started
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Scroll progress bar */}
      <div className="max-w-[1450px] mx-auto px-6 md:px-12 mt-8">
        <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#CCFF00]"
            style={{ width: '30%' }}
          />
        </div>
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────
   SPLIT SECTION
   ───────────────────────────────────────────── */
const SplitSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      ref={ref}
      className="py-0 bg-black relative overflow-hidden"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-[600px]">
        {/* Left – dark */}
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="relative bg-black p-12 md:p-20 flex flex-col justify-center group overflow-hidden"
        >
          <div className="absolute inset-0 bg-[linear-gradient(rgba(204,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(204,255,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] group-hover:bg-[size:38px_38px] transition-all duration-700" />
          <div className="relative z-10">
            <span className="text-[#CCFF00] text-sm font-bold tracking-widest uppercase">
              For Teams
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white mt-4 tracking-tight leading-tight">
              On Track
            </h2>
            <p className="text-white/50 mt-6 max-w-md leading-relaxed">
              Manage your team, track progress, and ship on time. Real-time
              dashboards, automated check-ins, and smart notifications keep
              everyone aligned.
            </p>
            <div className="mt-8 flex items-center gap-6">
              <div className="flex -space-x-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`avatar-${String(i)}`}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-[#CCFF00] to-green-600 border-2 border-black"
                  />
                ))}
              </div>
              <span className="text-white/50 text-sm">
                12,000+ teams active
              </span>
            </div>
          </div>
        </motion.div>

        {/* Right – yellow */}
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative bg-[#CCFF00] p-12 md:p-20 flex flex-col justify-center group overflow-hidden"
        >
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:40px_40px] group-hover:bg-[size:38px_38px] transition-all duration-700" />
          <div className="relative z-10">
            <span className="text-black/60 text-sm font-bold tracking-widest uppercase">
              For Individuals
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-black mt-4 tracking-tight leading-tight">
              Off Track
            </h2>
            <p className="text-black/60 mt-6 max-w-md leading-relaxed">
              Solo builders welcome. Find teammates, get mentored, or go
              it alone. Our platform adapts to your style and helps you
              stand out.
            </p>
            <div className="mt-8">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-black" />
                <span className="text-black/70 text-sm font-medium">
                  4.9/5 builder satisfaction
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────
   PARTNERS SECTION
   ───────────────────────────────────────────── */
interface Partner {
  name: string;
  icon: LucideIcon;
}

const PartnersSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const partners: Partner[] = [
    { name: 'Vercel', icon: Layers },
    { name: 'GitHub', icon: Github },
    { name: 'Docker', icon: Box },
    { name: 'AWS', icon: Globe },
    { name: 'Stripe', icon: Zap },
    { name: 'Figma', icon: Code2 },
  ];

  return (
    <section ref={ref} className="py-32 bg-black relative">
      <div className="max-w-[1450px] mx-auto px-6 md:px-12">
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          className="text-center text-white/30 text-sm font-medium tracking-widest uppercase mb-16"
        >
          Trusted by industry leaders
        </motion.p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {partners.map((partner, i) => {
            const Icon = partner.icon;
            return (
              <motion.div
                key={partner.name}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center gap-3 py-6 px-4 rounded-xl hover:bg-white/[0.03] transition-colors group"
              >
                <Icon className="w-8 h-8 text-white/30 group-hover:text-[#CCFF00] transition-colors" />
                <span className="text-white/40 font-medium text-sm group-hover:text-white/70 transition-colors">
                  {partner.name}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────
   CTA SECTION
   ───────────────────────────────────────────── */
const CTASection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const navigate = useNavigate();

  return (
    <section ref={ref} className="py-32 bg-black relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-[#CCFF00]/10 rounded-full blur-[200px]" />
      </div>

      <div className="max-w-[1450px] mx-auto px-6 md:px-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h2 className="text-5xl md:text-7xl lg:text-[100px] font-black text-white tracking-tighter leading-[0.9] mb-8">
            ALWAYS
            <br />
            <span className="text-[#CCFF00]">BUILDING</span>
          </h2>
          <p className="text-white/50 text-lg md:text-xl max-w-xl mx-auto mb-12">
            Join the community that never stops creating. Your next breakthrough
            starts here.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              className="bg-[#CCFF00] text-black font-bold px-10 py-5 rounded-full text-lg flex items-center gap-2 hover:bg-white transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/login')}
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </motion.button>
            <motion.button
              className="border border-white/20 text-white font-medium px-10 py-5 rounded-full text-lg hover:bg-white/10 transition-all"
              whileHover={{ scale: 1.05 }}
            >
              Talk to Sales
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────
   FOOTER
   ───────────────────────────────────────────── */
const Footer = () => {
  const linkGroups = [
    {
      title: 'Product',
      links: ['Features', 'Pricing', 'Enterprise', 'Changelog'],
    },
    {
      title: 'Resources',
      links: ['Documentation', 'API Reference', 'Guides', 'Blog'],
    },
    {
      title: 'Company',
      links: ['About', 'Careers', 'Contact', 'Press'],
    },
    {
      title: 'Legal',
      links: ['Privacy', 'Terms', 'Security', 'Cookies'],
    },
  ];

  const socialLinks: { icon: LucideIcon; href: string }[] = [
    { icon: Github, href: '#' },
    { icon: Twitter, href: '#' },
    { icon: Linkedin, href: '#' },
    { icon: Instagram, href: '#' },
  ];

  return (
    <footer className="bg-black border-t border-white/[0.06] pt-20 pb-8">
      <div className="max-w-[1450px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-12 mb-16">
          {/* Brand */}
          <div className="col-span-2">
            <span className="text-2xl font-black tracking-tighter text-white">
              DEV<span className="text-[#CCFF00]">SAGE</span>
            </span>
            <p className="text-white/40 mt-4 max-w-xs leading-relaxed">
              The platform where developers compete, collaborate, and create the
              impossible.
            </p>
            <div className="flex items-center gap-4 mt-6">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <span
                    key={Icon.displayName ?? Icon.name}
                    className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-[#CCFF00]/20 transition-colors group cursor-pointer"
                  >
                    <Icon className="w-4 h-4 text-white/50 group-hover:text-[#CCFF00] transition-colors" />
                  </span>
                );
              })}
            </div>
          </div>

          {/* Link groups */}
          {linkGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-white font-bold text-sm mb-4">
                {group.title}
              </h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link}>
                    <span className="text-white/40 hover:text-white text-sm transition-colors cursor-pointer">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">
            © {new Date().getFullYear()} DevSage. All rights reserved.
          </p>
          <p className="text-white/20 text-sm">
            Built with ♥ for developers everywhere
          </p>
        </div>
      </div>
    </footer>
  );
};

/* ─────────────────────────────────────────────
   LANDING PAGE (Root export)
   ───────────────────────────────────────────── */
export function HomePage() {
  return (
    <div className="bg-black min-h-screen">
      <CustomCursor />
      <Navbar />
      <Hero />
      <MarqueeText>
        HACKATHONS — COLLABORATION — INNOVATION — COMMUNITY — BUILD THE FUTURE
      </MarqueeText>
      <BentoGrid />
      <HackathonGallery />
      <SplitSection />
      <PartnersSection />
      <CTASection />
      <Footer />
    </div>
  );
}
