import { decidirFaceStatus, mensagemMotivoCadastroFace } from './face-decisao.util';

const L = { match: 0.45, review: 0.3, liveness: 0.5 };
const r = (similarity: number | null, live: number | null = 0.9, faces = 1) => ({
  faces,
  similarity,
  liveness: { real: live == null ? null : live >= 0.5, score: live },
});

describe('decidirFaceStatus', () => {
  it('confere acima do limiar de match', () => {
    expect(decidirFaceStatus(r(0.62), L)).toBe('CONFERE');
    expect(decidirFaceStatus(r(0.45), L)).toBe('CONFERE');
  });

  it('incerto entre review e match', () => {
    expect(decidirFaceStatus(r(0.38), L)).toBe('INCERTO');
  });

  it('divergente abaixo do review', () => {
    expect(decidirFaceStatus(r(0.05), L)).toBe('DIVERGENTE');
  });

  it('spoof tem prioridade sobre similaridade alta', () => {
    expect(decidirFaceStatus(r(0.9, 0.2), L)).toBe('SPOOF_SUSPEITO');
  });

  it('sem liveness não marca spoof', () => {
    expect(decidirFaceStatus(r(0.6, null), L)).toBe('CONFERE');
  });

  it('nenhum ou vários rostos', () => {
    expect(decidirFaceStatus(r(null, null, 0), L)).toBe('SEM_ROSTO');
    expect(decidirFaceStatus(r(0.7, 0.9, 2), L)).toBe('SEM_ROSTO');
  });
});

describe('mensagemMotivoCadastroFace', () => {
  it('traduz motivo conhecido e tem fallback', () => {
    expect(mensagemMotivoCadastroFace('FOTO_ESCURA')).toMatch(/escura/);
    expect(mensagemMotivoCadastroFace('XYZ')).toMatch(/Não foi possível/);
  });
});
