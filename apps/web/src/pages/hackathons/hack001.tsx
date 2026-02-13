import React from 'react';

export default function Hack001Page({ hackathon }: { hackathon: any }) {
  const accent = hackathon?.primary_color ?? '#CCFF00';
  return (
    <div className="min-h-screen p-12" style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.8))` }}>
      <div className="max-w-5xl mx-auto rounded-2xl border border-white/6 p-10" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
        <h1 className="text-5xl font-black text-white" style={{ color: accent }}>{hackathon?.title ?? 'hack001'}</h1>
        <p className="mt-4 text-white/70">This is a custom landing page for <strong>{hackathon?.slug}</strong>. Use this file to create a unique theme and layout.</p>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className="rounded-lg border border-white/6 p-6">
            <h3 className="font-semibold text-white/90">Overview</h3>
            <p className="text-sm text-white/60 mt-2">{hackathon?.description}</p>
          </div>
          <div className="rounded-lg border border-white/6 p-6">
            <h3 className="font-semibold text-white/90">Quick Links</h3>
            <ul className="mt-2 text-sm text-white/60">
              <li>Schedule</li>
              <li>Rules</li>
              <li>Teams</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
