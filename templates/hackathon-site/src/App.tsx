import { useEffect, useState } from 'react';
import { config } from '@/config';
import Hero from './components/Hero';
import Dates from './components/Dates';
import Prizes from './components/Prizes';
import Teams from './components/Teams';
import About from './components/About';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';

interface AuthUser {
  id: string;
  github_username: string;
  display_name: string;
  avatar_url: string | null;
}

function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${config.apiOrigin}/auth/me`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.ok && json.data?.user) setUser(json.data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  return { user, loading };
}

export default function App() {
  const { user, loading } = useAuth();
  const isDashboard = window.location.pathname.startsWith('/dashboard');

  if (isDashboard) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-white">
        <Dashboard user={user} loading={loading} />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white">
      <Hero />
      <Dates />
      <Prizes />
      <Teams />
      <About />
      <Footer />
    </div>
  );
}
