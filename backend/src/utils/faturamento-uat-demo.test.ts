import { calcularTotaisPlantaoSomenteEscala } from './valor-plantao-dia.util';
import { htmlUatFaturamentoVisual, totaisUatFaturamento, UAT_FATURAMENTO } from './faturamento-uat-demo';

describe('UAT faturamento misto (valores visíveis no relatório)', () => {
  it('margem 25% bate com cob 120 → repasse 90 e cob 100 → repasse 75', () => {
    expect(UAT_FATURAMENTO.ponto.repasseHora).toBe(90);
    expect(UAT_FATURAMENTO.ponto.cobrancaHora).toBe(120);
    expect(UAT_FATURAMENTO.somenteEscala.repasseHora).toBe(75);
    expect(UAT_FATURAMENTO.somenteEscala.cobrancaHora).toBe(100);
    expect(90 / (1 - 0.25)).toBe(120);
    expect(75 / (1 - 0.25)).toBe(100);
  });

  it('um plantão de 12h na modalidade ponto', () => {
    const r = calcularTotaisPlantaoSomenteEscala({
      horasTurno: 12,
      dia: 'seg',
      cadastro: {
        valorHora: 90,
        valorHoraCobranca: 120,
        valorHoraPorDia: { seg: 90 },
        valorHoraCobrancaPorDia: { seg: 120 },
      },
    });
    expect(r.valorRepasse).toBe(1080);
    expect(r.valorCobranca).toBe(1440);
  });

  it('um plantão de 12h na modalidade somente escala', () => {
    const r = calcularTotaisPlantaoSomenteEscala({
      horasTurno: 12,
      dia: 'ter',
      cadastro: {
        valorHora: 75,
        valorHoraCobranca: 100,
      },
    });
    expect(r.valorRepasse).toBe(900);
    expect(r.valorCobranca).toBe(1200);
  });

  it('dois plantões por médico no mês — totais do relatório', () => {
    const t = totaisUatFaturamento();
    expect(t.ponto.repasse).toBe(2160);
    expect(t.ponto.cobranca).toBe(2880);
    expect(t.somenteEscala.repasse).toBe(1800);
    expect(t.somenteEscala.cobranca).toBe(2400);
    expect(t.contrato.repasse).toBe(3960);
    expect(t.contrato.cobranca).toBe(5280);
    expect(t.contrato.horas).toBe(48);
  });

  it('HTML visual contém os totais e os logins de teste', () => {
    const html = htmlUatFaturamentoVisual();
    expect(html).toContain('R$ 2.160,00');
    expect(html).toContain('R$ 2.880,00');
    expect(html).toContain('R$ 1.800,00');
    expect(html).toContain('R$ 2.400,00');
    expect(html).toContain(UAT_FATURAMENTO.medicoPonto.email);
    expect(html).toContain(UAT_FATURAMENTO.medicoEscala.email);
    expect(html).toContain(UAT_FATURAMENTO.contratoNome);
  });
});
