import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
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
});
