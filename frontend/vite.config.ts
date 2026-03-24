import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Raiz `/` para Docker e domínio dedicado. Para deploy em /app/ (ex.: Netlify + landing), define VITE_APP_BASE=/app/
// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_APP_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
