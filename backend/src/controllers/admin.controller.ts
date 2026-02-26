import { Request, Response } from 'express';
import {
  alocarMedicoEscalaService,
  createEscalaService,
  createContratoAtivoService,
  createEscalaPlantaoService,
  createMedicoService,
  deleteEscalaService,
  deleteContratoAtivoService,
  getConfigPontoService,
  getValoresPlantaoService,
  inviteMedicoService,
  listEscalaMedicosService,
  listEscalaPlantoesService,
  listEscalasService,
  listRegistrosPontoAdminService,
  listContratosAtivosService,
  listMedicosService,
  removerEscalaPlantaoService,
  removerMedicoEscalaService,
  setConfigPontoService,
  setValorPlantaoService,
  toggleMedicoAtivoService,
  updateEscalaService,
  updateContratoAtivoService,
  updateMedicoService,
} from '../services/admin.service';
import {
  getMatrizAcessosModulosService,
  salvarMatrizAcessosModulosService,
} from '../services/acesso-modulo.service';
import { listSubgruposService } from '../services/grupo-equipe.service';
import { ModuloSistema, UserRole } from '@prisma/client';

export const listMedicosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const search = req.query.search ? String(req.query.search) : undefined;
    const ativo = req.query.ativo === 'true' ? true : req.query.ativo === 'false' ? false : undefined;

    const result = await listMedicosService({
      tenantId: req.user.tenantId,
      page,
      limit,
      search,
      ativo,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar médicos',
    });
  }
};

export const createMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const medico = await createMedicoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      data: medico,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao criar médico',
    });
  }
};

export const updateMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const medico = await updateMedicoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      medicoId: req.params.id,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      data: medico,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar médico',
    });
  }
};

export const toggleMedicoAtivoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Campo "ativo" deve ser boolean',
      });
    }

    const medico = await toggleMedicoAtivoService(
      req.user.tenantId,
      req.user.id,
      req.params.id,
      ativo
    );

    return res.status(200).json({
      success: true,
      data: medico,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao alterar status do médico',
    });
  }
};

export const inviteMedicoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const result = await inviteMedicoService(
      req.user.tenantId,
      req.user.id,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Convite gerado com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao gerar convite',
    });
  }
};

export const listContratosAtivosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await listContratosAtivosService({
      tenantId: req.user.tenantId,
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar contratos ativos',
    });
  }
};

export const createContratoAtivoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const contrato = await createContratoAtivoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      data: contrato,
      message: 'Contrato ativo criado com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao criar contrato ativo',
    });
  }
};

export const updateContratoAtivoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const contrato = await updateContratoAtivoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      contratoId: req.params.id,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      data: contrato,
      message: 'Contrato ativo atualizado com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar contrato ativo',
    });
  }
};

export const deleteContratoAtivoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    await deleteContratoAtivoService(req.user.tenantId, req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Contrato ativo excluído com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao excluir contrato ativo',
    });
  }
};

export const listEscalasController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const result = await listEscalasService({
      tenantId: req.user.tenantId,
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar escalas',
    });
  }
};

export const createEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const escala = await createEscalaService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      data: escala,
      message: 'Escala criada com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao criar escala',
    });
  }
};

export const updateEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const escala = await updateEscalaService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      escalaId: req.params.id,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      data: escala,
      message: 'Escala atualizada com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao atualizar escala',
    });
  }
};

export const deleteEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    await deleteEscalaService(req.user.tenantId, req.user.id, req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Escala excluída com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao excluir escala',
    });
  }
};

export const listEscalaMedicosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const data = await listEscalaMedicosService(req.user.tenantId, req.params.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar alocações da escala',
    });
  }
};

export const alocarMedicoEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const data = await alocarMedicoEscalaService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      escalaId: req.params.id,
      ...req.body,
    });
    return res.status(201).json({ success: true, data, message: 'Médico alocado com sucesso' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao alocar médico na escala',
    });
  }
};

export const removerMedicoEscalaController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    await removerMedicoEscalaService(req.user.tenantId, req.user.id, req.params.id, req.params.medicoId);
    return res.status(200).json({ success: true, message: 'Médico removido da escala' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao remover médico da escala',
    });
  }
};

export const listEscalaPlantoesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const dataInicio = req.query.dataInicio ? String(req.query.dataInicio) : undefined;
    const dataFim = req.query.dataFim ? String(req.query.dataFim) : undefined;
    const data = await listEscalaPlantoesService(req.user.tenantId, req.params.id, { dataInicio, dataFim });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro ao listar plantões da escala';
    if (statusCode === 500) console.error('[listEscalaPlantoes]', error);
    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
};

export const createEscalaPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await createEscalaPlantaoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      escalaId: req.params.id,
      ...req.body,
    });
    return res.status(201).json({ success: true, data, message: 'Plantão atribuído com sucesso' });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro ao atribuir plantão';
    if (statusCode === 500) console.error('[createEscalaPlantao]', error);
    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
};

export const removerEscalaPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    await removerEscalaPlantaoService(req.user.tenantId, req.user.id, req.params.plantaoId);
    return res.status(200).json({ success: true, message: 'Plantão removido' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao remover plantão',
    });
  }
};

export const getValoresPlantaoOpcoesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const tenantId = req.user.tenantId;
    const [contratosResult, subgrupos] = await Promise.all([
      listContratosAtivosService({ tenantId, page: 1, limit: 500 }),
      listSubgruposService(tenantId),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        contratos: contratosResult.items,
        subgrupos: subgrupos.map((s) => ({ id: s.id, nome: s.nome, ativo: s.ativo })),
      },
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar opções',
    });
  }
};

export const getValoresPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const contratoId = (req.query.contratoId as string)?.trim();
    const subgrupoId = (req.query.subgrupoId as string)?.trim();
    if (!contratoId || !subgrupoId) {
      return res.status(400).json({
        success: false,
        error: 'contratoId e subgrupoId são obrigatórios na query',
      });
    }
    const data = await getValoresPlantaoService(
      req.user.tenantId,
      contratoId,
      subgrupoId
    );
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar valores de plantão',
    });
  }
};

export const getConfigPontoOpcoesController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const tenantId = req.user.tenantId;
    const [contratosResult, subgrupos] = await Promise.all([
      listContratosAtivosService({ tenantId, page: 1, limit: 500 }),
      listSubgruposService(tenantId),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        contratos: contratosResult.items,
        subgrupos: subgrupos.map((s) => ({ id: s.id, nome: s.nome, ativo: s.ativo })),
      },
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar opções',
    });
  }
};

export const getConfigPontoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const contratoId = (req.query.contratoId as string)?.trim();
    const subgrupoId = (req.query.subgrupoId as string)?.trim();
    if (!contratoId || !subgrupoId) {
      return res.status(400).json({
        success: false,
        error: 'contratoId e subgrupoId são obrigatórios na query',
      });
    }
    const data = await getConfigPontoService(req.user.tenantId, contratoId, subgrupoId);
    return res.status(200).json({ success: true, data: data ?? null });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar configuração de ponto',
    });
  }
};

export const setConfigPontoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { contratoId, subgrupoId, horasPrevistasMes, valorHora } = req.body;
    if (!contratoId || typeof contratoId !== 'string') {
      return res.status(400).json({ success: false, error: 'contratoId é obrigatório' });
    }
    if (!subgrupoId || typeof subgrupoId !== 'string') {
      return res.status(400).json({ success: false, error: 'subgrupoId é obrigatório' });
    }
    const data = await setConfigPontoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      contratoAtivoId: contratoId.trim(),
      subgrupoId: subgrupoId.trim(),
      horasPrevistasMes: horasPrevistasMes != null ? Number(horasPrevistasMes) : null,
      valorHora: valorHora != null ? Number(valorHora) : null,
    });
    return res.status(200).json({ success: true, data, message: 'Configuração salva' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao salvar configuração de ponto',
    });
  }
};

export const setValorPlantaoController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { contratoId, subgrupoId, gradeId, valorHora } = req.body;
    if (!contratoId || typeof contratoId !== 'string') {
      return res.status(400).json({ success: false, error: 'contratoId é obrigatório' });
    }
    if (!subgrupoId || typeof subgrupoId !== 'string') {
      return res.status(400).json({ success: false, error: 'subgrupoId é obrigatório' });
    }
    if (!gradeId || typeof gradeId !== 'string') {
      return res.status(400).json({ success: false, error: 'gradeId é obrigatório' });
    }
    const data = await setValorPlantaoService({
      tenantId: req.user.tenantId,
      masterId: req.user.id,
      contratoAtivoId: contratoId.trim(),
      subgrupoId: subgrupoId.trim(),
      gradeId: gradeId.trim(),
      valorHora: valorHora != null ? Number(valorHora) : null,
    });
    return res.status(200).json({ success: true, data, message: 'Valor atualizado' });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao salvar valor de plantão',
    });
  }
};

export const listRegistrosPontoAdminController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const data = await listRegistrosPontoAdminService(req.user.tenantId, {
      escalaId: req.query.escalaId ? String(req.query.escalaId) : undefined,
      medicoId: req.query.medicoId ? String(req.query.medicoId) : undefined,
      dataInicio: req.query.dataInicio ? String(req.query.dataInicio) : undefined,
      dataFim: req.query.dataFim ? String(req.query.dataFim) : undefined,
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao listar registros de ponto',
    });
  }
};

export const getMatrizAcessosModulosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const data = await getMatrizAcessosModulosService(req.user.tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao carregar matriz de acesso',
    });
  }
};

export const salvarMatrizAcessosModulosController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }

    const items: unknown[] = Array.isArray(req.body?.items) ? req.body.items : [];
    const payload = items
      .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item: Record<string, unknown>) => ({
        perfil: item.perfil as UserRole,
        modulo: item.modulo as ModuloSistema,
        permitido: Boolean(item.permitido),
      }))
      .filter(
        (item) =>
          Object.values(UserRole).includes(item.perfil) &&
          Object.values(ModuloSistema).includes(item.modulo)
      );

    const data = await salvarMatrizAcessosModulosService(req.user.tenantId, req.user.id, payload);
    return res.status(200).json({
      success: true,
      data,
      message: 'Permissões de módulos atualizadas com sucesso',
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao salvar matriz de acesso',
    });
  }
};
