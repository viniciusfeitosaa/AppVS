import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { landingDevPlugin } from './vite-plugin-landing-dev';

const landingIndex = path.resolve(__dirname, '../landing/index.html');
const devUsesOfficialLanding =
  process.env.npm_lifecycle_event === 'dev' &&
  !process.env.VITE_APP_BASE &&
  fs.existsSync(landingIndex);

// Raiz `/` para Docker e domínio dedicado. Em `npm run dev`, default `/app/` se existir landing/.
// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_APP_BASE ?? (devUsesOfficialLanding ? '/app/' : '/'),
  plugins: [react(), landingDevPlugin()],
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
