import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { notify } from '../lib/notificationEmitter';
import { medicoService } from '../services/medico.service';
import { PONTO_SEM_ESCALA_ESCALA_ID } from '../constants/ponto';
import { pontoService } from '../services/ponto.service';
import { formatCRM, fixMojibake } from '../utils/validation.util';
import {
  faixaExibicaoPlantao,
  fimPlantaoCliente,
  inicioPlantaoCliente,
  type PlantaoAgendaInput,
} from '../utils/plantao-agenda';

/** Extrai a hora no formato "HHh" de "HH:mm" ou "HH:mm:ss". */
const toHoraLabel = (horario: string | null | undefined): string | null => {
  if (!horario) return null;
  const part = String(horario).trim().slice(0, 5);
  if (part.length < 5) return null;
  const [h] = part.split(':');
  return `${h}h`;
};

/** Limite para troca: até 10 min antes do início do plantão. Após isso o botão some. */
const MINUTOS_ANTES_INICIO_PARA_TROCA = 10;

/** Escala + ponto: link e check-in a partir de 10 min antes do início até o fim do plantão. */
const MINUTOS_ANTES_INICIO_PARA_CHECKIN = 10;

function podeExibirLinkBaterPontoAgenda(dataStr: string, p: PlantaoAgendaInput, at: Date): boolean {
  const inicio = inicioPlantaoCliente(dataStr, p);
  const fim = fimPlantaoCliente(dataStr, p);
  const abertura = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_CHECKIN * 60 * 1000);
  return at.getTime() >= abertura.getTime() && at.getTime() <= fim.getTime();
}

function antesDaAberturaCheckinPonto(dataStr: string, p: PlantaoAgendaInput, at: Date): boolean {
  const inicio = inicioPlantaoCliente(dataStr, p);
  const abertura = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_CHECKIN * 60 * 1000);
  return at.getTime() < abertura.getTime();
}

function mensagemLinkBaterPontoAntesDaJanela(dataStr: string, p: PlantaoAgendaInput): string {
  const inicio = inicioPlantaoCliente(dataStr, p);
  const abertura = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_CHECKIN * 60 * 1000);
  const hm = abertura.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `Ponto disponível a partir das ${hm}.`;
}

function canTrocarPlantaoAgenda(dataStr: string, p: PlantaoAgendaInput): boolean {
  const now = new Date();
  const inicio = inicioPlantaoCliente(dataStr, p);
  const limite = new Date(inicio.getTime() - MINUTOS_ANTES_INICIO_PARA_TROCA * 60 * 1000);
  return now < limite;
}

function isPlantaoAindaFuturoAgenda(dataStr: string, p: PlantaoAgendaInput): boolean {
  const now = new Date();
  const fim = fimPlantaoCliente(dataStr, p);
  return now < fim;
}

/** Formata data para exibição (ex.: "27 fev."). */
function formatDataCurta(dataStr: string): string {
  const d = new Date(dataStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Retorna primeiro e segundo nome. */
const primeiroSegundoNome = (nome?: string | null): string => {
  const n = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (n.length === 0) return nome ?? '';
  if (n.length === 1) return n[0];
  return `${n[0]} ${n[1]}`;
};

const formatFaixaEscala = (
  gradeFaixas: string[] | undefined,
  gradeIds: string[] | undefined,
  horarioEntrada: string | null | undefined,
  horarioSaida: string | null | undefined
): string => {
  if (gradeFaixas && gradeFaixas.length > 0) {
    return gradeFaixas.filter(Boolean).join(' e ');
  }
  if (gradeIds && gradeIds.length > 0) {
    const faixas = gradeIds.map((g) => faixaExibicaoPlantao({ gradeId: g })).filter(Boolean);
    if (faixas.length > 0) return faixas.join(' e ');
  }
  const entrada = toHoraLabel(horarioEntrada);
  const saida = toHoraLabel(horarioSaida);
  if (entrada && saida) return `${entrada} às ${saida}`;
  return '07h às 19h ou 19h às 07h';
};

const Dashboard = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const isMedico = user?.role === 'MEDICO';

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['medico', 'perfil', user?.id],
    queryFn: async () => {
      const response = await medicoService.getPerfil();
      return response.data;
    },
    enabled: !!user && !isMaster,
  });

  const { data: meuDiaResp } = useQuery({
    queryKey: ['ponto', 'meu-dia'],
    queryFn: () => pontoService.getMeuDia(),
    enabled: !!user && isMedico,
  });

  const { data: escalasResp } = useQuery({
    queryKey: ['ponto', 'minhas-escalas'],
    queryFn: () => pontoService.listMinhasEscalas(),
    enabled: !!user && isMedico,
  });

  const { data: docsResp } = useQuery({
    queryKey: ['medico', 'documentos-enviados', user?.id],
    queryFn: () => medicoService.listDocumentosEnviados(),
    enabled: !!user && !isMaster,
  });

  const documentosDisponiveis = docsResp?.data ?? [];
  const displayUser = isMaster ? user : perfil || user;
  const rawEscalas = escalasResp?.data ?? escalasResp;
  const listaEscalas = Array.isArray(rawEscalas) ? rawEscalas : [];
  type EscalaItem = {
    id?: string;
    nome?: string;
    ativo?: boolean;
    dataInicio?: string;
    dataFim?: string;
    gradeIds?: string[];
    gradeFaixas?: string[];
  };
  const escalasEmVigor = listaEscalas.filter((e: EscalaItem) => {
    if (e?.ativo === false) return false;
    const inicio = e?.dataInicio ? new Date(e.dataInicio) : null;
    const fim = e?.dataFim ? new Date(e.dataFim) : null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (inicio && inicio > hoje) return false;
    if (fim) {
      const fimDia = new Date(fim);
      fimDia.setHours(23, 59, 59, 999);
      if (fimDia < hoje) return false;
    }
    return true;
  });
  const escalaAtiva = escalasEmVigor.length > 0 ? (escalasEmVigor[0] as EscalaItem) : (listaEscalas[0] as EscalaItem) ?? null;
  const escalaNome = escalaAtiva?.nome ?? null;
  const minhasEquipes = Array.from(
    new Set(
      [
        ...((meuDiaResp?.data?.minhasEquipes as string[] | undefined) ?? []),
        ...listaEscalas.flatMap((e: any) => (Array.isArray(e?.equipes) ? e.equipes : [])),
      ]
        .map((nome: string) => fixMojibake(String(nome || '').trim()))
        .filter(Boolean)
    )
  );
  const configHorario = meuDiaResp?.data?.configHorario as { horarioEntrada?: string | null; horarioSaida?: string | null } | undefined;
  const faixaHorario = formatFaixaEscala(
    escalaAtiva?.gradeFaixas,
    escalaAtiva?.gradeIds,
    configHorario?.horarioEntrada ?? null,
    configHorario?.horarioSaida ?? null
  );
  const { data: proximosResp } = useQuery({
    queryKey: ['ponto', 'proximos-plantoes'],
    queryFn: () => pontoService.listProximosPlantoes(),
    enabled: !!user && isMedico,
  });
  type PlantaoProximo = PlantaoAgendaInput & {
    id: string;
    data: string;
    gradeId: string;
    escalaId: string;
    escalaNome: string | null;
    permiteTrocaPlantao?: boolean;
    tipoNome?: string | null;
    tipoOrdem?: number | null;
    usaPonto?: boolean;
    usaEscala?: boolean;
  };
  const proximosList = useMemo(() => {
    const raw = (proximosResp?.data ?? proximosResp ?? []) as PlantaoProximo[];
    return [...raw].sort((a, b) => {
      const ta = inicioPlantaoCliente(a.data, a).getTime();
      const tb = inicioPlantaoCliente(b.data, b).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [proximosResp]);
  const proxima = proximosList[0] ?? null;
  const segundaProxima = proximosList[1] ?? null;
  const temProximosPlantoes = proximosList.length > 0;
  const temContratoComEscala =
    (meuDiaResp?.data as { temContratoComEscala?: boolean } | undefined)?.temContratoComEscala !== false;

  const [relogioUi, setRelogioUi] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setRelogioUi(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const [showTrocaModal, setShowTrocaModal] = useState(false);
  const [trocaEscalaId, setTrocaEscalaId] = useState<string | null>(null);
  const [trocaPlantaoId, setTrocaPlantaoId] = useState<string | null>(null);
  const [trocaStep, setTrocaStep] = useState<1 | 2>(1);
  const [selectedColegaId, setSelectedColegaId] = useState<string | null>(null);

  const resetTrocaModal = () => {
    setShowTrocaModal(false);
    setTrocaStep(1);
    setSelectedColegaId(null);
    setTrocaEscalaId(null);
    setTrocaPlantaoId(null);
  };

  const trocaMutation = useMutation({
    mutationFn: () =>
      pontoService.solicitarTrocaPlantao({
        plantaoId: trocaPlantaoId!,
        medicoDestinoId: selectedColegaId!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medico', 'notificacoes'] });
      resetTrocaModal();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      notify({
        kind: 'error',
        title: 'Não foi possível',
        message: msg ?? 'Tente novamente.',
        source: 'ponto',
      });
    },
  });

  const { data: colegasResp } = useQuery({
    queryKey: ['ponto', 'equipe-colegas', trocaEscalaId],
    queryFn: () => pontoService.listEquipeColegas(trocaEscalaId!),
    enabled: !!user && isMedico && showTrocaModal && !!trocaEscalaId,
  });
  const colegasList = (colegasResp?.data ?? colegasResp ?? []) as Array<{ id: string; nomeCompleto: string; crm?: string | null }>;
  const selectedColega = selectedColegaId ? colegasList.find((c) => c.id === selectedColegaId) : null;

  const faixaPorPlantao = (p: PlantaoProximo | null) =>
    p ? faixaExibicaoPlantao(p) : '07h às 19h';

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-viva-200 border-t-viva-600 mx-auto" />
          <p className="mt-4 text-viva-700 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Hero */}
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600 mb-2 font-display">
          {isMaster ? 'Acesso Master' : 'Acesso Profissional'}
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-viva-900 font-display leading-tight mb-2">
          Bem-vindo, {fixMojibake(primeiroSegundoNome(displayUser?.nomeCompleto))}!
        </h1>
        <p className="text-viva-700 font-serif text-base">
          Sistema de gestão Viva Saúde
        </p>
      </div>

      {isMedico && !isMaster && temContratoComEscala && (temProximosPlantoes || listaEscalas.length > 0) && (
        <div className="col-span-full stagger-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-semibold text-viva-800 font-display">Suas próximas escalas</h2>
            <Link
              to="/meu-calendario-plantoes"
              className="btn btn-secondary text-xs sm:text-sm shrink-0"
            >
              Calendário de escalas
            </Link>
          </div>
          {!temProximosPlantoes && (
            <p className="text-xs text-viva-600 px-1 font-serif leading-relaxed">
              Não há plantões futuros em destaque. Abra o calendário para ver todas as suas alocações por mês.
            </p>
          )}
          {/* Próxima escala */}
          {proxima && (
            <div className="card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-viva-500 bg-gradient-to-r from-viva-50/60 to-transparent">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-viva-600 mb-0.5">Próxima escala</p>
                <p className="text-viva-900 font-medium text-sm">
                  Você tem escala para <span className="font-bold text-viva-800">{fixMojibake(proxima.escalaNome || 'Escala')}</span> no dia{' '}
                  <span className="font-bold text-viva-800">{formatDataCurta(proxima.data)}</span> no horário{' '}
                  <span className="font-bold text-viva-800">{faixaPorPlantao(proxima)}</span>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {proxima.permiteTrocaPlantao === false
                  ? null
                  : canTrocarPlantaoAgenda(proxima.data, proxima)
                    ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTrocaEscalaId(proxima.escalaId);
                            setTrocaPlantaoId(proxima.id);
                            setShowTrocaModal(true);
                            setTrocaStep(1);
                            setSelectedColegaId(null);
                          }}
                          className="btn btn-secondary text-sm"
                        >
                          Trocar plantão
                        </button>
                      )
                    : (
                        <span className="text-xs text-viva-600 max-w-[14rem]">
                          {isPlantaoAindaFuturoAgenda(proxima.data, proxima)
                            ? 'Período de troca encerrado'
                            : 'Plantão já passou'}
                        </span>
                      )}
                {proxima.usaPonto === false ? (
                  <span className="text-xs text-viva-600 max-w-[14rem] text-right">
                    Ponto eletrônico não está habilitado para esta escala.
                  </span>
                ) : proxima.usaEscala === false ? (
                  <Link to="/ponto-eletronico" className="btn btn-primary text-sm">
                    Bater ponto
                  </Link>
                ) : podeExibirLinkBaterPontoAgenda(proxima.data, proxima, relogioUi) ? (
                  <Link to="/ponto-eletronico" className="btn btn-primary text-sm">
                    Bater ponto
                  </Link>
                ) : antesDaAberturaCheckinPonto(proxima.data, proxima, relogioUi) ? (
                  <span className="text-xs text-viva-600 max-w-[14rem] text-right leading-snug">
                    {mensagemLinkBaterPontoAntesDaJanela(proxima.data, proxima)}
                  </span>
                ) : null}
              </div>
            </div>
          )}
          {/* Segunda próxima escala */}
          {segundaProxima && (
            <div className="card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-viva-400/80 bg-gradient-to-r from-viva-50/40 to-transparent">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-viva-600 mb-0.5">Segunda próxima</p>
                <p className="text-viva-900 font-medium text-sm">
                  Você tem escala para <span className="font-bold text-viva-800">{fixMojibake(segundaProxima.escalaNome || 'Escala')}</span> no dia{' '}
                  <span className="font-bold text-viva-800">{formatDataCurta(segundaProxima.data)}</span> no horário{' '}
                  <span className="font-bold text-viva-800">{faixaPorPlantao(segundaProxima)}</span>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {segundaProxima.permiteTrocaPlantao === false
                  ? null
                  : canTrocarPlantaoAgenda(segundaProxima.data, segundaProxima)
                    ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTrocaEscalaId(segundaProxima.escalaId);
                            setTrocaPlantaoId(segundaProxima.id);
                            setShowTrocaModal(true);
                            setTrocaStep(1);
                            setSelectedColegaId(null);
                          }}
                          className="btn btn-secondary text-sm"
                        >
                          Trocar plantão
                        </button>
                      )
                    : (
                        <span className="text-xs text-viva-600 max-w-[14rem]">
                          {isPlantaoAindaFuturoAgenda(segundaProxima.data, segundaProxima)
                            ? 'Período de troca encerrado'
                            : 'Plantão já passou'}
                        </span>
                      )}
                {segundaProxima.usaPonto === false ? (
                  <span className="text-xs text-viva-600 max-w-[14rem] text-right">
                    Ponto eletrônico não está habilitado para esta escala.
                  </span>
                ) : segundaProxima.usaEscala === false ? (
                  <Link to="/ponto-eletronico" className="btn btn-primary text-sm">
                    Bater ponto
                  </Link>
                ) : podeExibirLinkBaterPontoAgenda(segundaProxima.data, segundaProxima, relogioUi) ? (
                  <Link to="/ponto-eletronico" className="btn btn-primary text-sm">
                    Bater ponto
                  </Link>
                ) : antesDaAberturaCheckinPonto(segundaProxima.data, segundaProxima, relogioUi) ? (
                  <span className="text-xs text-viva-600 max-w-[14rem] text-right leading-snug">
                    {mensagemLinkBaterPontoAntesDaJanela(segundaProxima.data, segundaProxima)}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fallback: tem escala ativa mas nenhum plantão futuro (ex.: escala sem grade definida) */}
      {isMedico &&
        temContratoComEscala &&
        escalasEmVigor.some((e: EscalaItem) => e?.id && e.id !== PONTO_SEM_ESCALA_ESCALA_ID) &&
        !temProximosPlantoes && (
        <div className="card col-span-full stagger-2 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-viva-500 bg-gradient-to-r from-viva-50/60 to-transparent">
          <p className="text-viva-900 font-medium text-sm">
            Escala cadastrada:{' '}
            <span className="font-bold text-viva-800">{fixMojibake(escalaNome || '—')}</span>
          </p>
        </div>
      )}

      {/* Modal Trocar plantão */}
      {showTrocaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={resetTrocaModal}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-viva-900 font-display">
              {trocaStep === 1 ? 'Trocar plantão' : 'Confirmar troca'}
            </h3>
            {trocaStep === 1 ? (
              <>
                <p className="text-sm text-viva-700">Com qual profissional da equipe você deseja trocar?</p>
                <select
                  value={selectedColegaId ?? ''}
                  onChange={(e) => setSelectedColegaId(e.target.value || null)}
                  className="input w-full py-2"
                >
                  <option value="">Selecione um profissional</option>
                  {colegasList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {fixMojibake(c.nomeCompleto)}
                      {c.crm ? ` — ${c.crm}` : ''}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-secondary" onClick={resetTrocaModal}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!selectedColegaId}
                    onClick={() => setTrocaStep(2)}
                  >
                    Confirmar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-viva-700">
                  Deseja confirmar a troca de plantão com <strong>{selectedColega ? fixMojibake(selectedColega.nomeCompleto) : '—'}?</strong>
                </p>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-secondary" onClick={() => setTrocaStep(1)}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={trocaMutation.isPending || !trocaPlantaoId || !selectedColegaId}
                    onClick={() => trocaMutation.mutate()}
                  >
                    {trocaMutation.isPending ? 'Enviando…' : 'Confirmar troca'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Acesso rápido Master */}
      {isMaster && (
        <div className="card col-span-full stagger-2 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-viva-500 bg-gradient-to-r from-viva-50/60 to-transparent">
          <p className="text-viva-900 font-medium text-sm font-display">
            Acesso rápido às áreas de gestão
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/escalas" className="btn-sm btn-primary">Escalas</Link>
            <Link to="/medicos" className="btn-sm btn-primary">Médicos</Link>
            <Link to="/relatorios" className="btn-sm btn-primary">Relatórios</Link>
          </div>
        </div>
      )}

      {/* Card de Informações */}
      <div className="card stagger-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-viva-600 mb-4 font-display">
          Informações Pessoais
        </h3>
        <div className="space-y-3">
          {!isMaster && (displayUser?.profissao || (displayUser?.especialidades?.length ?? 0) > 0) && (
            <div className="rounded-xl bg-viva-100/80 border border-viva-200/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-viva-600">Identificação profissional</p>
              {displayUser?.profissao && (
                <p className="text-sm font-semibold text-viva-900 mt-1 font-display">
                  {fixMojibake(displayUser.profissao)}
                </p>
              )}
              {(displayUser?.especialidades?.length ?? 0) > 0 && (
                <p className="text-xs text-viva-800 mt-0.5 font-serif">
                  {fixMojibake(displayUser!.especialidades!.join(', '))}
                </p>
              )}
            </div>
          )}
          {!isMaster && displayUser?.crm && (
            <div className="rounded-xl bg-viva-50/80 border border-viva-200/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-viva-600">CRM</p>
              <p className="text-sm font-semibold text-viva-900 mt-0.5 font-display">{formatCRM(displayUser.crm)}</p>
            </div>
          )}
          {!isMaster && (
            <div className="rounded-xl bg-viva-50/80 border border-viva-200/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-viva-600">Tipo de vínculo</p>
              <p className="text-sm font-semibold text-viva-900 mt-0.5">
                {displayUser?.vinculo?.toUpperCase() === 'PJ' ? 'PJ' : 'Associado'}
              </p>
            </div>
          )}
          {!isMaster && (
            <div className="rounded-xl bg-viva-50/80 border border-viva-200/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-viva-600">Equipes vinculadas</p>
              {minhasEquipes.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {minhasEquipes.map((nome) => (
                    <span
                      key={nome}
                      className="inline-flex items-center rounded-full border border-viva-200 bg-white px-2.5 py-1 text-[11px] font-medium text-viva-800"
                    >
                      {nome}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-viva-700 mt-1 font-serif">Sem equipe vinculada no momento.</p>
              )}
            </div>
          )}
          {isMaster && (
            <>
              <div className="rounded-xl bg-viva-100/80 border border-viva-200/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-viva-600 font-display">Perfil</p>
                <p className="text-sm font-semibold text-viva-900 mt-1 font-display">Administrador Master</p>
              </div>
              {displayUser?.email && (
                <div className="rounded-xl bg-viva-50/80 border border-viva-200/50 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-viva-600 font-display">Email de contato</p>
                  <p className="text-sm font-medium text-viva-900 mt-0.5 break-all font-display">{fixMojibake(displayUser.email)}</p>
                </div>
              )}
            </>
          )}
          {false && !isMaster && listaEscalas.length > 0 && (
            <div className="rounded-xl bg-viva-50/80 border border-viva-200/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-viva-600">Escala(s)</p>
              <p className="text-xs font-medium text-viva-900 mt-1 leading-snug">
                <span className="font-semibold">{fixMojibake(escalaNome ?? '—')}</span>
                <span className="text-viva-600"> · </span>
                <span className="font-medium">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                <span className="text-viva-600"> · </span>
                <span className="font-medium">{faixaHorario}</span>
              </p>
              <div className="mt-3">
                <Link
                  to="/ponto-eletronico"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-viva-700 hover:text-viva-900 transition"
                >
                  Bater ponto
                  <span aria-hidden className="text-viva-500">→</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documentos disponíveis (profissional) */}
      {!isMaster && (
        <div className="card col-span-full stagger-5 border-l-4 border-l-viva-500 bg-gradient-to-br from-white to-viva-50/30">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-viva-800 font-display">
                Documentos enviados para você
              </h3>
              <p className="text-xs text-viva-600 mt-1 font-serif max-w-xl">
                Acesse a área de Documentos para ver todos e visualizar.
              </p>
            </div>
            <Link
              to="/documentos"
              className="btn-sm btn-primary shrink-0 inline-flex items-center gap-1.5"
            >
              Ver todos
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          {documentosDisponiveis.length > 0 && (
            <ul className="space-y-1 rounded-xl overflow-hidden">
              {documentosDisponiveis.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-viva-50/50 hover:bg-viva-100/50 active:bg-viva-100/80 border border-viva-200/40 transition text-left cursor-pointer"
                    onClick={() => medicoService.openDocumentoEnviado(doc.id, doc.nomeArquivo)}
                  >
                    <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-viva-200/50 flex items-center justify-center text-viva-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-viva-900 truncate text-xs font-display">
                        {doc.titulo || doc.nomeArquivo}
                      </p>
                      {doc.titulo && (
                        <p className="text-[10px] text-viva-600 truncate mt-0.5">{doc.nomeArquivo}</p>
                      )}
                    </div>
                    <span className="btn-sm btn-primary shrink-0 pointer-events-none">Visualizar</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
