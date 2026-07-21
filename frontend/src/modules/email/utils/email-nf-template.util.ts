import type { NfDestinatarioParsed, NfProducaoLinha } from './parse-nf-tabela.util';
import { formatValorBRL, somarProducoes } from './parse-nf-tabela.util';

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

export function nomeMes(mes: number): string {
  return MESES[mes - 1] ?? 'janeiro';
}

export function nomeMesMaiusculo(mes: number): string {
  return nomeMes(mes).toUpperCase();
}

export function buildAssuntoNotaFiscal(mes: number, ano: number): string {
  return `INFORMAÇÕES PARA EMISSÃO DE NOTA FISCAL - PLANTÕES ${nomeMesMaiusculo(mes)}/${ano}`;
}

function buildBlocoProducao(producoes: NfProducaoLinha[]): string {
  const linhas = producoes.map((p) => `• ${p.upa} — ${p.horas} h — ${p.valor}`);
  const total = formatValorBRL(somarProducoes(producoes));

  return `

Sua produção no período:

${linhas.join('\n')}

Valor total bruto: ${total}
`;
}

export function buildCorpoNotaFiscal(
  mes: number,
  producoes?: NfProducaoLinha[],
  nomeDestinatario?: string
): string {
  const periodo = nomeMes(mes);
  const blocoProducao = producoes?.length ? buildBlocoProducao(producoes) : '';
  const saudacao = nomeDestinatario?.trim()
    ? `Prezado(a) Dr(a) ${nomeDestinatario.trim()},`
    : 'Prezado(a) Dr(a),';

  return `${saudacao}

Informamos que o valor bruto para a emissão da sua nota fiscal, referente aos plantões realizados no período de ${periodo}, com horas e os valores das produções por UPA.
${blocoProducao}


Ao emitir a nota fiscal, favor informar no corpo da nota:

A unidade de atendimento (UPA) correspondente

Os dados bancários da empresa

O mês de competência dos plantões

O envio das notas fiscais deverá ser EXCLUSIVAMENTE para o e-mail notasfiscais@sejavivasaude.com.br, acompanhadas obrigatoriamente dos arquivos em PDF e XML.

Dados para emissão da nota fiscal:
Razão Social: Viva Serviços em Saúde S.A.
CNPJ: 06.243.200/0001-51
Endereço: Rua Serra de Botucatu, nº 1195 – Sala 103
Bairro: Vila Gomes Cardim – São Paulo/SP

⸻

ATENÇÃO: O prazo para o recebimento das notas fiscais deve ocorrer em até 48h após o recebimento do e-mail. O não cumprimento deste prazo resultará em nova previsão de pagamento.

Ficamos à disposição para quaisquer dúvidas.


Atenciosamente,

Viva Saúde

⸻

Este é um e-mail automático do sistema Viva Saúde. Por favor, não responda a esta mensagem.`;
}

export const MESES_OPCOES = MESES.map((label, i) => ({
  value: i + 1,
  label: label.charAt(0).toUpperCase() + label.slice(1),
}));

export function anosDisponiveis(anoBase = new Date().getFullYear()): number[] {
  return [anoBase - 1, anoBase, anoBase + 1];
}

export type EmailNfPersonalizado = {
  nome: string;
  email: string;
  assunto: string;
  corpoTexto: string;
};

export function buildEmailsNfPersonalizados(
  mes: number,
  ano: number,
  destinatarios: NfDestinatarioParsed[]
): EmailNfPersonalizado[] {
  const assunto = buildAssuntoNotaFiscal(mes, ano);
  return destinatarios.map((d) => ({
    nome: d.nome,
    email: d.email,
    assunto,
    corpoTexto: buildCorpoNotaFiscal(mes, d.producoes, d.nome),
  }));
}
