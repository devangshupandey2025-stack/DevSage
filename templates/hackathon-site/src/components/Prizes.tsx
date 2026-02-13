import { config } from '@/config';

export default function Prizes() {
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      <div 
        className="absolute inset-0 opacity-5"
        style={{ background: config.accentColor }}
      />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div 
          className="rounded-3xl p-12 text-center border backdrop-blur-xl"
          style={{ 
            background: `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)`,
            borderColor: `${config.accentColor}33`
          }}
        >
          <h2 className="text-2xl font-medium text-white/80 mb-4">Total Prize Pool</h2>
          
          <div 
            className="text-6xl md:text-8xl font-bold mb-6 tracking-tight"
            style={{ 
              color: config.accentColor,
              textShadow: `0 0 40px ${config.accentColor}44`
            }}
          >
            {config.prizePool}
          </div>
          
          <p className="text-xl text-white/60">
            Multiple categories & sponsor rewards
          </p>
        </div>
      </div>
    </section>
  );
}
