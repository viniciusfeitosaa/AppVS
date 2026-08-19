import ValoresPlantao from './ValoresPlantao';

const ModuloEscalaMaster = () => (
  <ValoresPlantao
    modo="somente_escala"
    titulo="Módulo Escala"
    descricao="Escolha contrato, subgrupo e equipe do estilo Somente escala. Defina valores por tipo (repasse/cobrança por dia). Os tipos de plantão (horários) são cadastrados em Escalas → aba Tipos."
    exibirLocalizacaoPonto={false}
  />
);

export default ModuloEscalaMaster;
