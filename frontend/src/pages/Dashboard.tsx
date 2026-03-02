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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-viva-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="card col-span-full border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">
          Bem-vindo, {fixMojibake(displayUser?.nomeCompleto)}!
        </h2>
        <p className="text-gray-600">
          {isMaster
            ? 'Sistema de gestão Viva Saúde | Acesso Master'
            : 'Sistema de gestão Viva Saúde | Acesso Profissional'}
        </p>
      </div>

      {temEscalaAtivaParaPonto && (
        <div className="card col-span-full border-l-4 border-viva-500 flex flex-wrap items-center justify-between gap-4">
          <p className="text-viva-900 font-medium">
            Você tem uma escala para <span className="font-bold">{fixMojibake(escalaNome || 'hoje')}</span> às{' '}
            <span className="font-bold">{horaEntrada}</span>.
          </p>
          <Link to="/ponto-eletronico" className="btn btn-primary shrink-0">
            Bater ponto
          </Link>
        </div>
      )}

      {/* Card de Informações */}
      <div className="card hover:shadow-lg transition-shadow">
        <h3 className="text-lg font-bold mb-4 text-viva-800 flex items-center gap-2">
          <span className="w-2 h-2 bg-viva-500 rounded-full"></span>
          Informações Pessoais
        </h3>
        <div className="space-y-4">
          {!isMaster && (displayUser?.profissao || (displayUser?.especialidades?.length ?? 0) > 0) && (
            <div className="bg-viva-100 border border-viva-200 p-3 rounded-lg">
              <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Identificação profissional</p>
              {displayUser?.profissao && (
                <p className="text-lg font-medium text-viva-900 mt-1">
                  <span className="text-viva-700">Profissão:</span> {fixMojibake(displayUser.profissao)}
                </p>
              )}
              {(displayUser?.especialidades?.length ?? 0) > 0 && (
                <p className="text-base font-medium text-viva-900 mt-0.5">
                  <span className="text-viva-700">Especialidades:</span> {fixMojibake(displayUser!.especialidades!.join(', '))}
                </p>
              )}
            </div>
          )}
          {!isMaster && displayUser?.crm && (
            <div className="bg-viva-50 p-3 rounded-lg">
              <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">CRM</p>
              <p className="text-lg font-medium text-viva-900">{formatCRM(displayUser.crm)}</p>
            </div>
          )}
          {!isMaster && (
            <div className="bg-viva-50 p-3 rounded-lg">
              <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Tipo de vínculo</p>
              <p className="text-lg font-medium text-viva-900">
                {displayUser?.vinculo?.toUpperCase() === 'PJ' ? 'PJ' : 'Associado'}
              </p>
            </div>
          )}
          {displayUser?.email && (
            <div className="bg-viva-50 p-3 rounded-lg">
              <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Email de Contato</p>
              <p className="text-lg font-medium text-viva-900">{fixMojibake(displayUser.email)}</p>
            </div>
          )}
          {!isMaster && listaEscalas.length > 0 && (
            <div className="bg-viva-50 p-3 rounded-lg">
              <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Escala(s)</p>
              <p className="text-lg font-medium text-viva-900 mt-1">
                <span className="font-semibold">{fixMojibake(escalaNome ?? '—')}</span>
                <span className="text-viva-700"> · </span>
                <span className="font-semibold">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                <span className="text-viva-700"> · </span>
                <span className="font-semibold">{faixaHorario}</span>
              </p>
              <div className="mt-2 text-center">
                <Link
                  to="/ponto-eletronico"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-viva-700 hover:text-viva-900 hover:underline"
                >
                  Bater ponto
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card de Status */}
      <div className="card hover:shadow-lg transition-shadow">
        <h3 className="text-lg font-bold mb-4 text-viva-800 flex items-center gap-2">
          <span className="w-2 h-2 bg-viva-500 rounded-full"></span>
          Status do Sistema
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600">Status da Conta</p>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200 uppercase">
              Ativo
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600">Último Acesso</p>
            <p className="text-sm text-viva-700 font-bold">Hoje</p>
          </div>
        </div>
      </div>

      {/* Documentos disponíveis (profissional) */}
      {!isMaster && (
        <div className="card col-span-full hover:shadow-lg transition-shadow border-l-4 border-viva-500">
          <h3 className="text-lg font-bold mb-4 text-viva-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-viva-500 rounded-full"></span>
            Documentos
          </h3>
          <p className="text-sm text-viva-600 mb-3">
            Documentos enviados para você. Acesse a área de Documentos para ver todos e visualizar.
          </p>
          <Link to="/documentos" className="btn btn-primary mb-3">
            Ver todos os documentos
          </Link>
          {documentosDisponiveis.length > 0 && (
          <ul className="space-y-2">
            {documentosDisponiveis.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 p-3 bg-viva-50 rounded-lg border border-viva-100">
                <div className="min-w-0">
                  <p className="font-medium text-viva-900 truncate">
                    {doc.titulo || doc.nomeArquivo}
                  </p>
                  {doc.titulo && (
                    <p className="text-xs text-viva-600 truncate">{doc.nomeArquivo}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-primary shrink-0"
                  onClick={() => medicoService.openDocumentoEnviado(doc.id)}
                >
                  Visualizar
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
