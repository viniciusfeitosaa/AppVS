import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { medicoService } from '../services/medico.service';
import { pontoService } from '../services/ponto.service';
import { formatCRM, fixMojibake } from '../utils/validation.util';

/** Extrai a hora no formato "HHh" de "HH:mm" ou "HH:mm:ss". */
const toHoraLabel = (horario: string | null | undefined): string | null => {
  if (!horario) return null;
  const part = String(horario).trim().slice(0, 5);
  if (part.length < 5) return null;
  const [h] = part.split(':');
  return `${h}h`;
};

/** MT = 07h às 19h, SN = 19h às 07h. Apenas horas, sem label MT/SN. Vários turnos unidos com " e ". */
const HORARIOS_POR_GRADE: Record<string, string> = {
  mt: '07h às 19h',
  sn: '19h às 07h',
};

/** Retorna primeiro e segundo nome. */
const primeiroSegundoNome = (nome?: string | null): string => {
  const n = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (n.length === 0) return nome ?? '';
  if (n.length === 1) return n[0];
  return `${n[0]} ${n[1]}`;
};

const formatFaixaEscala = (
  gradeIds: string[] | undefined,
  horarioEntrada: string | null | undefined,
  horarioSaida: string | null | undefined
): string => {
  if (gradeIds && gradeIds.length > 0) {
    const faixas = gradeIds
      .map((g) => HORARIOS_POR_GRADE[g.toLowerCase()])
      .filter(Boolean);
    if (faixas.length > 0) return faixas.join(' e ');
  }
  const entrada = toHoraLabel(horarioEntrada);
  const saida = toHoraLabel(horarioSaida);
  if (entrada && saida) return `${entrada} às ${saida}`;
  return '07h às 19h ou 19h às 07h';
};

const Dashboard = () => {
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
  type EscalaItem = { id?: string; nome?: string; ativo?: boolean; dataInicio?: string; dataFim?: string; gradeIds?: string[] };
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
  const configHorario = meuDiaResp?.data?.configHorario as { horarioEntrada?: string | null; horarioSaida?: string | null } | undefined;
  const faixaHorario = formatFaixaEscala(
    escalaAtiva?.gradeIds,
    configHorario?.horarioEntrada ?? null,
    configHorario?.horarioSaida ?? null
  );
  const horaEntrada = configHorario?.horarioEntrada ? String(configHorario.horarioEntrada).trim().slice(0, 5) : '--:--';
  const temEscalaAtivaParaPonto = isMedico && escalasEmVigor.length > 0;

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

      {temEscalaAtivaParaPonto && (
        <div className="card col-span-full stagger-2 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-viva-500 bg-gradient-to-r from-viva-50/60 to-transparent">
          <p className="text-viva-900 font-medium text-sm">
            Você tem uma escala para <span className="font-bold text-viva-800">{fixMojibake(escalaNome || 'hoje')}</span> às{' '}
            <span className="font-bold text-viva-800">{horaEntrada}</span>.
          </p>
          <Link to="/ponto-eletronico" className="btn btn-primary shrink-0">
            Bater ponto
          </Link>
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
          {!isMaster && listaEscalas.length > 0 && (
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

      {/* Card de Status */}
      <div className="card stagger-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-viva-600 mb-4 font-display">
          Status do Sistema
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-viva-50/60 border border-viva-200/50">
            <p className="text-xs font-medium text-viva-700">Status da Conta</p>
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80">
              Ativo
            </span>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-viva-50/60 border border-viva-200/50">
            <p className="text-xs font-medium text-viva-700">Último Acesso</p>
            <p className="text-xs font-bold text-viva-900">Hoje</p>
          </div>
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
