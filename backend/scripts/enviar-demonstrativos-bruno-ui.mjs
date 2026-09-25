/**
 * Envia 1 demonstrativo por mês (mar/abr/mai/jul 2026) para Bruno via UI do relatório.
 * Requer localStorage com lançamentos no perfil Chrome indicado.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.APP_BASE_URL || 'https://sejavivasaude.com.br';
const EMAIL = process.env.MASTER_INITIAL_EMAIL || 'contato@sejavivasaude.com.br';
const PASS = process.env.MASTER_INITIAL_PASSWORD || '';
const CHROME = process.env.CHROME_USER_DATA || '/home/vivasaude/.config/google-chrome';
const BRUNO = 'Bruno Augusto';
const MESES = [
  { label: 'mar.', chave: '2026-03' },
  { label: 'abr.', chave: '2026-04' },
  { label: 'mai.', chave: '2026-05' },
  { label: 'jul.', chave: '2026-07' },
];

async function main() {
  if (!PASS) throw new Error('MASTER_INITIAL_PASSWORD não definido');

  const userDataDir = fs.existsSync(CHROME) ? CHROME : undefined;
  const ctx = await chromium.launchPersistentContext(userDataDir || '/tmp/pw-bruno-ui', {
    headless: false,
    channel: userDataDir ? 'chrome' : undefined,
    viewport: { width: 1400, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const page = ctx.pages()[0] || (await ctx.newPage());
  const resultados = [];

  try {
    await page.goto(`${BASE}/app/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const onLogin = await page.locator('input[type="email"], input[name="email"]').count();
    if (onLogin) {
      await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
      await page.locator('input[type="password"]').first().fill(PASS);
      await page.getByRole('button', { name: /entrar|login|acessar/i }).first().click();
      await page.waitForURL(/\/app\//, { timeout: 30000 });
    }

    await page.goto(`${BASE}/app/relatorios-procedimentos`, { waitUntil: 'networkidle', timeout: 90000 });

    const storeRaw = await page.evaluate(() => localStorage.getItem('relatorioProcedimentosCalc_v1'));
    const keys = storeRaw ? Object.keys(JSON.parse(storeRaw)) : [];
    console.log('[info] meses no localStorage:', keys.join(', ') || '(vazio)');

    for (const m of MESES) {
      try {
        await page.getByRole('button', { name: new RegExp(m.label, 'i') }).first().click({ timeout: 10000 });
        await page.waitForTimeout(800);

        await page.getByRole('button', { name: /Produção por médico|resumo/i }).first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(500);

        const filtro = page.locator('input[placeholder*="médico" i], input[placeholder*="Medico" i]').first();
        if (await filtro.count()) {
          await filtro.fill('');
          await filtro.fill(BRUNO);
          await page.waitForTimeout(600);
        }

        const btnEnviar = page.getByRole('button', { name: /Enviar demonstrativo/i });
        if (!(await btnEnviar.isEnabled())) {
          resultados.push({ mes: m.chave, ok: false, erro: 'sem produção ou botão desabilitado' });
          console.error(`[skip] ${m.chave}`);
          continue;
        }

        await btnEnviar.click();
        await page.getByRole('heading', { name: /Enviar demonstrativo/i }).waitFor({ timeout: 15000 });

        const emailInput = page.locator('input[type="email"]').last();
        const dest = (await emailInput.inputValue()) || '';
        if (!dest.includes('bruno')) {
          await emailInput.fill('bruno_augusto_pm@hotmail.com');
        }

        await page.getByRole('button', { name: /^Enviar$/i }).last().click();
        await page.waitForTimeout(2500);

        const okToast = await page.getByText(/enviado|sucesso/i).count();
        resultados.push({ mes: m.chave, ok: okToast > 0, dest: dest || 'bruno_augusto_pm@hotmail.com' });
        console.log(`[ok] ${m.chave} enviado`);

        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        resultados.push({ mes: m.chave, ok: false, erro: msg });
        console.error(`[erro] ${m.chave}:`, msg);
      }
    }
  } finally {
    await ctx.close();
  }

  console.log('\n--- Resumo ---');
  console.log(JSON.stringify(resultados, null, 2));
  process.exit(resultados.some((r) => r.ok) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
