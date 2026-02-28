/**
 * Falha o build se, em produção, VITE_API_URL não estiver definida ou for localhost.
 * Assim o Netlify mostra o erro no log e não sobe um build com API errada.
 */
const isProduction = process.env.NODE_ENV === 'production';
const url = process.env.VITE_API_URL || '';

if (isProduction) {
  if (!url || url.includes('localhost')) {
    console.error('');
    console.error('❌ Build de produção requer VITE_API_URL apontando para o backend (ex.: https://appvs.onrender.com/api).');
    console.error('   No Netlify: Site configuration → Environment variables → VITE_API_URL = https://appvs.onrender.com/api');
    console.error('   Valor atual:', url || '(não definida)');
    console.error('');
    process.exit(1);
  }
  console.log('✓ VITE_API_URL definida para produção:', url.replace(/:[^:@]+@/, ':****@'));
}
