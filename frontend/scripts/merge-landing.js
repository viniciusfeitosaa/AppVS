/**
 * Após o build do Vite (base: /app/), coloca o app em dist/app/ e copia
 * a landing estática (../landing) para a raiz de dist, para que:
 * - https://sejavivasaude.com.br/  → landing (dist/index.html)
 * - https://sejavivasaude.com.br/app  → React SPA (dist/app/index.html)
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const landingDir = path.join(__dirname, '..', '..', 'landing');

if (!fs.existsSync(landingDir)) {
  console.warn('merge-landing: pasta landing/ não encontrada; pulando merge.');
  process.exit(0);
}

// 1. Criar dist/app e mover o build do React para dentro
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

// 2. Copiar landing para a raiz de dist
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
  if (name === 'README.md' || name === 'design.json') continue; // não publicar
  copy(src, dest);
}

console.log('merge-landing: landing copiada para raiz; app em /app/');
