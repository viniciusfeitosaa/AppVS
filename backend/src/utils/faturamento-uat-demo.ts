/** Cenário UAT visível no Relatório financeiro (seed + testes). */

export const UAT_FATURAMENTO = {
  contratoNome: 'UAT Faturamento misto',
  tipoNome: 'UAT Manhã 12h',
  subgrupoPontoNome: 'UAT Escala + Ponto',
  subgrupoEscalaNome: 'UAT Somente Escala',
  equipePontoNome: 'UAT Equipe Ponto',
  equipeEscalaNome: 'UAT Equipe Só Escala',
  escalaPontoNome: 'UAT Escala com ponto',
  escalaSomenteNome: 'UAT Escala sem ponto',
  senhaPadrao: 'Uat@2026',
  medicoPonto: {
    nome: 'Dr. Teste Ponto',
    email: 'uat.ponto@vivasaude.test',
    cpf: '52998224725',
    crm: 'UAT-PONTO-1',
  },
  medicoEscala: {
    nome: 'Dr. Teste Escala',
    email: 'uat.escala@vivasaude.test',
    cpf: '39053344705',
    crm: 'UAT-ESC-1',
  },
  /** Plantões do cenário (DATE UTC). */
  datasIso: ['2026-08-17', '2026-08-18'] as const,
  horasTurno: 12,
  /**
   * Margem de 25% da tela Valores Plantão: cobrança = repasse / (1 − 0,25).
   * “25% em cima do repasse” no cadastro = essa margem (não markup 1,25).
   */
  margemPct: 25,
  /** Escala + ponto: cobrança R$ 120/h → repasse R$ 90/h */
  ponto: { cobrancaHora: 120, repasseHora: 90 },
  /** Somente escala: cobrança R$ 100/h → repasse R$ 75/h */
  somenteEscala: { cobrancaHora: 100, repasseHora: 75 },
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function totaisUatFaturamento() {
  const n = UAT_FATURAMENTO.datasIso.length;
  const h = UAT_FATURAMENTO.horasTurno;
  const horas = n * h;
  const pontoRep = round2(horas * UAT_FATURAMENTO.ponto.repasseHora);
  const pontoCob = round2(horas * UAT_FATURAMENTO.ponto.cobrancaHora);
  const escRep = round2(horas * UAT_FATURAMENTO.somenteEscala.repasseHora);
  const escCob = round2(horas * UAT_FATURAMENTO.somenteEscala.cobrancaHora);
  return {
    plantoesPorMedico: n,
    horasPorMedico: horas,
    ponto: { medico: UAT_FATURAMENTO.medicoPonto.nome, horas, plantoes: n, repasse: pontoRep, cobranca: pontoCob },
    somenteEscala: {
      medico: UAT_FATURAMENTO.medicoEscala.nome,
      horas,
      plantoes: n,
      repasse: escRep,
      cobranca: escCob,
    },
    contrato: {
      repasse: round2(pontoRep + escRep),
      cobranca: round2(pontoCob + escCob),
      horas: horas * 2,
      plantoes: n * 2,
    },
  };
}

export function htmlUatFaturamentoVisual(): string {
  const t = totaisUatFaturamento();
  const c = UAT_FATURAMENTO;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>UAT Faturamento misto — valores esperados</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, Segoe UI, sans-serif; margin: 32px; background: #f6f7f4; color: #14261a; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    p, li { line-height: 1.5; }
    .card { background: #fff; border-radius: 12px; padding: 20px 24px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e5e7eb; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #3d6b4a; }
    .num { font-variant-numeric: tabular-nums; font-weight: 600; }
    code { background: #eef4ef; padding: 1px 6px; border-radius: 4px; }
    .hint { font-size: 14px; color: #445c4c; }
  </style>
</head>
<body>
  <h1>UAT Faturamento misto</h1>
  <p class="hint">Contrato <strong>${c.contratoNome}</strong> · período <code>2026-08-01</code> a <code>2026-08-31</code> · 2 plantões de ${c.horasTurno}h cada · margem ${c.margemPct}% (cobrança = repasse ÷ 0,75).</p>
  <div class="card">
    <h2>Como conferir</h2>
    <ol>
      <li>Master: Relatório financeiro → contrato <strong>${c.contratoNome}</strong> → agosto/2026.</li>
      <li>Filtre o subgrupo <strong>${c.subgrupoPontoNome}</strong> (ponto) e depois <strong>${c.subgrupoEscalaNome}</strong> (só escala).</li>
      <li>Login médico (senha <code>${c.senhaPadrao}</code>): <code>${c.medicoPonto.email}</code> / <code>${c.medicoEscala.email}</code>.</li>
    </ol>
  </div>
  <div class="card">
    <h2>Valores cadastrados (R$/h)</h2>
    <table>
      <thead><tr><th>Modalidade</th><th>Cobrança/h</th><th>Margem</th><th>Repasse/h</th></tr></thead>
      <tbody>
        <tr><td>Escala + ponto</td><td class="num">R$ ${c.ponto.cobrancaHora.toFixed(2)}</td><td>${c.margemPct}%</td><td class="num">R$ ${c.ponto.repasseHora.toFixed(2)}</td></tr>
        <tr><td>Somente escala</td><td class="num">R$ ${c.somenteEscala.cobrancaHora.toFixed(2)}</td><td>${c.margemPct}%</td><td class="num">R$ ${c.somenteEscala.repasseHora.toFixed(2)}</td></tr>
      </tbody>
    </table>
  </div>
  <div class="card">
    <h2>Totais esperados no relatório</h2>
    <table>
      <thead><tr><th>Profissional</th><th>Plantões</th><th>Horas</th><th>Repasse</th><th>Cobrança</th></tr></thead>
      <tbody>
        <tr>
          <td>${t.ponto.medico}<br/><span class="hint">${c.escalaPontoNome}</span></td>
          <td class="num">${t.ponto.plantoes}</td>
          <td class="num">${t.ponto.horas}h</td>
          <td class="num">R$ ${t.ponto.repasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td class="num">R$ ${t.ponto.cobranca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td>${t.somenteEscala.medico}<br/><span class="hint">${c.escalaSomenteNome}</span></td>
          <td class="num">${t.somenteEscala.plantoes}</td>
          <td class="num">${t.somenteEscala.horas}h</td>
          <td class="num">R$ ${t.somenteEscala.repasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td class="num">R$ ${t.somenteEscala.cobranca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td><strong>Contrato (os dois)</strong></td>
          <td class="num">${t.contrato.plantoes}</td>
          <td class="num">${t.contrato.horas}h</td>
          <td class="num">R$ ${t.contrato.repasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td class="num">R$ ${t.contrato.cobranca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>
    <p class="hint">Fórmula: ${c.horasTurno} h × R$/h × ${t.plantoesPorMedico} plantões (${c.datasIso.join(' e ')}). Sem adicional.</p>
  </div>
</body>
</html>
`;
}
