import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig(async () => {
  const plugins: any[] = [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ];

  if (process.env.ANALYZE) {
    try {
      const { visualizer } = await import('rollup-plugin-visualizer');
      plugins.push(visualizer({ filename: 'dist/bundle-analysis.html', open: false, gzipSize: true }));
    } catch {
      // optional dev dependency
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
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: [],
    },
  };
});
