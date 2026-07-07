import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { landingDevPlugin } from './vite-plugin-landing-dev';

const landingIndex = path.resolve(__dirname, '../landing/index.html');

// Raiz `/` para Docker e domínio dedicado. Em dev, default `/app/` se existir landing/.
// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const landingExists = fs.existsSync(landingIndex);
  const isServe = command === 'serve';
  const configuredBase = env.VITE_APP_BASE?.trim();
  const base = configuredBase || (isServe && landingExists ? '/app/' : '/');

  if (isServe && landingExists && base !== '/app/') {
    console.warn(
      '[vite] VITE_APP_BASE não é /app/ — a landing estática em / não será servida; use VITE_APP_BASE=/app/ no .env.',
    );
  }

  return {
    base,
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
  };
});
