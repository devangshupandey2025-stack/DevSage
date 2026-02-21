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
      },
    },
    server: {
      proxy: {
        '/api/v1': {
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
