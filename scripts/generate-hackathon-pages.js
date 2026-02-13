/*
  Simple generator: fetches /api/v1/hackathons and creates a starter TSX file
  at `apps/web/src/pages/hackathons/<slug>.tsx` for any hackathon that doesn't
  already have a file. Run `pnpm run generate:hackathons` from repo root.
*/
const fs = require('fs');
const path = require('path');


const API_ORIGIN = process.env.VITE_API_ORIGIN || 'http://localhost:8787';
const OUT_DIR = path.join(__dirname, '..', 'apps', 'web', 'src', 'pages', 'hackathons');

async function main() {
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/hackathons`);
    if (!res.ok) throw new Error(`api returned ${res.status}`);
    const json = await res.json();
    const list = json.data || [];

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const h of list) {
      const slug = h.slug;
      const filePath = path.join(OUT_DIR, `${slug}.tsx`);
      if (fs.existsSync(filePath)) {
        console.log(`skip (exists): ${slug}`);
        continue;
      }

      const content = `import React from 'react';

export default function ${slug.replace(/[^a-zA-Z0-9]/g,'_')}Page({ hackathon }: { hackathon: any }) {
  const accent = hackathon?.primary_color ?? '#CCFF00';
  return (
    <div className="min-h-screen p-12">
      <div className="max-w-5xl mx-auto rounded-2xl border border-white/6 p-10" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
        <h1 className="text-5xl font-black" style={{ color: accent }}>{h.title}</h1>
        <p className="mt-4 text-white/70">${(h.description || '').replace(/\n/g,' ').replace(/`/g,'\`')}</p>
        <div className="mt-8 text-sm text-white/60">Use this file to create a custom page for the hackathon.</div>
      </div>
    </div>
  );
}
`;
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`created: ${filePath}`);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
