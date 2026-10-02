import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';
import env from '../config/env';
import { createAuditLog } from './auditoria.service';
import {
  faceEnroll,
  faceServiceConfigurado,
  FaceServiceUnavailableError,
  faceVerify,
  type FaceEnrollResult,
} from './face-client.service';
import { decidirFaceStatus, mensagemMotivoCadastroFace } from '../utils/face-decisao.util';
import { assertFileIsAllowedImage } from '../utils/image-magic-bytes.util';
import { resolveStoredFileToAbsolute, toStoredUploadPath } from '../utils/upload-path.util';

export type OrigemBiometria = 'PRIMEIRO_PONTO' | 'CADASTRO_PUBLICO' | 'MASTER' | 'RECADASTRO';

const selectResumo = {
  id: true,
  status: true,
  origem: true,
  livenessScore: true,
  qualidade: true,
  motivoRejeicao: true,
  revisadoEm: true,
  createdAt: true,
} as const;

/** Biometria usada na comparação: a ativa mais recente que não foi rejeitada. */
export async function getBiometriaAtivaParaComparacao(tenantId: string, medicoId: string) {
  return prisma.medicoBiometriaFacial.findFirst({
    where: { tenantId, medicoId, ativa: true, status: { not: 'REJEITADA' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, embedding: true, modelo: true, fotoCaminho: true },
  });
}

export async function getMinhaBiometriaService(tenantId: string, medicoId: string) {
  const ultima = await prisma.medicoBiometriaFacial.findFirst({
    where: { tenantId, medicoId, ativa: true },
    orderBy: { createdAt: 'desc' },
    select: selectResumo,
  });
  return {
    habilitado: faceServiceConfigurado(),
    consentimentoVersao: env.FACE_CONSENTIMENTO_VERSAO,
    biometria: ultima,
    precisaCadastrar: !ultima || ultima.status === 'REJEITADA',
  };
}

export type ResultadoConferenciaRosto = 'CONFERE' | 'NAO_CONFERE' | 'SEM_ROSTO' | 'SPOOF_SUSPEITO' | 'INDISPONIVEL';

const MENSAGEM_CONFERENCIA: Record<ResultadoConferenciaRosto, string> = {
  CONFERE: 'Rosto reconhecido.',
  NAO_CONFERE: 'Não conseguimos confirmar que é você. Tire a foto com o rosto descoberto, de frente e com boa luz.',
  SEM_ROSTO: 'Não encontramos seu rosto na foto. Descubra o rosto e centralize-o na moldura.',
  SPOOF_SUSPEITO: 'A foto parece ter sido tirada de uma tela ou papel. Use seu rosto real na câmera frontal.',
  INDISPONIVEL: 'Não foi possível conferir o rosto agora.',
};

/**
 * Conferência imediata antes do registro, só para orientar o médico (sem scores).
 * A foto é descartada; o resultado oficial continua vindo da fila após o registro.
 */
export async function conferirRostoService(tenantId: string, medicoId: string, fotoAbs: string) {
  try {
    const biometria = await getBiometriaAtivaParaComparacao(tenantId, medicoId);
    if (!faceServiceConfigurado() || !biometria?.embedding?.length) {
      return { resultado: null, mensagem: null };
    }
    let resultado: ResultadoConferenciaRosto;
    try {
      await assertFileIsAllowedImage(fotoAbs);
      const r = await faceVerify(fotoAbs, biometria.embedding, biometria.modelo);
      const status = decidirFaceStatus(r, {
        match: Number(env.FACE_MATCH_THRESHOLD),
        review: Number(env.FACE_REVIEW_THRESHOLD),
        liveness: Number(env.FACE_LIVENESS_THRESHOLD),
      });
      resultado =
        status === 'CONFERE' || status === 'SEM_ROSTO' || status === 'SPOOF_SUSPEITO' ? status : 'NAO_CONFERE';
    } catch {
      resultado = 'INDISPONIVEL';
    }
    return { resultado, mensagem: MENSAGEM_CONFERENCIA[resultado] };
  } finally {
    fs.unlink(fotoAbs, () => {});
  }
}

export async function cadastrarBiometriaService(params: {
  tenantId: string;
  medicoId: string;
  fotoAbs: string;
  origem: OrigemBiometria;
  consentimentoVersao: string;
  masterId?: string;
}) {
  const { tenantId, medicoId, fotoAbs, origem, consentimentoVersao, masterId } = params;
  const descartar = () => fs.unlink(fotoAbs, () => {});

  if (consentimentoVersao !== env.FACE_CONSENTIMENTO_VERSAO) {
    descartar();
    throw { statusCode: 400, message: 'Aceite o termo de consentimento atual para cadastrar a biometria.' };
  }

  let r;
  try {
    r = await faceEnroll(fotoAbs);
  } catch (e) {
    descartar();
    if (e instanceof FaceServiceUnavailableError) {
      throw { statusCode: 503, message: 'Reconhecimento facial indisponível no momento. Tente novamente em instantes.' };
    }
    throw e;
  }

  if (!r.ok || !r.embedding) {
    descartar();
    throw { statusCode: 422, message: mensagemMotivoCadastroFace(r.motivo), motivo: r.motivo };
  }

  return salvarBiometriaService({ tenantId, medicoId, fotoAbs, enroll: r, origem, consentimentoVersao, masterId });
}

/** Grava a biometria a partir de um enroll já aprovado pelo face-service; desativa a anterior. */
export async function salvarBiometriaService(params: {
  tenantId: string;
  medicoId: string;
  fotoAbs: string;
  enroll: FaceEnrollResult;
  origem: OrigemBiometria;
  consentimentoVersao: string;
  masterId?: string;
}) {
  const { tenantId, medicoId, fotoAbs, enroll: r, origem, consentimentoVersao, masterId } = params;
  if (!r.ok || !r.embedding) throw new Error('Enroll sem embedding');
  const fotoCaminho = toStoredUploadPath(fotoAbs);
  const criada = await prisma.$transaction(async (tx: any) => {
    await tx.medicoBiometriaFacial.updateMany({
      where: { tenantId, medicoId, ativa: true },
      data: { ativa: false },
    });
    return tx.medicoBiometriaFacial.create({
      data: {
        tenantId,
        medicoId,
        status: masterId ? 'APROVADA' : 'PENDENTE_APROVACAO',
        fotoCaminho,
        embedding: r.embedding,
        modelo: r.modelo,
        livenessScore: r.liveness?.score ?? null,
        qualidade: r.quality ?? undefined,
        origem,
        consentimentoEm: new Date(),
        consentimentoVersao,
        ...(masterId ? { revisadoPorId: masterId, revisadoEm: new Date() } : {}),
      },
      select: selectResumo,
    });
  });

  await createAuditLog({
    acao: 'BIOMETRIA_FACIAL_CADASTRADA',
    tenantId,
    medicoId,
    masterId,
    detalhes: { biometriaId: criada.id, origem, liveness: r.liveness?.score ?? null },
  });
  return criada;
}

export async function listBiometriasService(tenantId: string, status?: string) {
  const where: Record<string, unknown> = { tenantId, ativa: true };
  if (status) where.status = status;
  return prisma.medicoBiometriaFacial.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      ...selectResumo,
      medico: { select: { id: true, nomeCompleto: true, crm: true, cpf: true } },
    },
  });
}

export async function revisarBiometriaService(
  tenantId: string,
  masterId: string,
  biometriaId: string,
  decisao: 'APROVADA' | 'REJEITADA',
  motivo?: string
) {
  const b = await prisma.medicoBiometriaFacial.findFirst({
    where: { id: biometriaId, tenantId, ativa: true },
    select: { id: true, medicoId: true },
  });
  if (!b) throw { statusCode: 404, message: 'Biometria não encontrada' };
  if (decisao === 'REJEITADA' && !motivo?.trim()) {
    throw { statusCode: 400, message: 'Informe o motivo da rejeição (o profissional verá esta mensagem).' };
  }

  const atualizada = await prisma.medicoBiometriaFacial.update({
    where: { id: b.id },
    data: {
      status: decisao,
      revisadoPorId: masterId,
      revisadoEm: new Date(),
      motivoRejeicao: decisao === 'REJEITADA' ? motivo!.trim().slice(0, 500) : null,
    },
    select: selectResumo,
  });

  await createAuditLog({
    acao: decisao === 'APROVADA' ? 'BIOMETRIA_FACIAL_APROVADA' : 'BIOMETRIA_FACIAL_REJEITADA',
    tenantId,
    masterId,
    medicoId: b.medicoId,
    detalhes: { biometriaId: b.id },
  });

  if (decisao === 'REJEITADA') {
    try {
      const { criarNotificacaoComPush, TIPO_NOTIFICACAO } = await import('./notificacao-medico.service');
      await criarNotificacaoComPush({
        tenantId,
        medicoId: b.medicoId,
        tipo: TIPO_NOTIFICACAO.BIOMETRIA_FACIAL_REJEITADA,
        titulo: 'Refaça sua foto de reconhecimento facial',
        corpo: `Sua foto de referência não foi aprovada: ${motivo!.trim()}. Ao bater o próximo ponto, tire uma nova foto.`,
      });
    } catch (e) {
      console.warn('[biometria] notificação de rejeição falhou:', (e as Error)?.message ?? e);
    }
  }
  return atualizada;
}

export async function getFotoBiometriaService(tenantId: string, biometriaId: string, medicoId?: string) {
  const b = await prisma.medicoBiometriaFacial.findFirst({
    where: { id: biometriaId, tenantId, ...(medicoId ? { medicoId } : {}) },
    select: { fotoCaminho: true },
  });
  if (!b) throw { statusCode: 404, message: 'Biometria não encontrada' };
  const abs = resolveStoredFileToAbsolute(b.fotoCaminho);
  if (!fs.existsSync(abs)) throw { statusCode: 404, message: 'Arquivo da biometria não encontrado' };
  return abs;
}

/**
 * Selfie do cadastro público, validada antes de criar o médico.
 * Foto ruim → 422 (refaz na hora). Serviço fora/consentimento ausente → null: o cadastro segue
 * sem biometria e ela é pedida no primeiro ponto.
 */
export async function validarSelfieCadastroPublico(
  fotoAbs: string,
  consentiu: boolean,
  consentimentoVersao: string | undefined
): Promise<FaceEnrollResult | null> {
  const descartar = () => fs.unlink(fotoAbs, () => {});
  if (!consentiu || consentimentoVersao !== env.FACE_CONSENTIMENTO_VERSAO || !faceServiceConfigurado()) {
    descartar();
    return null;
  }
  try {
    if (fs.statSync(fotoAbs).size > 5 * 1024 * 1024) throw new Error('grande');
    await assertFileIsAllowedImage(fotoAbs);
  } catch {
    descartar();
    throw { statusCode: 400, message: 'Selfie: use uma imagem JPEG, PNG ou WebP de até 5 MB.' };
  }
  let r: FaceEnrollResult;
  try {
    r = await faceEnroll(fotoAbs);
  } catch (e) {
    descartar();
    if (e instanceof FaceServiceUnavailableError) return null;
    throw e;
  }
  if (!r.ok || !r.embedding) {
    descartar();
    throw { statusCode: 422, message: `Selfie: ${mensagemMotivoCadastroFace(r.motivo)}` };
  }
  return r;
}

export async function anexarSelfieCadastroPublico(params: {
  tenantId: string;
  medicoId: string;
  fotoAbs: string;
  enroll: FaceEnrollResult;
}) {
  const { tenantId, medicoId, fotoAbs, enroll } = params;
  try {
    const dir = path.resolve(process.cwd(), 'uploads', 'biometria', tenantId);
    fs.mkdirSync(dir, { recursive: true });
    const destino = path.join(dir, `biometria-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(fotoAbs) || '.jpg'}`);
    fs.renameSync(fotoAbs, destino);
    return await salvarBiometriaService({
      tenantId,
      medicoId,
      fotoAbs: destino,
      enroll,
      origem: 'CADASTRO_PUBLICO',
      consentimentoVersao: env.FACE_CONSENTIMENTO_VERSAO,
    });
  } catch (e) {
    fs.unlink(fotoAbs, () => {});
    console.warn('[biometria] selfie do cadastro público não foi salva:', (e as Error)?.message ?? e);
    return null;
  }
}

/** Aprovar o cadastro aprova junto a selfie pendente (o Master já a viu na Avaliação). */
export async function aprovarBiometriaPendenteDoCadastro(tenantId: string, medicoId: string, masterId: string) {
  await prisma.medicoBiometriaFacial.updateMany({
    where: { tenantId, medicoId, ativa: true, status: 'PENDENTE_APROVACAO', origem: 'CADASTRO_PUBLICO' },
    data: { status: 'APROVADA', revisadoPorId: masterId, revisadoEm: new Date() },
  });
}

/** Dado biométrico de quem não terá vínculo (cadastro rejeitado): apaga foto e embedding na hora. */
export async function excluirBiometriasDoMedico(tenantId: string, medicoId: string) {
  const lista = await prisma.medicoBiometriaFacial.findMany({
    where: { tenantId, medicoId },
    select: { id: true, fotoCaminho: true },
  });
  for (const b of lista) {
    try {
      fs.unlinkSync(resolveStoredFileToAbsolute(b.fotoCaminho));
    } catch {
      // arquivo já ausente
    }
  }
  if (lista.length > 0) {
    await prisma.medicoBiometriaFacial.deleteMany({ where: { id: { in: lista.map((b) => b.id) } } });
  }
}
