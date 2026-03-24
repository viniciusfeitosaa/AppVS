/**
 * Com VITE_APP_BASE=/app/: move o SPA para dist/app/ e, se existir ../landing,
 * copia a landing para a raiz de dist (site em /, app em /app/).
 * Com VITE_APP_BASE=/ (padrão): não mexe — ficheiros ficam na raiz de dist (Docker, domínio dedicado).
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const landingDir = path.join(__dirname, '..', '..', 'landing');

const rawBase = process.env.VITE_APP_BASE || '/';
const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
const useAppSubpath = normalizedBase === '/app/';

function moveSpaIntoAppFolder() {
  const appDir = path.join(distDir, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  const indexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    fs.renameSync(indexHtml, path.join(appDir, 'index.html'));
  }
  const distAssets = path.join(distDir, 'assets');
  if (fs.existsSync(distAssets)) {
    fs.renameSync(distAssets, path.join(appDir, 'assets'));
  }
}

if (!useAppSubpath) {
  console.log('merge-landing: VITE_APP_BASE na raiz; nada a fazer.');
  process.exit(0);
}

if (!fs.existsSync(landingDir)) {
  moveSpaIntoAppFolder();
  console.log('merge-landing: SPA em dist/app/ (sem landing).');
  process.exit(0);
}

moveSpaIntoAppFolder();

const copy = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copy(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};

for (const name of fs.readdirSync(landingDir)) {
  const src = path.join(landingDir, name);
  const dest = path.join(distDir, name);
  if (name === 'README.md' || name === 'design.json') continue;
  copy(src, dest);
}

console.log('merge-landing: landing na raiz; app em /app/');
