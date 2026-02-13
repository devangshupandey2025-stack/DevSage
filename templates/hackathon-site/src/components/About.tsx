import { config } from '@/config';

export default function About() {
  return (
    <section className="py-20 px-4 bg-black/20">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white">About This Hackathon</h2>
          <p className="text-lg text-white/70 leading-relaxed">
            {config.description}
          </p>
        </div>

        {config.rules && (
          <div className="space-y-6 pt-12 border-t border-white/10">
            <h3 className="text-2xl font-bold text-white">Rules & Guidelines</h3>
            <div className="prose prose-invert prose-lg max-w-none text-white/70">
              <p className="whitespace-pre-wrap leading-relaxed">
                {config.rules}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
