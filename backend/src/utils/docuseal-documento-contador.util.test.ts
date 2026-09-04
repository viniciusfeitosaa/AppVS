import {
  anoCivilSaoPaulo,
  formatNumeroDocumentoDocuseal,
} from './docuseal-documento-contador.util';

describe('formatNumeroDocumentoDocuseal', () => {
  it('formata ano/sequência com 6 dígitos', () => {
    expect(formatNumeroDocumentoDocuseal(2026, 1)).toBe('2026/000001');
    expect(formatNumeroDocumentoDocuseal(2026, 593)).toBe('2026/000593');
  });
});

describe('anoCivilSaoPaulo', () => {
  it('retorna ano a partir da data civil SP', () => {
    expect(anoCivilSaoPaulo(new Date('2026-09-04T15:00:00.000Z'))).toBe(2026);
  });
});
