import fs from 'fs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import env from '../config/env';
import { FACE_STATUS_REVISAO } from '../utils/face-decisao.util';
import { fileExistsSafe, resolveStoredFileToAbsolute } from '../utils/upload-path.util';
import { safeLogger } from '../utils/safe-logger';

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const LOTE = 200;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

function apagarArquivo(caminho: string | null | undefined): boolean {
  if (!caminho?.trim()) return false;
  try {
    const abs = resolveStoredFileToAbsolute(caminho.trim());
    if (!fileExistsSafe(abs)) return false;
    fs.unlinkSync(abs);
    return true;
  } catch {
    return false;
  }
}

/** Cadastro público fica `ativo: false` até a aprovação; só conta desativado depois de aprovado. */
const WHERE_BIOMETRIA_SEM_VINCULO: Prisma.MedicoBiometriaFacialWhereInput = {
  OR: [
    { medico: { ativo: false, statusCadastro: 'ATIVO' } },
    { medico: { statusCadastro: 'REJEITADO' } },
  ],
};

type LinhaExpirada = { id: string; foto_checkin_caminho: string | null; foto_checkout_caminho: string | null };

/**
 * Fotos de ponto além da retenção, exceto as que ainda servem de prova:
 * verificação pendente, divergência sem revisão ou revisada como suspeita de fraude.
 * SQL explícito: colunas de status podem ser NULL em pontos antigos.
 */
function sqlFotosExpiradas(limite: Date, colunas: Prisma.Sql, limit?: number) {
  const revisao = [...FACE_STATUS_REVISAO] as string[];
  return Prisma.sql`
    SELECT ${colunas} FROM registros_ponto
    WHERE checkin_at < ${limite}
      AND foto_expurgada_em IS NULL
      AND (foto_checkin_caminho IS NOT NULL OR foto_checkout_caminho IS NOT NULL)
      AND COALESCE(face_revisao::text, '') <> 'FRAUDE_SUSPEITA'
      AND COALESCE(face_status::text, '') <> 'PENDENTE'
      AND COALESCE(face_checkout_status::text, '') <> 'PENDENTE'
      AND NOT (face_revisao IS NULL AND offline_revisar)
      AND NOT (
        face_revisao IS NULL AND (
          COALESCE(face_status::text, '') = ANY(${revisao}::text[])
          OR COALESCE(face_checkout_status::text, '') = ANY(${revisao}::text[])
        )
      )
    ${limit ? Prisma.sql`LIMIT ${limit}` : Prisma.empty}`;
}

export async function runPontoFotoRetencaoJob() {
  if (running) return null;
  running = true;
  const ativo = env.PONTO_FOTO_RETENCAO_ATIVA === 'true';
  const dias = Math.max(Number(env.PONTO_FOTO_RETENCAO_DIAS) || 90, 30);
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const resultado = { ativo, registros: 0, arquivos: 0, biometrias: 0 };

  try {
    if (!ativo) {
      const [{ total }] = await prisma.$queryRaw<{ total: number }[]>(
        sqlFotosExpiradas(limite, Prisma.sql`COUNT(*)::int AS total`)
      );
      resultado.registros = total;
      resultado.biometrias = await prisma.medicoBiometriaFacial.count({
        where: WHERE_BIOMETRIA_SEM_VINCULO,
      });
      safeLogger.info(
        `[ponto-foto-retencao] desativado (PONTO_FOTO_RETENCAO_ATIVA!=true): apagaria fotos de ${resultado.registros} ponto(s) e ${resultado.biometrias} biometria(s)`
      );
      return resultado;
    }

    for (;;) {
      const lote = await prisma.$queryRaw<LinhaExpirada[]>(
        sqlFotosExpiradas(limite, Prisma.sql`id, foto_checkin_caminho, foto_checkout_caminho`, LOTE)
      );
      if (lote.length === 0) break;
      for (const r of lote) {
        if (apagarArquivo(r.foto_checkin_caminho)) resultado.arquivos += 1;
        if (apagarArquivo(r.foto_checkout_caminho)) resultado.arquivos += 1;
      }
      await prisma.registroPonto.updateMany({
        where: { id: { in: lote.map((r) => r.id) } },
        data: { fotoCheckinCaminho: null, fotoCheckoutCaminho: null, fotoExpurgadaEm: new Date() },
      });
      resultado.registros += lote.length;
      if (lote.length < LOTE) break;
    }

    const biometrias = await prisma.medicoBiometriaFacial.findMany({
      where: WHERE_BIOMETRIA_SEM_VINCULO,
      select: { id: true, fotoCaminho: true },
    });
    for (const b of biometrias) {
      if (apagarArquivo(b.fotoCaminho)) resultado.arquivos += 1;
    }
    if (biometrias.length > 0) {
      await prisma.medicoBiometriaFacial.deleteMany({ where: { id: { in: biometrias.map((b) => b.id) } } });
    }
    resultado.biometrias = biometrias.length;

    if (resultado.registros > 0 || resultado.biometrias > 0) {
      safeLogger.info(
        `[ponto-foto-retencao] fotos expurgadas: ${resultado.registros} ponto(s), ${resultado.biometrias} biometria(s), ${resultado.arquivos} arquivo(s)`
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    safeLogger.error('[ponto-foto-retencao] job falhou:', msg);
  } finally {
    running = false;
  }
  return resultado;
}

export function startPontoFotoRetencaoJob() {
  if (timer) return;
  setTimeout(() => {
    void runPontoFotoRetencaoJob();
  }, 5 * 60 * 1000);
  timer = setInterval(() => {
    void runPontoFotoRetencaoJob();
  }, INTERVAL_MS);
  safeLogger.info('[ponto-foto-retencao] job agendado (diário)');
}

export function stopPontoFotoRetencaoJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
