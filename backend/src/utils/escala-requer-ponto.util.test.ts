import { plantaoExigePontoNoPlantao } from './escala-requer-ponto.util';

describe('plantaoExigePontoNoPlantao', () => {
  it('inclui quando escala exige ponto mesmo sem vínculo direto do médico', () => {
    expect(plantaoExigePontoNoPlantao(undefined, true, { alocadoNaGrade: true })).toBe(true);
    expect(
      plantaoExigePontoNoPlantao(
        { allowPonto: false, requireJanelaPlantao: false },
        true,
        { alocadoNaGrade: true }
      )
    ).toBe(true);
  });

  it('inclui médico alocado na grade com allowPonto', () => {
    expect(
      plantaoExigePontoNoPlantao(
        { allowPonto: true, requireJanelaPlantao: false },
        false,
        { alocadoNaGrade: true }
      )
    ).toBe(true);
  });

  it('exige requireJanelaPlantao quando não alocado na grade e escala não exige', () => {
    expect(
      plantaoExigePontoNoPlantao(
        { allowPonto: true, requireJanelaPlantao: false },
        false,
        { alocadoNaGrade: false }
      )
    ).toBe(false);
    expect(
      plantaoExigePontoNoPlantao(
        { allowPonto: true, requireJanelaPlantao: true },
        false,
        { alocadoNaGrade: false }
      )
    ).toBe(true);
  });
});
