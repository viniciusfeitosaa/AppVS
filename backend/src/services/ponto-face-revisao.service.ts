import fs from 'fs';
import { prisma } from '../config/database';
import { createAuditLog } from './auditoria.service';
import { FACE_STATUS_REVISAO } from '../utils/face-decisao.util';
import { resolveStoredFileToAbsolute } from '../utils/upload-path.util';

const statusRevisao = [...FACE_STATUS_REVISAO] as any[];

export async function listDivergenciasFaciaisService(
  tenantId: string,
  opts: { revisados: boolean; dias: number }
) {
  const desde = new Date(Date.now() - opts.dias * 24 * 60 * 60 * 1000);
  const rows = await prisma.registroPonto.findMany({
    where: {
      tenantId,
      checkInAt: { gte: desde },
      faceRevisao: opts.revisados ? { not: null } : null,
      OR: [
        { faceStatus: { in: statusRevisao } },
        { faceCheckoutStatus: { in: statusRevisao } },
        { offlineRevisar: true },
      ],
    },
    orderBy: { checkInAt: 'desc' },
    take: 300,
    select: {
      id: true,
      checkInAt: true,
      checkOutAt: true,
      fotoCheckinCaminho: true,
      fotoCheckoutCaminho: true,
      faceStatus: true,
      faceSimilaridade: true,
      faceLiveness: true,
      faceCheckoutStatus: true,
      faceCheckoutSimilaridade: true,
      faceCheckoutLiveness: true,
      faceBiometriaId: true,
      faceRevisao: true,
      faceRevisaoEm: true,
      faceRevisaoObs: true,
      offlineCheckin: true,
      offlineCheckout: true,
      checkinSincronizadoEm: true,
      checkoutSincronizadoEm: true,
      offlineDesvioRelogioMs: true,
      offlineRevisar: true,
      escala: { select: { id: true, nome: true } },
      medico: { select: { id: true, nomeCompleto: true, crm: true } },
    },
  });

  const bioIds = [...new Set(rows.map((r) => r.faceBiometriaId).filter((x): x is string => !!x))];
  const bios = bioIds.length
    ? await prisma.medicoBiometriaFacial.findMany({
        where: { tenantId, id: { in: bioIds } },
        select: { id: true, status: true },
      })
    : [];
  const bioStatus = new Map(bios.map((b) => [b.id, b.status]));

  return rows.map(({ fotoCheckinCaminho, fotoCheckoutCaminho, ...r }) => ({
    ...r,
    faceSimilaridade: r.faceSimilaridade != null ? Number(r.faceSimilaridade) : null,
    faceLiveness: r.faceLiveness != null ? Number(r.faceLiveness) : null,
    faceCheckoutSimilaridade: r.faceCheckoutSimilaridade != null ? Number(r.faceCheckoutSimilaridade) : null,
    faceCheckoutLiveness: r.faceCheckoutLiveness != null ? Number(r.faceCheckoutLiveness) : null,
    temFotoCheckin: !!fotoCheckinCaminho,
    temFotoCheckout: !!fotoCheckoutCaminho,
    biometriaStatus: r.faceBiometriaId ? bioStatus.get(r.faceBiometriaId) ?? null : null,
  }));
}

export async function revisarFacePontoService(
  tenantId: string,
  masterId: string,
  registroId: string,
  decisao: 'CONFIRMADO_MEDICO' | 'FRAUDE_SUSPEITA',
  observacao?: string
) {
  const r = await prisma.registroPonto.findFirst({
    where: { id: registroId, tenantId },
    select: { id: true, medicoId: true },
  });
  if (!r) throw { statusCode: 404, message: 'Registro de ponto não encontrado' };
  if (decisao === 'FRAUDE_SUSPEITA' && !observacao?.trim()) {
    throw { statusCode: 400, message: 'Descreva o motivo da suspeita de fraude.' };
  }
  const atualizado = await prisma.registroPonto.update({
    where: { id: r.id },
    data: {
      faceRevisao: decisao,
      faceRevisaoPorId: masterId,
      faceRevisaoEm: new Date(),
      faceRevisaoObs: observacao?.trim().slice(0, 500) || null,
    },
    select: { id: true, faceRevisao: true, faceRevisaoEm: true, faceRevisaoObs: true },
  });
  await createAuditLog({
    acao: 'PONTO_REVISAO_FACIAL',
    tenantId,
    masterId,
    medicoId: r.medicoId,
    detalhes: { registroPontoId: r.id, decisao },
  });
  return atualizado;
}

export async function getFotoCheckoutRegistroForAdmin(tenantId: string, registroId: string) {
  const r = await prisma.registroPonto.findFirst({
    where: { id: registroId, tenantId },
    select: { fotoCheckoutCaminho: true },
  });
  if (!r?.fotoCheckoutCaminho) throw { statusCode: 404, message: 'Registro sem foto de checkout' };
  const abs = resolveStoredFileToAbsolute(r.fotoCheckoutCaminho);
  if (!fs.existsSync(abs)) throw { statusCode: 404, message: 'Arquivo da foto não encontrado' };
  return abs;
}
