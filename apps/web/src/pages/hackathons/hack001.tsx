import React from 'react';
import { Link } from 'react-router-dom';

export default function Hack001Page({ hackathon }: { hackathon: any }) {
    // ...existing code...
    const accent = hackathon?.primary_color ?? '#2DD4BF'; // glass-blue accent fallback
    // Back to Dashboard button
    const backButton = (
      <div className="mb-6">
        <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold" style={{ background: accent, color: '#000' }}>
          ← Back to Dashboard
        </Link>
      </div>
    );
  const bgGradient = 'linear-gradient(135deg, rgba(6,78,59,0.45), rgba(2,6,23,0.6))';

  return (
    <div className="min-h-screen p-8" style={{ background: bgGradient }}>
      <div className="max-w-4xl mx-auto rounded-3xl border border-white/10 p-8" style={{ backdropFilter: 'blur(8px)', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
        {backButton}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight" style={{ color: accent }}>{hackathon?.title ?? 'Hackathon'}</h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl">{hackathon?.description ?? 'Join us for a weekend of building, learning and prizes.'}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${accent}22`, color: accent }}>{hackathon?.status.replace('_', ' ')}</span>
              <span className="text-xs text-white/60">Max team size: <strong className="text-white/90">{hackathon?.max_team_size ?? 'N/A'}</strong></span>
            </div>
          </div>

          <div className="shrink-0">
            {hackathon?.logo_r2_key ? (
              <img src={`/r2/${hackathon.logo_r2_key}`} alt="logo" className="h-24 w-24 rounded-lg object-cover border border-white/6" />
            ) : (
              <div className="h-24 w-24 rounded-lg bg-white/6 flex items-center justify-center text-2xl font-bold text-white/80">S</div>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2 rounded-xl p-4" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.04)' }}>
            <h3 className="text-sm text-white/60">Important dates</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              <li><strong>Registration:</strong> {hackathon?.registration_start_date ? new Date(hackathon.registration_start_date).toLocaleString() : 'TBA'}</li>
              <li><strong>Hacking starts:</strong> {hackathon?.hacking_start_date ? new Date(hackathon.hacking_start_date).toLocaleString() : 'TBA'}</li>
              <li><strong>Submission deadline:</strong> {hackathon?.submission_deadline ? new Date(hackathon.submission_deadline).toLocaleString() : 'TBA'}</li>
            </ul>
          </div>

          <div className="rounded-xl p-4 flex flex-col justify-between" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <h3 className="text-sm text-white/60">Prizes</h3>
              <p className="mt-2 text-white/70">$10,000 — multiple categories</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-white/60">
          <h4 className="text-xs text-white/50 font-medium">About this hackathon</h4>
          <p className="mt-2">{hackathon?.description ?? 'No description provided.'}</p>
        </div>
      </div>
    </div>
  );
}
