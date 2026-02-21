import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AboutPage } from '@/pages/about';
import { NotFoundPage } from '@/pages/not-found';
import { Preloader } from '@/components/preloader';

// Lazy-load route pages to reduce initial bundle size (code-splitting)
const HomePage = lazy(() => import('@/pages/home').then(m => ({ default: m.HomePage })));
const BrowseHackathonsPage = lazy(() => import('@/pages/browse-hackathons').then(m => ({ default: m.BrowseHackathonsPage })));
const PrivacyPolicyPage = lazy(() => import('@/pages/privacy-policy').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import('@/pages/terms-of-service').then(m => ({ default: m.TermsOfServicePage })));
const FAQPage = lazy(() => import('@/pages/faq').then(m => ({ default: m.FAQPage })));
const AboutUsPage = lazy(() => import('@/pages/about-us').then(m => ({ default: m.AboutUsPage })));

const LazyWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="min-h-50" />}>{children}</Suspense>
);

const router = createBrowserRouter([
  { path: '/', element: <LazyWrapper><HomePage /></LazyWrapper> },
  { path: '/about', element: <AboutPage /> },
  { path: '/hackathons', element: <LazyWrapper><BrowseHackathonsPage /></LazyWrapper> },
  { path: '/privacy', element: <LazyWrapper><PrivacyPolicyPage /></LazyWrapper> },
  { path: '/terms', element: <LazyWrapper><TermsOfServicePage /></LazyWrapper> },
  { path: '/faq', element: <LazyWrapper><FAQPage /></LazyWrapper> },
  { path: '/about-us', element: <LazyWrapper><AboutUsPage /></LazyWrapper> },

  { path: '*', element: <NotFoundPage /> },
]);

export default function App() {
  return (
    <>
      <Preloader />
      <RouterProvider router={router} />
    </>
  );
}
