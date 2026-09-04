import { prisma } from '../config/database';
import { dataCivilSaoPaulo } from './sao-paulo-data.util';

export const DOCUSEAL_CONTADOR_TERMO_TRANSFERENCIA = 'termo_transferencia';

/** Ano civil em São Paulo a partir de agora (ou data dada). */
export function anoCivilSaoPaulo(date = new Date()): number {
  return Number(dataCivilSaoPaulo(date).slice(0, 4));
}

/** Formata sequência no padrão 2026/000123. */
export function formatNumeroDocumentoDocuseal(ano: number, sequencia: number): string {
  const seq = Math.max(0, Math.floor(sequencia));
  return `${ano}/${String(seq).padStart(6, '0')}`;
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string };
  return err?.code === 'P2002';
}

/**
 * Reserva o próximo número atômico para a chave/ano (São Paulo).
 * `seedInicial` só vale na primeira criação da linha (ex.: continuar de 592).
 */
export async function alocarProximoNumeroDocumentoDocuseal(
  tenantId: string,
  chave: string,
  opts: { seedInicial?: number; ano?: number } = {}
): Promise<{ ano: number; sequencia: number; formatado: string }> {
  const ano = opts.ano ?? anoCivilSaoPaulo();
  const seed = Math.max(0, Math.floor(opts.seedInicial ?? 0));

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const sequencia = await prisma.$transaction(async (tx) => {
        const existing = await tx.docusealDocumentoContador.findUnique({
          where: { tenantId_chave_ano: { tenantId, chave, ano } },
          select: { id: true },
        });

        if (!existing) {
          const created = await tx.docusealDocumentoContador.create({
            data: {
              tenantId,
              chave,
              ano,
              ultimoNumero: seed + 1,
            },
            select: { ultimoNumero: true },
          });
          return created.ultimoNumero;
        }

        const updated = await tx.docusealDocumentoContador.update({
          where: { id: existing.id },
          data: { ultimoNumero: { increment: 1 } },
          select: { ultimoNumero: true },
        });
        return updated.ultimoNumero;
      });

      return {
        ano,
        sequencia,
        formatado: formatNumeroDocumentoDocuseal(ano, sequencia),
      };
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 2) throw e;
    }
  }

  throw new Error('Não foi possível alocar número de documento');
}
