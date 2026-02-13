import { config } from '@/config';

export default function Hero() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden px-4 py-20">
      {/* Background Elements */}
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

      {/* Main Card */}
      <div 
        className="relative w-full max-w-4xl backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/10 shadow-2xl"
        style={{ 
          background: 'rgba(255, 255, 255, 0.03)',
          borderColor: `${config.accentColor}33`
        }}
      >
        <div className="flex flex-col items-center text-center space-y-8">
          {/* Logo */}
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

          {/* Status Badge */}
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

          {/* Title */}
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

          {/* Description */}
          <p className="text-xl text-white/70 max-w-2xl leading-relaxed">
            {config.description}
          </p>

          {/* Meta Info */}
          <div className="flex flex-wrap justify-center gap-4 text-sm text-white/50">
            <span className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
              👥 Max Team Size: {config.maxTeamSize}
            </span>
            <span className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
              🏆 Prize Pool: {config.prizePool}
            </span>
          </div>

          {/* CTA Button */}
          <a
            href={`https://devsage.org/hackathons/${config.slug}`}
            className="mt-8 px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-lg active:scale-95"
            style={{ 
              background: config.accentColor,
              color: '#0b1120',
              boxShadow: `0 0 20px ${config.accentColor}44`
            }}
          >
            Register Now
          </a>
        </div>
      </div>
    </section>
  );
}
