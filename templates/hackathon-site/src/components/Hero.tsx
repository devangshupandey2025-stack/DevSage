import { config } from '@/config';

function loginUrl(provider: 'github' | 'google'): string {
  const origin = encodeURIComponent(window.location.origin);
  return `${config.apiOrigin}/auth/${provider}?origin=${origin}`;
}

export default function Hero() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden px-4 py-20">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-30 animate-pulse"
          style={{ background: config.accentColor }}
        />
        <div 
          className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse"
          style={{ background: config.accentColor, animationDelay: '1s' }}
        />
      </div>

      <div 
        className="relative w-full max-w-4xl backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/10 shadow-2xl"
        style={{ 
          background: 'rgba(255, 255, 255, 0.03)',
          borderColor: `${config.accentColor}33`
        }}
      >
        <div className="flex flex-col items-center text-center space-y-8">
          <div 
            className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-bold shadow-lg mb-4"
            style={{ 
              background: `linear-gradient(135deg, ${config.accentColor}22, ${config.accentColor}44)`,
              border: `1px solid ${config.accentColor}44`,
              color: config.accentColor
            }}
          >
            {config.logoUrl ? (
              <img src={config.logoUrl} alt={config.title} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              config.title.charAt(0)
            )}
          </div>

          <div 
            className="px-4 py-1.5 rounded-full text-sm font-medium border"
            style={{ 
              background: `${config.accentColor}11`,
              borderColor: `${config.accentColor}33`,
              color: config.accentColor
            }}
          >
            Registration Open
          </div>

          <h1 
            className="text-5xl md:text-7xl font-bold tracking-tight"
            style={{ 
              background: `linear-gradient(to right, white, ${config.accentColor})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            {config.title}
          </h1>

          <p className="text-xl text-white/70 max-w-2xl leading-relaxed">
            {config.description}
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-sm text-white/50">
            <span className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
              Max Team Size: {config.maxTeamSize}
            </span>
            <span className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
              Prize Pool: {config.prizePool}
            </span>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            <a
              href={loginUrl('github')}
              className="px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-lg active:scale-95 flex items-center gap-3"
              style={{ 
                background: config.accentColor,
                color: '#0b1120',
                boxShadow: `0 0 20px ${config.accentColor}44`
              }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
              Register with GitHub
            </a>
            <a
              href={loginUrl('google')}
              className="px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-lg active:scale-95 border border-white/20 text-white/90 hover:bg-white/5"
            >
              Register with Google
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
