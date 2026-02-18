import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  useInView,
} from 'framer-motion';
import { CustomCursor } from '@/components/custom-cursor';
import TextType from '@/components/TextType';
import {
  Zap,
  GitBranch,
  Globe,
  Cpu,
  Star,
  Menu,
  X,
  Shield,
  Rocket,
  Trophy,
  Users,
  Clock,
  ArrowRight,
  ArrowUpRight,
  Play,
  Github,
  Twitter,
  Linkedin,
  Instagram,
  ExternalLink,
  Mail,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Local team photos (imported from src/photos)
import kevinImg from '@/photos/kevin.jpeg';
import harshImg from '@/photos/harsh.png';
import deeptanshuImg from '@/photos/deeptanshu.png';
import ibhanImg from '@/photos/ibhan.jpeg';
import devangshuImg from '@/photos/devangshu.png';
import srijanImg from '@/photos/srijan.png';
import logo from '@/photos/logo.jpeg';

/* ─────────────────────────────────────────────
   NAVBAR
   ───────────────────────────────────────────── */
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Navbar link targets for in-page navigation
  const navLinks = [
    { label: 'Platform', id: 'platform' },
    { label: 'Solutions', id: 'solutions' },
    { label: 'Developers', id: 'credits' },
    { label: 'Hackathons', id: 'developers' },
    { label: 'Pricing', id: 'pricing' },
  ];

  const handleNavClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // If section not on this page (edge case), navigate to home then scroll
    navigate('/');
    setTimeout(() => {
      const e = document.getElementById(id);
      e?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 220);
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-black/90 backdrop-blur-xl border-b border-white/6'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-360 mx-auto px-6 md:px-12 h-18 md:h-20 flex items-center justify-between">
          <motion.div
              className="relative z-10 cursor-pointer flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
>
  <img
    src={logo}
    alt="DevSage Logo"
    className="w-8 h-8 md:w-10 md:h-10 object-contain"
  />

  <span className="text-2xl md:text-3xl font-black tracking-tighter text-white">
    DEV<span className="text-[#CCFF00]">SAGE</span>
  </span>
</motion.div>


          <div className="hidden lg:flex items-center gap-10">
            {navLinks.map((link, i) => (
              <motion.button
                key={link.id}
                type="button"
                onClick={() => handleNavClick(link.id)}
                className="text-[13px] font-medium text-white/50 hover:text-white transition-all duration-300 relative group cursor-pointer tracking-wide uppercase bg-transparent border-none"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
              >
                {link.label}
                <span className="absolute -bottom-1.5 left-0 w-0 h-0.5 bg-[#CCFF00] group-hover:w-full transition-all duration-300" />
              </motion.button>
            ))}
          </div>
          <div className="hidden lg:flex items-center gap-3">
            <motion.button
              className="bg-[#CCFF00] text-black text-sm font-bold px-6 py-2.5 rounded-full hover:bg-white transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('https://mail.google.com/mail/?view=cm&fs=1&to=contact@devsage.org&su=Development%20Request', '_blank')}
            >
              Get in Touch
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
              {navLinks.map((link, i) => (
                  <motion.button
                    type="button"
                    key={link.id}
                    className="text-5xl md:text-7xl font-black text-black hover:text-white transition-colors bg-transparent border-none cursor-pointer"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i + 0.3 }}
                    onClick={() => { handleNavClick(link.id); setIsOpen(false); }}
                  >
                    {link.label}
                  </motion.button>
                ))}
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

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '40%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-end pb-20 md:pb-32 overflow-hidden bg-black"
    >
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1920&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-150"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/80 to-black/40" />
        <div className="absolute inset-0 bg-linear-to-r from-black/60 to-transparent" />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(204,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(204,255,0,0.02)_1px,transparent_1px)] bg-size-[80px_80px]" />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 max-w-360 mx-auto px-6 md:px-12 w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          {/* Left – main headline */}
          <div className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-6"
            >
              <span className="text-[#CCFF00] text-xs font-bold tracking-[0.25em] uppercase">
                The Future of Hackathons
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-6xl md:text-8xl lg:text-[140px] font-black tracking-tighter leading-[0.85]"
            >
              <span className="text-white block">BUILD</span>
              <span className="text-[#CCFF00] block drop-shadow-[0_0_60px_rgba(204,255,0,0.3)]">
                BEYOND
              </span>
              <span
                className="block text-transparent bg-clip-text"
                style={{
                  WebkitTextStroke: '2px rgba(255,255,255,0.25)',
                }}
              >
                LIMITS
              </span>
            </motion.h1>

            {/* Typing text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mt-8"
            >
              <TextType
                text={[
                  'Where developers compete, collaborate, and create the impossible.',
                  'Ship faster. Win bigger. Build together.',
                ]}
                typingSpeed={45}
                deletingSpeed={25}
                pauseDuration={2500}
                showCursor
                cursorCharacter="_"
                cursorBlinkDuration={0.5}
                className="text-lg md:text-xl text-white/40 max-w-xl h-8"
                loop
              />
            </motion.div>
          </div>

          {/* Right – CTA and stats */}
          <div className="lg:col-span-4 flex flex-col items-start lg:items-end gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="flex flex-col gap-4"
            >
              <motion.button
                className="group bg-[#CCFF00] text-black font-bold px-8 py-4 rounded-full text-lg flex items-center gap-3 hover:bg-white transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open('https://mail.google.com/mail/?view=cm&fs=1&to=contact@devsage.org&su=Development%20Request', '_blank')}
              >
                Host with us
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </motion.div>

            {/* Mini stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="flex gap-8"
            >
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Vertical scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 right-8 hidden md:flex flex-col items-center gap-3"
      >
        <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] [writing-mode:vertical-lr]">
          Scroll
        </span>
        <motion.div
          className="w-px h-16 bg-white/10 relative overflow-hidden"
        >
          <motion.div
            className="absolute top-0 left-0 w-full bg-[#CCFF00]"
            animate={{ height: ['0%', '100%', '0%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
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
    <div className="overflow-hidden py-5 bg-[#CCFF00] relative">
      <motion.div
        className="flex whitespace-nowrap items-center gap-12"
        animate={{ x: direction > 0 ? [0, -1920] : [-1920, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={`m${String(i)}`} className="flex items-center gap-12 text-black font-black text-xl md:text-3xl uppercase tracking-wide">
            {children}
            <Star className="w-5 h-5 text-black/30 fill-black/30 shrink-0" />
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
  colSpan: string;
  rowSpan?: string;
  image?: string;
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
      colSpan: 'md:col-span-2',
      rowSpan: 'md:row-span-2',
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop',
    },
    {
      title: 'AI-Powered Matching',
      description:
        'Our AI matches you with the perfect teammates based on skills, timezone, and experience.',
      icon: Cpu,
      gradient: 'from-purple-500/20 to-transparent',
      colSpan: 'md:col-span-1',
      rowSpan: 'md:row-span-2',
      image: 'https://blog.emb.global/wp-content/uploads/2024/02/30-Top-Digital-Collaboration-Tools-for-Your-Business-Productivity.webp',
    },
    {
      title: 'Global Network',
      description:
        'Connect with developers from 120+ countries. Build diverse teams that bring unique perspectives.',
      icon: Globe,
      gradient: 'from-blue-500/20 to-transparent',
      colSpan: 'md:col-span-1',
      rowSpan: 'md:row-span-2',
      image: 'https://thumbs.dreamstime.com/b/global-network-across-planet-earth-blockchain-global-network-across-planet-earth-blockchain-elements-image-136686433.jpg',
    },
    {
      title: 'Smart Submissions',
      description:
        'Git integration, automated testing, deployment previews. Submit with confidence every time.',
      icon: GitBranch,
      gradient: 'from-green-500/20 to-transparent',
      colSpan: 'md:col-span-1',
      rowSpan: 'md:row-span-2',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop',
    },
    {
      title: 'Enterprise Security',
      description:
        'SOC 2 compliant, end-to-end encryption, SSO support. Your code and data are always protected.',
      icon: Shield,
      gradient: 'from-red-500/20 to-transparent',
      colSpan: 'md:col-span-1',
      rowSpan: 'md:row-span-2',
      image: 'https://www.broadcom.com/media/blt4ac44e0e6c6d8341/blt2e71319c09c1c825/65389bbed2c0baf28e57f19e/enterprise-security-solutions..jpg',
    },
    {
      title: 'Instant Deployment',
      description:
        'One-click deploy to any cloud provider. Showcase your project to judges and the world instantly.',
      icon: Rocket,
      gradient: 'from-orange-500/20 to-transparent',
      colSpan: 'md:col-span-2',
      rowSpan: 'md:row-span-2',
      image: 'https://mobisoftinfotech.com/resources/wp-content/uploads/2022/01/mobile-app-development-process-step-6-deployment-and-launch.png',
    },
  ];

  return (
    <section id="platform" className="py-32 bg-black relative" ref={ref}>
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-size-[60px_60px]" />

      <div className="max-w-360 mx-auto px-6 md:px-12 relative z-10">
        {/* Section header — split layout */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-20"
        >
          <div>
            <span className="text-[#CCFF00] text-xs font-bold tracking-[0.2em] uppercase">
              Features
            </span>
            <h2 className="text-4xl md:text-6xl font-black text-white mt-4 tracking-tight leading-[0.95]">
              Everything You Need
              <br />
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: '1.5px rgba(255,255,255,0.2)' }}
              >
                To Win.
              </span>
            </h2>
          </div>
          <p className="text-white/35 max-w-sm text-[15px] leading-relaxed md:text-right">
            Built for teams that ship fast. Every tool, workflow, and integration you need — in one place.
          </p>
        </motion.div>

        {/* 4-column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[220px]">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.6 }}
                className={`${card.colSpan} ${card.rowSpan ?? ''} group relative bg-white/2 border border-white/6 rounded-2xl overflow-hidden hover:border-white/12 transition-all duration-500`}
              >
                {/* Optional background image */}
                {card.image && (
                  <div className="absolute inset-0">
                    <img
                      src={card.image}
                      alt=""
                      className="w-full h-full object-cover opacity-15 group-hover:opacity-25 group-hover:scale-105 transition-all duration-700"
                    />
                  </div>
                )}
                {/* Hover gradient */}
                <div
                  className={`absolute inset-0 bg-linear-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                <div className="relative z-10 p-7 h-full flex flex-col justify-between">
                  <div>
                    <div className="w-11 h-11 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center mb-5 group-hover:bg-[#CCFF00]/20 transition-all duration-300">
                      <Icon className="w-5 h-5 text-[#CCFF00]" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      {card.title}
                    </h3>
                    <p className="text-white/40 leading-relaxed text-sm">
                      {card.description}
                    </p>
                  </div>
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
  accent: string;
}

const hackathonEvents: HackathonEvent[] = [
  {
    id: 1,
    title: 'DevHouse 2026',
    image: 'data:image/png;base64,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',
    category: 'Open Innovation',
    date: 'Mar 27-29, 2026',
    prize: '$1,300',
    participants: '400+',
    gradient: 'from-violet-600 to-purple-900',
    accent: '#8B5CF6',
  },
  {
    id: 2,
    title: 'HackKnight 2026',
    image: 'data:image/png;base64,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',
    category: 'Open Innovation',
    date: 'Mar 31 - Apr 1,  2026',
    prize: '$1,300',
    participants: '400+',
    gradient: 'from-green-600 to-green-900',
    accent: '#22C55E',
  }
];

const HackathonGallery = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  /* Drag-to-scroll state */
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX;
    scrollStart.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = 'grabbing';
    scrollRef.current.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = e.pageX - startX.current;
    scrollRef.current.scrollLeft = scrollStart.current - dx;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = 'grab';
      scrollRef.current.style.userSelect = '';
    }
  }, []);

  useEffect(() => {
    const handler = () => { isDragging.current = false; };
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, []);

  return (
    <section id="developers" className="py-32 bg-black relative" ref={containerRef}>
      <div className="max-w-360 mx-auto px-6 md:px-12 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="flex items-end justify-between"
        >
          <div>
            <span className="text-[#CCFF00] text-xs font-bold tracking-[0.2em] uppercase">
              Upcoming Events
            </span>
            <h2 className="text-4xl md:text-6xl font-black text-white mt-4 tracking-tight leading-[0.95]">
              Join the
              <br />
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: '1.5px rgba(255,255,255,0.2)' }}
              >
                Next Wave.
              </span>
            </h2>
          </div>
          <motion.span
            className="hidden md:flex items-center gap-2 text-[#CCFF00] text-sm font-semibold uppercase tracking-wider cursor-pointer hover:gap-3 transition-all"
            whileHover={{ x: 4 }}
          >
            <a href="https://eventhubcc.vit.ac.in/EventHub/" target="_blank" className="text-[#CCFF00] hover:text-white transition-colors">
              View all
            </a>
            <ArrowRight className="w-4 h-4 text-[#CCFF00]" />
          </motion.span>
        </motion.div>
      </div>

      {/* Drag-scrollable gallery */}
      <div
        ref={scrollRef}
        className={`
          flex gap-5 overflow-x-auto px-6 md:px-12 pb-6 cursor-grab active:cursor-grabbing select-none
          scroll-smooth snap-x snap-mandatory touch-pan-x
          [&::-webkit-scrollbar]:h-2
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-track]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-[#CCFF00]
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:hover:bg-[#CCFF00]/80
        `}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#CCFF00 transparent',
          WebkitOverflowScrolling: 'touch',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {hackathonEvents.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.08, duration: 0.6 }}
            className="shrink-0 w-[320px] md:w-95 group snap-center"
          >
            <div className="relative h-115 rounded-2xl overflow-hidden bg-white/2 border border-white/6 hover:border-white/12 transition-all duration-500">
              {/* Colored top accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1 z-20"
                style={{ backgroundColor: event.accent }}
              />

              {/* Image */}
              <div className="relative h-50 overflow-hidden">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover opacity-100 group-hover:scale-110 transition-transform duration-700"
                  draggable={false}
                />
                {/* Year badge */}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                  {event.date.split(',')[1]?.trim() ?? '2025'}
                </div>
                {/* Number badge */}
                <div
                  className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white"
                  style={{ backgroundColor: event.accent + '80' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col justify-between h-65">
                <div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full"
                    style={{
                      color: event.accent,
                      backgroundColor: event.accent + '15',
                    }}
                  >
                    {event.category}
                  </span>
                  <h3 className="text-xl font-black text-white mt-3 mb-2">
                    {event.title}
                  </h3>
                  <div className="flex items-center gap-4 text-white/40 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {event.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {event.participants}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#CCFF00]" />
                    <span className="text-[#CCFF00] font-bold text-sm">{event.prize}</span>
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.15 }}
                    className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4 text-white/50" 
                    onClick={() => window.open("https://eventhubcc.vit.ac.in/EventHub/", "_blank")}
                    />
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

      </div>

      {/* Custom gallery scrollbar */}
      <div className="max-w-360 mx-auto px-6 md:px-12 mt-4">
        <div className="h-px bg-white/6" />
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────
   PARTNERS SECTION
   ───────────────────────────────────────────── */
const partners = [
  'Vercel', 'GitHub', 'Docker', 'AWS', 'Stripe', 'Figma',
  'Cloudflare', 'MongoDB', 'Supabase', 'Linear',
];

const PartnersSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="hackathons" ref={ref} className="py-20 bg-black border-y border-white/4">
      <div className="max-w-360 mx-auto px-6 md:px-12">
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center text-xs font-medium uppercase tracking-[0.3em] text-white/25 mb-12"
        >
          Trusted by teams at
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {partners.map((name, i) => (
            <motion.span
              key={name}
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="text-white/20 hover:text-white/50 text-lg md:text-xl font-bold tracking-tight transition-colors duration-300 cursor-default"
            >
              {name}
            </motion.span>
          ))}
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
    <section id="solutions" ref={ref} className="bg-black relative overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-175">
        {/* Left — dark with background image */}
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="relative bg-black p-12 md:p-20 flex flex-col justify-center group overflow-hidden"
        >
          {/* Background image */}
          <div className="absolute inset-0 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=70"
              alt=""
              className="w-full h-full object-cover opacity-10 group-hover:opacity-15 group-hover:scale-110 transition-all duration-1000"
            />
            <div className="absolute inset-0 bg-linear-to-r from-black via-black/90 to-black/70" />
          </div>
          <div className="relative z-10">
            <span className="text-[#CCFF00] text-xs font-bold tracking-[0.2em] uppercase">
              For Teams
            </span>
            <h2 className="text-4xl md:text-6xl font-black text-white mt-4 tracking-tight leading-[0.9]">
              On Track
            </h2>
            <p className="text-white/40 mt-6 max-w-md leading-relaxed text-[15px]">
              Manage your team, track progress, and ship on time. Real-time
              dashboards, automated check-ins, and smart notifications keep
              everyone aligned.
            </p>
            <div className="mt-8 flex items-center gap-6">
              <div className="flex -space-x-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`avatar-${String(i)}`}
                    className="w-10 h-10 rounded-full bg-linear-to-br from-[#CCFF00] to-green-600 border-2 border-black"
                  />
                ))}
              </div>
              <span className="text-white/35 text-sm">12,000+ teams active</span>
            </div>
          </div>
        </motion.div>

        {/* Right — yellow with background image */}
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative bg-[#CCFF00] p-12 md:p-20 flex flex-col justify-center group overflow-hidden"
        >
          {/* Background image */}
          <div className="absolute inset-0 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1531498860502-7c67cf02f657?w=800&q=70"
              alt=""
              className="w-full h-full object-cover opacity-10 group-hover:opacity-15 group-hover:scale-110 transition-all duration-1000 mix-blend-multiply"
            />
          </div>
          <div className="relative z-10">
            <span className="text-black/40 text-xs font-bold tracking-[0.2em] uppercase">
              For Individuals
            </span>
            <h2 className="text-4xl md:text-6xl font-black text-black mt-4 tracking-tight leading-[0.9]">
              Off Track
            </h2>
            <p className="text-black/45 mt-6 max-w-md leading-relaxed text-[15px]">
              Solo builders welcome. Find teammates, get mentored, or go
              it alone. Our platform adapts to your style and helps you
              stand out.
            </p>
            <div className="mt-8">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-black fill-black" />
                <span className="text-black/60 text-sm font-medium">
                  4.9/5 builder satisfaction
                </span>
              </div>
            </div>
            <motion.span
              className="inline-flex items-center gap-2 mt-8 text-black text-sm font-semibold cursor-pointer"
              whileHover={{ x: 4 }}
              onClick={() => window.open('https://mail.google.com/mail/?view=cm&fs=1&to=contact@devsage.org&su=Development%20Request', '_blank')}
            >
            </motion.span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────
   TEAM / CREDITS SECTION
   ───────────────────────────────────────────── */
const teamMembers = [
  { name: 'L Kevin Daniel', role: 'Full Stack & Infrastructure', linkedin: 'https://www.linkedin.com/in/l-kevin-daniel-3a2979392/', image: kevinImg, accent: '#E5A030' },
  { name: 'Srijan Guchhait', role: 'System Architecture & Backend', linkedin: 'https://www.linkedin.com/in/srijan-guchhait/', image: srijanImg, accent: '#9CA3AF' },
  { name: 'Devangshu Pandey', role: 'Frontend', linkedin: 'https://www.linkedin.com/in/devangshu-pandey-606611372/', image: devangshuImg, accent: '#A0887A' },
  { name: 'Ibhan Mukherjee', role: 'AI/ML', linkedin: 'https://www.linkedin.com/in/ibhan-mukherjee/', image: ibhanImg, accent: '#2D3A6E' },
  { name: 'Deeptanshu Samanta', role: 'UI/UX', linkedin: 'https://www.linkedin.com/in/deeptanshu-samanta-3750b6312/', image: deeptanshuImg, accent: '#8B9BAA' },
  { name: 'Harsh', role: 'Security & DevOps', linkedin: 'https://www.linkedin.com/in/harsh-zz/', image: harshImg, accent: '#4B5563' },
];

const TeamSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      id="credits"
      ref={ref}
      className="py-24 md:py-32 relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #000000 0%, #080c24 30%, #0c1445 60%, #0a0f2e 85%, #000000 100%)',
      }}
    >
      <div className="max-w-360 mx-auto px-6 md:px-12 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-14 md:mb-20"
        >
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-blue-400/50 mb-4">
            The People Behind DevSage
          </p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white leading-[0.9]">
            Meet the{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-indigo-400">
              Builders
            </span>
          </h2>
        </motion.div>

        {/* Circular portrait row */}
        <div className="flex items-center justify-center gap-6 md:gap-10 flex-wrap">
          {teamMembers.map((member, i) => {
            const initials = member.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2);

            return (
              <motion.a
                key={member.name}
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ delay: 0.08 * i, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="group flex flex-col items-center gap-3 cursor-pointer"
              >
                {/* Circular avatar with LinkedIn badge */}
                <div className="relative">
                  <div
                    className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-white/30 transition-all duration-500 group-hover:scale-105"
                    style={{
                      boxShadow: `0 8px 30px ${member.accent}25`,
                    }}
                  >
                    {member.image ? (
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-3xl md:text-4xl font-black"
                        style={{
                          background: `linear-gradient(135deg, ${member.accent}40 0%, ${member.accent}15 100%)`,
                          color: `${member.accent}CC`,
                        }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>
                  {/* LinkedIn badge */}
                  <div className="absolute -top-1 -right-1 md:top-0 md:right-0 z-10 w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#0A66C2] flex items-center justify-center shadow-lg shadow-[#0A66C2]/30 group-hover:scale-110 transition-transform duration-300">
                    <Linkedin className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" fill="white" strokeWidth={0} />
                  </div>
                </div>

                {/* Name label */}
                <span className="text-sm md:text-base font-semibold text-white/60 group-hover:text-white transition-colors duration-300 text-center leading-tight">
                  {member.name}
                </span>
              </motion.a>
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
    <section id="pricing" ref={ref} className="py-40 bg-black relative overflow-hidden">
      {/* Large blurred glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-200 h-200 bg-[#CCFF00]/6 rounded-full blur-[250px]" />
      </div>

      <div className="max-w-360 mx-auto px-6 md:px-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9 }}
          className="text-center"
        >
          <h2 className="text-6xl md:text-8xl lg:text-[130px] font-black text-white tracking-tighter leading-[0.85] mb-6">
            ALWAYS
            <br />
            <span
              className="text-transparent"
              style={{ WebkitTextStroke: '3px #CCFF00' }}
            >
              BUILDING
            </span>
          </h2>
          <p className="text-white/35 text-lg md:text-xl max-w-xl mx-auto mb-14 leading-relaxed">
            Join the community that never stops creating. Your next breakthrough
            starts here.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              className="bg-[#CCFF00] text-black font-bold px-12 py-5 rounded-full text-lg flex items-center gap-3 hover:bg-white transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('https://mail.google.com/mail/?view=cm&fs=1&to=contact@devsage.org&su=Development%20Request', '_blank')}
            >
              Get Started For Free
              <ArrowRight className="w-5 h-5" />
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
  const socialLinks: { icon: LucideIcon; href: string; isEmail?: boolean }[] = [
    { icon: Mail, href: 'https://mail.google.com/mail/?view=cm&fs=1&to=admin@devsage.org&su=Project%20Inquiry' },
    { icon: Twitter, href: '#' },
    { icon: Linkedin, href: 'https://www.linkedin.com/in/devsage/' },
    { icon: Instagram, href: 'https://www.instagram.com/devsage26/' },
  ];
  return (
    <footer className="bg-black border-t border-white/6">
      <div className="max-w-360 mx-auto px-6 md:px-12">
        {/* Main footer content */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 py-20">
          {/* Brand */}
          <div className="col-span-2">
            <span className="text-2xl font-black tracking-tighter text-white">
              DEV<span className="text-[#CCFF00]">SAGE</span>
            </span>
            <p className="text-white/30 mt-4 max-w-xs leading-relaxed text-sm">
              The platform where developers compete, collaborate, and create the
              impossible.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={Icon.displayName ?? Icon.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white/4 flex items-center justify-center hover:bg-[#CCFF00]/15 transition-all duration-300 group cursor-pointer border border-white/6 hover:border-[#CCFF00]/30"
                  >
                    <Icon className="w-4 h-4 text-white/35 group-hover:text-[#CCFF00] transition-colors" />
                  </a>
                );
              })}
            </div>
          </div>
          
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/20 text-xs">
            &copy; {new Date().getFullYear()}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {teamMembers.map((member) => (
              <a
                key={member.name}
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/25 hover:text-[#CCFF00] transition-colors duration-200 cursor-pointer"
              >
                {member.name}
              </a>
            ))}
          </div>
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
      <MarqueeText>HACKATHONS — COLLABORATION — INNOVATION — COMMUNITY — BUILD THE FUTURE</MarqueeText>
      <BentoGrid />
      <HackathonGallery />
      <PartnersSection />
      <SplitSection />
      <TeamSection />
      <CTASection />
      <Footer />
    </div>
  );
}
export default HomePage;
