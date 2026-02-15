import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(async () => {
  const plugins: any[] = [
    react(),
    tailwindcss(),
  ];

  // Add bundle visualizer when ANALYZE env var is set (run locally with
  // `set ANALYZE=true && pnpm --filter @devsage/web run build` on Windows)
  if (process.env.ANALYZE) {
    try {
      const { visualizer } = await import('rollup-plugin-visualizer');
      plugins.push(visualizer({ filename: 'dist/bundle-analysis.html', open: false, gzipSize: true }));
    } catch (err) {
      // optional dev dependency — ignore if not installed
      // eslint-disable-next-line no-console
      console.warn('Bundle visualizer not available:', err);
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Explicit alias: nested copy of the web app contains gsap under
        // `apps/web/node_modules/gsap`. Point the specifier to that folder
        // so Vite can resolve the package even when the workspace layout
        // has a nested app copy (temporary developer fix).
        gsap: path.resolve(__dirname, './apps/web/node_modules/gsap'),
      },
    },
    server: {
      proxy: {
        '/api/v1': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
        '/hackathons': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
        '/webhooks': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
  };
});
