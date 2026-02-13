import React from 'react';
import { Link } from 'react-router-dom';

export default function Hack001Page({ hackathon }: { hackathon: any }) {
  const accent = hackathon?.primary_color ?? '#2DD4BF';

  const formatDate = (date: string | undefined) =>
    date ? new Date(date).toLocaleString() : 'TBA';

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0b1120] text-white">
      
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-linear-to-br from-[#0f172a] via-[#0b1120] to-[#020617]" />
      <div
        className="absolute -top-40 -right-40 w-150 h-150 rounded-full blur-3xl opacity-20"
        style={{ background: accent }}
      />
      <div
        className="absolute -bottom-40 -left-40 w-150 h-150 rounded-full blur-3xl opacity-20"
        style={{ background: accent }}
      />

      <div className="relative max-w-5xl mx-auto px-6 py-12">

        {/* Back Button */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 mb-10 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105"
          style={{
            background: `${accent}22`,
            color: accent,
            border: `1px solid ${accent}55`,
          }}
        >
          ← Back to Dashboard
        </Link>

        {/* Main Glass Card */}
        <div
          className="rounded-3xl p-10 backdrop-blur-xl border shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderColor: `${accent}33`,
          }}
        >
          <div className="flex flex-col md:flex-row justify-between gap-8">

            {/* Left Section */}
            <div>
              <h1
                className="text-5xl font-extrabold tracking-tight"
                style={{
                  background: `linear-gradient(90deg, white, ${accent})`,
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {hackathon?.title ?? 'Hackathon'}
              </h1>

              <p className="mt-4 text-white/70 max-w-xl leading-relaxed">
                {hackathon?.description ??
                  'Join us for a weekend of building, innovation and massive prizes.'}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <span
                  className="px-4 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: `${accent}22`,
                    color: accent,
                    border: `1px solid ${accent}44`,
                  }}
                >
                  {hackathon?.status?.replace('_', ' ') ?? 'Open'}
                </span>

                <span className="text-sm text-white/60">
                  Max team size:{' '}
                  <strong className="text-white">
                    {hackathon?.max_team_size ?? 'N/A'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Logo Section */}
            <div>
              {hackathon?.logo_r2_key ? (
                <img
                  src={`/r2/${hackathon.logo_r2_key}`}
                  alt="logo"
                  className="w-28 h-28 rounded-2xl object-cover border"
                  style={{ borderColor: `${accent}55` }}
                />
              ) : (
                <div
                  className="w-28 h-28 rounded-2xl flex items-center justify-center text-3xl font-bold"
                  style={{
                    background: `${accent}22`,
                    border: `1px solid ${accent}55`,
                    color: accent,
                  }}
                >
                  H
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-10 h-px bg-white/10" />

          {/* Info Grid */}
          <div className="grid md:grid-cols-3 gap-6">

            {/* Dates Card */}
            <div className="col-span-2 rounded-2xl p-6 bg-white/5 border border-white/10">
              <h3 className="text-sm text-white/50 uppercase tracking-wider">
                Important Dates
              </h3>

              <ul className="mt-4 space-y-3 text-sm text-white/80">
                <li>
                  <strong>Registration:</strong>{' '}
                  {formatDate(hackathon?.registration_start_date)}
                </li>
                <li>
                  <strong>Hacking Starts:</strong>{' '}
                  {formatDate(hackathon?.hacking_start_date)}
                </li>
                <li>
                  <strong>Submission Deadline:</strong>{' '}
                  {formatDate(hackathon?.submission_deadline)}
                </li>
              </ul>
            </div>

            {/* Prize Card */}
            <div
              className="rounded-2xl p-6 border flex flex-col justify-between"
              style={{
                background: `${accent}10`,
                borderColor: `${accent}33`,
              }}
            >
              <h3 className="text-sm text-white/50 uppercase tracking-wider">
                Prizes
              </h3>

              <div className="mt-6">
                <p
                  className="text-3xl font-bold"
                  style={{ color: accent }}
                >
                  $10,000
                </p>
                <p className="text-white/60 text-sm mt-2">
                  Multiple categories & sponsor rewards
                </p>
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="mt-12">
            <h4 className="text-xs uppercase tracking-wider text-white/40">
              About This Hackathon
            </h4>
            <p className="mt-4 text-white/70 leading-relaxed">
              {hackathon?.description ?? 'No description provided.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
