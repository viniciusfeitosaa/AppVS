import { isClientUuidValido, resolverInstanteOffline } from './ponto-offline.util';

const agora = new Date('2026-10-02T15:00:00.000Z');

describe('resolverInstanteOffline', () => {
  it('relógio certo: instante = captura, sem revisão', () => {
    const r = resolverInstanteOffline({
      capturadoEm: '2026-10-02T13:00:00.000Z',
      enviadoEm: '2026-10-02T15:00:00.000Z',
      agora,
    });
    expect(r.instante.toISOString()).toBe('2026-10-02T13:00:00.000Z');
    expect(r.desvioMs).toBe(0);
    expect(r.revisar).toBe(false);
  });

  it('corrige aparelho atrasado 1 h e marca revisão pelo desvio', () => {
    const r = resolverInstanteOffline({
      capturadoEm: '2026-10-02T12:00:00.000Z',
      enviadoEm: '2026-10-02T14:00:00.000Z',
      agora,
    });
    expect(r.instante.toISOString()).toBe('2026-10-02T13:00:00.000Z');
    expect(r.desvioMs).toBe(60 * 60 * 1000);
    expect(r.revisar).toBe(true);
  });

  it('sincronizado com mais de 12 h vai para revisão', () => {
    const r = resolverInstanteOffline({
      capturadoEm: '2026-10-02T01:00:00.000Z',
      enviadoEm: '2026-10-02T15:00:00.000Z',
      agora,
    });
    expect(r.revisar).toBe(true);
  });

  it('recusa mais de 24 h', () => {
    expect(() =>
      resolverInstanteOffline({
        capturadoEm: '2026-10-01T14:00:00.000Z',
        enviadoEm: '2026-10-02T15:00:00.000Z',
        agora,
      })
    ).toThrow();
  });

  it('recusa captura depois do envio e datas inválidas', () => {
    expect(() =>
      resolverInstanteOffline({ capturadoEm: '2026-10-02T16:00:00.000Z', enviadoEm: '2026-10-02T15:00:00.000Z', agora })
    ).toThrow();
    expect(() => resolverInstanteOffline({ capturadoEm: 'x', enviadoEm: '2026-10-02T15:00:00.000Z', agora })).toThrow();
  });
});

describe('isClientUuidValido', () => {
  it('aceita uuid v4 e recusa lixo', () => {
    expect(isClientUuidValido('3f2b8c1e-9a4d-4f6b-8c2d-1e5f7a9b0c3d')).toBe(true);
    expect(isClientUuidValido('abc')).toBe(false);
    expect(isClientUuidValido(undefined)).toBe(false);
  });
});
