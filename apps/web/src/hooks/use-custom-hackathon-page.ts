import { useEffect, useState } from 'react';

const pages = import.meta.glob('/src/pages/hackathons/*.tsx');

interface CustomPageProps {
  hackathon: unknown;
}

export function useCustomHackathonPage(slug: string | undefined) {
  const [CustomPage, setCustomPage] = useState<React.ComponentType<CustomPageProps> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) {
      setCustomPage(null);
      return;
    }

    const key = `/src/pages/hackathons/${slug}.tsx`;

    if (!pages[key]) {
      setCustomPage(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    pages[key]()
      .then((mod) => {
        if (cancelled) return;
        const m = mod as Record<string, unknown>;
        const comp =
          m && typeof m === 'object' && 'default' in m && typeof m.default === 'function'
            ? (m.default as React.ComponentType<CustomPageProps>)
            : null;
        setCustomPage(() => comp);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load custom hackathon page:', err);
        setCustomPage(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { CustomPage, loading };
}
