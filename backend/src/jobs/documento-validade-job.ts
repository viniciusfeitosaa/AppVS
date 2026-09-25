import { StatusCadastroMedico } from '@prisma/client';
import { prisma } from '../config/database';
import {
  DOCUMENTO_LABEL_BY_TIPO,
  DOCUMENTO_TIPOS_COM_VALIDADE,
  DOCUMENTO_VALIDADE_DIAS_ALERTA,
  diasAteValidade,
  formatValidadeEmIsoDate,
  statusValidadeDocumento,
} from '../constants/documentos.const';
import { criarNotificacaoComPush, TIPO_NOTIFICACAO } from '../services/notificacao-medico.service';
import { safeLogger } from '../utils/safe-logger';

const INTERVAL_MS = 6 * 60 * 60 * 1000; // a cada 6h
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

function janelaAlerta(dias: number | null, status: string): string | null {
  if (status === 'VENCIDO') return 'vencido';
  if (status === 'SEM_DATA') return 'sem_data';
  if (dias === null) return null;
  if (dias <= 7) return '7d';
  if (dias <= DOCUMENTO_VALIDADE_DIAS_ALERTA) return '30d';
  return null;
}

async function jaNotificouHoje(
  tenantId: string,
  medicoId: string,
  documentoId: string,
  janela: string
): Promise<boolean> {
  const inicioDia = new Date();
  inicioDia.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.notificacaoMedico.findMany({
    where: {
      tenantId,
      medicoId,
      tipo: TIPO_NOTIFICACAO.DOCUMENTO_VALIDADE,
      createdAt: { gte: inicioDia },
    },
    select: { metadata: true },
    take: 50,
  });
  return rows.some((r) => {
    const meta = r.metadata as { documentoId?: string; janela?: string } | null;
    return meta?.documentoId === documentoId && meta?.janela === janela;
  });
}

/** Varre documentos com validade e notifica médicos (dedupe por dia + janela). */
export async function runDocumentoValidadeAlertJob(): Promise<{ enviados: number }> {
  if (running) return { enviados: 0 };
  running = true;
  let enviados = 0;
  try {
    const docs = await prisma.medicoDocumento.findMany({
      where: {
        tipo: { in: DOCUMENTO_TIPOS_COM_VALIDADE },
        medico: { statusCadastro: StatusCadastroMedico.ATIVO, ativo: true },
      },
      select: {
        id: true,
        tenantId: true,
        medicoId: true,
        tipo: true,
        validadeEm: true,
      },
    });

    for (const doc of docs) {
      const status = statusValidadeDocumento(doc.tipo, doc.validadeEm);
      const dias = doc.validadeEm != null ? diasAteValidade(doc.validadeEm) : null;
      const janela = janelaAlerta(dias, status);
      if (!janela) continue;

      const already = await jaNotificouHoje(doc.tenantId, doc.medicoId, doc.id, janela);
      if (already) continue;

      const label = DOCUMENTO_LABEL_BY_TIPO[doc.tipo];
      let corpo: string;
      if (status === 'VENCIDO') {
        corpo = `O documento "${label}" está vencido. Atualize o ficheiro e a validade em Perfil → Documentos.`;
      } else if (status === 'SEM_DATA') {
        corpo = `Informe a data de validade do documento "${label}" em Perfil → Documentos.`;
      } else {
        corpo = `O documento "${label}" vence em ${dias} dia(s) (${formatValidadeEmIsoDate(doc.validadeEm)}). Renove-o em Perfil → Documentos.`;
      }

      await criarNotificacaoComPush({
        tenantId: doc.tenantId,
        medicoId: doc.medicoId,
        tipo: TIPO_NOTIFICACAO.DOCUMENTO_VALIDADE,
        titulo: 'Documentação — validade',
        corpo,
        metadata: {
          documentoId: doc.id,
          tipo: doc.tipo,
          statusValidade: status,
          janela,
          validadeEm: formatValidadeEmIsoDate(doc.validadeEm),
          origem: 'job',
        },
      });
      enviados += 1;
    }

    if (enviados > 0) {
      safeLogger.info(`[documento-validade] ${enviados} alerta(s) enviado(s)`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    safeLogger.error('[documento-validade] job falhou:', msg);
  } finally {
    running = false;
  }
  return { enviados };
}

export function startDocumentoValidadeJob() {
  if (timer) return;
  // primeira execução após 2 min (dá tempo ao DB)
  setTimeout(() => {
    void runDocumentoValidadeAlertJob();
  }, 2 * 60 * 1000);
  timer = setInterval(() => {
    void runDocumentoValidadeAlertJob();
  }, INTERVAL_MS);
  safeLogger.info('[documento-validade] job agendado (a cada 6h)');
}

export function stopDocumentoValidadeJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
