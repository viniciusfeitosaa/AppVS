import { MESES_OPCOES, anosDisponiveis, nomeMes } from './email-nf-template.util';
import type { EmailNfPersonalizado } from './email-nf-template.util';

export { MESES_OPCOES, anosDisponiveis };

function nomeMesTitulo(mes: number): string {
  const nome = nomeMes(mes);
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function buildAssuntoDemonstrativo(mes: number, ano: number): string {
  return `Envio de Demonstrativo – ${nomeMesTitulo(mes)} de ${ano}`;
}

export function buildCorpoDemonstrativo(mes: number, ano: number, nomeDestinatario?: string): string {
  const periodo = `${nomeMes(mes)} de ${ano}`;
  const saudacao = nomeDestinatario?.trim()
    ? `Prezado(a) Dr(a) ${nomeDestinatario.trim()},`
    : 'Prezado(a) Dr(a),';

  return `${saudacao}

Segue, em anexo, o demonstrativo referente ao mês de ${periodo}.

Permaneço à disposição para quaisquer esclarecimentos.

Atenciosamente,

Viva Saúde

⸻

Este é um e-mail automático do sistema Viva Saúde. Por favor, não responda a esta mensagem.`;
}

export type DemonstrativoContato = {
  nome: string;
  email: string;
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const EMAIL_INVALIDO_REGEX = /e-?mail\s+n[aã]o\s+validado/i;

/** Interpreta lista colada: nome + e-mail (uma linha por pessoa). */
export function parseDemonstrativoContatos(texto: string): {
  destinatarios: DemonstrativoContato[];
  ignorados: { linha: string; motivo: string }[];
} {
  const porEmail = new Map<string, DemonstrativoContato>();
  const ignorados: { linha: string; motivo: string }[] = [];

  for (const raw of texto.split(/\r?\n/)) {
    const linha = raw.trim();
    if (!linha) continue;

    if (EMAIL_INVALIDO_REGEX.test(linha)) {
      ignorados.push({ linha, motivo: 'E-mail não validado' });
      continue;
    }

    const emailMatch = linha.match(EMAIL_REGEX);
    if (!emailMatch) {
      ignorados.push({ linha, motivo: 'E-mail não encontrado' });
      continue;
    }

    const email = emailMatch[0].toLowerCase();
    const nome = linha.slice(0, linha.indexOf(emailMatch[0])).replace(/\s+/g, ' ').trim();
    if (!nome) {
      ignorados.push({ linha, motivo: 'Nome não encontrado' });
      continue;
    }

    if (!porEmail.has(email)) {
      porEmail.set(email, { nome, email });
    }
  }

  return {
    destinatarios: [...porEmail.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    ignorados,
  };
}

export function buildEmailsDemonstrativo(
  mes: number,
  ano: number,
  destinatarios: DemonstrativoContato[]
): EmailNfPersonalizado[] {
  const assunto = buildAssuntoDemonstrativo(mes, ano);
  return destinatarios.map((d) => ({
    nome: d.nome,
    email: d.email,
    assunto,
    corpoTexto: buildCorpoDemonstrativo(mes, ano, d.nome),
  }));
}
