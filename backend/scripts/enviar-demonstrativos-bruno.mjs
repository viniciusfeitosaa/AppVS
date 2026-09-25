/**
 * Envia demonstrativos de produção para Bruno (mar/abr/mai/jul 2026).
 *
 * Uso:
 *   node scripts/enviar-demonstrativos-bruno.mjs [/caminho/relatorioProcedimentosCalc_v1.json]
 *
 * O JSON pode ser exportado no navegador (F12 → Console):
 *   copy(localStorage.getItem('relatorioProcedimentosCalc_v1'))
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const FRONTEND = path.join(ROOT, 'frontend');

const BASE_URL = process.env.APP_BASE_URL || 'https://sejavivasaude.com.br';
const BRUNO_EMAIL = 'bruno_augusto_pm@hotmail.com';
const BRUNO_NOME = 'Bruno Augusto Pinto de Menezes';
const BRUNO_CRM = '18897-CE';
const MESES = [
  { mesRef: '2026-03', mes: 3, ano: 2026 },
  { mesRef: '2026-04', mes: 4, ano: 2026 },
  { mesRef: '2026-05', mes: 5, ano: 2026 },
  { mesRef: '2026-07', mes: 7, ano: 2026 },
];

function loadEnvFile() {
  const envPath = process.env.APPVS_ENV || path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function rotuloQuem(nome, crm) {
  const n = (nome || '').trim();
  const c = (crm || '').trim();
  if (!n && !c) return null;
  if (n && c) return `${n} · CRM ${c}`;
  return n || `CRM ${c}`;
}

function parseNumeroBr(s, fallback = 0) {
  if (!s || !String(s).trim()) return fallback;
  const raw = String(s).trim().replace(/%/g, '').replace(/R\$/g, '').replace(/\s/g, '');
  if (!raw) return fallback;
  if (raw.includes(',') && raw.includes('.')) return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || fallback;
  if (raw.includes(',')) return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || fallback;
  return parseFloat(raw) || fallback;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

const MARGEM_COOP_PCT = 25;
const defaultRepasse2MedPct = 30;

function quemRepasseEfetivo(l, dadosMes) {
  if (l.quemRepasse) return l.quemRepasse;
  return {
    incluirProfissional1: dadosMes.incluirProfissional1,
    incluirProfissional2: dadosMes.incluirProfissional2,
    profissional1Nome: dadosMes.profissional1Nome,
    profissional1Crm: dadosMes.profissional1Crm,
    profissional2Nome: dadosMes.profissional2Nome,
    profissional2Crm: dadosMes.profissional2Crm,
  };
}

function repassePorLinhaMargemFixa(bruto, r2Pct, q) {
  const repasseLinha = round2(bruto * (1 - MARGEM_COOP_PCT / 100));
  const margemLinha = round2(bruto - repasseLinha);
  const n1 = q.incluirProfissional1 ? 1 : 0;
  const n2 = q.incluirProfissional2 ? 1 : 0;
  if (n1 + n2 === 0) return { margemLinha, r1: 0, r2: 0 };
  if (n1 && !n2) return { margemLinha, r1: repasseLinha, r2: 0 };
  if (!n1 && n2) return { margemLinha, r1: 0, r2: repasseLinha };
  const r2 = round2(repasseLinha * (r2Pct / 100));
  const r1 = round2(repasseLinha - r2);
  return { margemLinha, r1, r2 };
}

function rotuloProcedimentoLinha(l) {
  const partes = [l.nome1?.trim(), l.nome2?.trim()].filter(Boolean);
  if (partes.length) return partes.join(' + ');
  return l.instrumento?.trim() || '—';
}

function formatarDataISO(iso) {
  if (!iso) return '—';
  const head = iso.includes('T') ? iso.split('T')[0].trim() : iso.trim();
  const [y, m, d] = head.split('-');
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

function brunoRotuloMatch(rotulo) {
  const t = (rotulo || '').toLowerCase();
  return t.includes('bruno') && t.includes('augusto') && t.includes('menezes');
}

function extrairDetalheBruno(dadosMes) {
  const r2Pct = parseNumeroBr(dadosMes.repasse2MedPct, defaultRepasse2MedPct);
  const rows = [];
  for (const l of dadosMes.procedimentos || []) {
    const bruto = parseNumeroBr(l.valorPrimeiro) + parseNumeroBr(l.valorSegundo);
    const q = quemRepasseEfetivo(l, dadosMes);
    const r = repassePorLinhaMargemFixa(bruto, r2Pct, q);
    const procedimento = rotuloProcedimentoLinha(l);
    const dataFmt = formatarDataISO(l.dataProcedimento);
    if (q.incluirProfissional1) {
      const m1 = rotuloQuem(q.profissional1Nome, q.profissional1Crm);
      if (m1 && brunoRotuloMatch(m1)) {
        rows.push({ dataFmt, medico: m1, procedimento, posicao: '1.º médico', valorReceber: r.r1 });
      }
    }
    if (q.incluirProfissional2) {
      const m2 = rotuloQuem(q.profissional2Nome, q.profissional2Crm);
      if (m2 && brunoRotuloMatch(m2)) {
        rows.push({ dataFmt, medico: m2, procedimento, posicao: '2.º médico', valorReceber: r.r2 });
      }
    }
  }
  rows.sort((a, b) => a.dataFmt.localeCompare(b.dataFmt));
  return { linhas: rows, total: round2(rows.reduce((a, r) => a + r.valorReceber, 0)) };
}

async function loginMaster() {
  const email = process.env.MASTER_INITIAL_EMAIL || 'contato@sejavivasaude.com.br';
  const password = process.env.MASTER_INITIAL_PASSWORD;
  if (!password) throw new Error('MASTER_INITIAL_PASSWORD não definido');
  const resp = await fetch(`${BASE_URL}/api/auth/login-master`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await resp.json();
  const token = json.accessToken || json.data?.accessToken;
  if (!resp.ok || !token) throw new Error(json.error || 'Falha no login master');
  return token;
}

async function fetchMesBackend(mesRef, token) {
  const resp = await fetch(`${BASE_URL}/api/admin/relatorios/procedimentos/${mesRef}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json?.data && typeof json.data === 'object' ? json.data : null;
}

function buildAssunto(mes, ano) {
  const nomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `Envio de Demonstrativo – ${nomes[mes]} de ${ano}`;
}

function buildCorpo(mes, ano) {
  const nomes = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `Prezado(a) Dr(a) ${BRUNO_NOME},

Segue, em anexo, o demonstrativo referente ao mês de ${nomes[mes]} de ${ano}.

Ficamos à disposição para quaisquer esclarecimentos.

Atenciosamente,

Viva Saúde

⸻

Este é um e-mail automático do sistema Viva Saúde. Por favor, não responda a esta mensagem.`;
}

async function buildPdf(mesRef, linhas, total) {
  const jsPDF = (await import(pathToFileURL(path.join(FRONTEND, 'node_modules/jspdf/dist/jspdf.es.min.js')).href)).default;
  const autoTable = (await import(pathToFileURL(path.join(FRONTEND, 'node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs')).href)).default;
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const medicoRotulo = `${BRUNO_NOME} · CRM ${BRUNO_CRM}`;
  const cel = (s) => String(s ?? '').replace(/\u00a0/g, ' ').normalize('NFC');

  const head = [['Data', 'Médico', 'Procedimento', 'Posição', 'Valor a receber']];
  const body = linhas.map((r) => [
    cel(r.dataFmt),
    cel(r.medico),
    cel(r.procedimento),
    cel(r.posicao),
    cel(BRL.format(r.valorReceber).replace(/\u00a0/g, ' ')),
  ]);
  body.push(['', '', '', 'Total', cel(BRL.format(total).replace(/\u00a0/g, ' '))]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(12);
  doc.text('Produção por médico', 10, 15);
  doc.setFontSize(9);
  doc.text(`Referência: ${mesRef}`, 10, 21);
  doc.text(`Médico: ${medicoRotulo}`, 10, 27);
  autoTable(doc, {
    startY: 33,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 65, 85] },
    margin: { left: 10, right: 10 },
  });
  const slug = medicoRotulo.replace(/[^\w.-]+/g, '_').slice(0, 40);
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  return { base64, filename: `producao-por-medico_${mesRef}_${slug}.pdf` };
}

async function enviarEmail(token, assunto, corpoTexto, pdf) {
  const resp = await fetch(`${BASE_URL}/api/email/mensagens/enviar-agora`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assunto,
      corpoTexto,
      destinatarios: [BRUNO_EMAIL],
      anexos: [{ filename: pdf.filename, contentBase64: pdf.base64, contentType: 'application/pdf' }],
    }),
  });
  const json = await resp.json();
  if (!resp.ok || json.success === false) throw new Error(json.error || `HTTP ${resp.status}`);
}

function loadStore(pathArg) {
  if (pathArg && fs.existsSync(pathArg)) {
    const raw = JSON.parse(fs.readFileSync(pathArg, 'utf8'));
    if (raw && typeof raw === 'object' && !raw['2026-03'] && raw.procedimentos) {
      throw new Error('JSON parece ser um único mês; passe o objeto completo relatorioProcedimentosCalc_v1');
    }
    return raw;
  }
  return null;
}

async function main() {
  loadEnvFile();
  const token = await loginMaster();
  console.log('[ok] login master');

  const backupPath = process.argv[2];
  let store = loadStore(backupPath);
  const resultados = [];

  for (const { mesRef, mes, ano } of MESES) {
    try {
      let dados = store?.[mesRef] || null;
      if (!dados) dados = await fetchMesBackend(mesRef, token);
      if (!dados) {
        resultados.push({ mesRef, ok: false, erro: 'sem dados (localStorage/servidor)' });
        console.error(`[skip] ${mesRef} — sem dados`);
        continue;
      }
      const { linhas, total } = extrairDetalheBruno(dados);
      if (!linhas.length) {
        resultados.push({ mesRef, ok: false, erro: 'Bruno sem lançamentos' });
        console.error(`[skip] ${mesRef} — Bruno sem lançamentos`);
        continue;
      }
      const pdf = await buildPdf(mesRef, linhas, total);
      await enviarEmail(token, buildAssunto(mes, ano), buildCorpo(mes, ano), pdf);
      resultados.push({ mesRef, ok: true, linhas: linhas.length, total });
      console.log(`[ok] ${mesRef} → ${BRUNO_EMAIL} (${linhas.length} proc., R$ ${total.toFixed(2)})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      resultados.push({ mesRef, ok: false, erro: msg });
      console.error(`[erro] ${mesRef}:`, msg);
    }
  }

  console.log('\n--- Resumo ---');
  console.log(JSON.stringify(resultados, null, 2));
  process.exit(resultados.filter((r) => r.ok).length > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
