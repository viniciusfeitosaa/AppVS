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
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
            console.warn('[proxy] Backend em', process.env.VITE_API_TARGET || 'http://127.0.0.1:3001', '— certifique-se de que o backend está rodando (ex: cd backend && npm run dev).', err.message);
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
