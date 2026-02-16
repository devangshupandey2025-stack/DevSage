import { config } from '@/config';

export default function Footer() {
  return (
    <footer className="py-12 px-4 border-t border-white/5 bg-black/40 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-sm text-white/40">
          Powered by{' '}
          <a 
            href="https://devsage.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors"
          >
            DevSage
          </a>
        </div>

        <div className="flex items-center gap-6">
          <a 
            href="https://devsage.org/login"
            className="text-sm font-medium transition-colors hover:text-white"
            style={{ color: config.accentColor }}
          >
            Register Now &rarr;
          </a>
        </div>
      </div>
    </footer>
  );
}
