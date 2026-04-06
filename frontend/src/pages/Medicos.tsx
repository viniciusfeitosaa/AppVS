import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/admin.service';
import { notify } from '../lib/notificationEmitter';
import { formatCRM, fixMojibake } from '../utils/validation.util';

/** Chave alinhada com `normalizarEmailDocuseal` no backend (ex.: @gmail → @gmail.com). */
function emailChaveDocuseal(email: string | null | undefined): string {
  let t = (email || '').trim().toLowerCase();
  t = t.replace(/@gmail?$/i, '@gmail.com');
  return t;
}

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'active' | 'inactive';

const Medicos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedMedico, setSelectedMedico] = useState<any | null>(null);
  const [pontoModalOpen, setPontoModalOpen] = useState(false);
  const [pontoInicio, setPontoInicio] = useState('');
  const [pontoFim, setPontoFim] = useState('');
  const [docusealModalMedico, setDocusealModalMedico] = useState<{ id: string; nomeCompleto: string; email: string | null } | null>(
    null
  );

  const ativoParam =
    statusFilter === 'all' ? undefined : statusFilter === 'active';

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'medicos', user?.id, page, search, statusFilter],
    queryFn: () =>
      adminService.listMedicos({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        ativo: ativoParam,
      }),
    enabled: !!user && isMaster,
  });

  const medicos = data?.data || [];

  const emailsPagina = useMemo(
    () => medicos.map((m) => (typeof m.email === 'string' ? m.email.trim() : '')).filter(Boolean),
    [medicos]
  );
  const emailsPaginaKey = useMemo(() => [...emailsPagina].sort().join('|'), [emailsPagina]);

  const { data: docusealResumoResp, isLoading: loadingDocusealResumo } = useQuery({
    queryKey: ['admin', 'docuseal-resumo-emails', user?.id, page, search, statusFilter, emailsPaginaKey],
    queryFn: () => adminService.docusealResumoPorEmails(emailsPagina),
    enabled: !!user && isMaster && !isLoading && emailsPagina.length > 0,
    staleTime: 45 * 1000,
  });

  const { data: painelDocResp, isLoading: loadingPainelDoc } = useQuery({
    queryKey: ['admin', 'medico-docuseal-docs', user?.id, docusealModalMedico?.id],
    queryFn: () => adminService.getMedicoDocusealDocumentos(docusealModalMedico!.id),
    enabled: !!user && isMaster && !!docusealModalMedico?.id,
  });

  const enviarDocusealTplMutation = useMutation({
    mutationFn: ({ medicoId, templateId }: { medicoId: string; templateId: number }) =>
      adminService.enviarDocusealTemplateMedico(medicoId, templateId),
    onSuccess: (resp, vars) => {
      const d = resp?.data;
      if (d && d.created > 0) {
        notify({ kind: 'success', title: 'DocuSeal', message: 'Pedido de assinatura enviado ao profissional.' });
      } else if (d?.errors?.length) {
        notify({ kind: 'warning', title: 'DocuSeal', message: d.errors[0] });
      } else {
        notify({ kind: 'info', title: 'DocuSeal', message: 'Sem novas submissões (verifique a resposta).' });
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'medico-docuseal-docs', user?.id, vars.medicoId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'docuseal-resumo-emails'] });
    },
    onError: (err: unknown) => {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      notify({ kind: 'warning', title: 'DocuSeal', message: msg || 'Não foi possível enviar o pedido de assinatura.' });
    },
  });

  const resendDocusealMutation = useMutation({
    mutationFn: (submitterId: number) => adminService.docusealResendSubmitterEmail(submitterId),
    onSuccess: () => {
      notify({ kind: 'success', title: 'DocuSeal', message: 'Pedido de reenvio de e-mail registado.' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'docuseal-resumo-emails'] });
      if (docusealModalMedico?.id) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'medico-docuseal-docs', user?.id, docusealModalMedico.id] });
      }
    },
    onError: (err: unknown) => {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      notify({ kind: 'warning', title: 'DocuSeal', message: msg || 'Não foi possível reenviar o e-mail.' });
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const { data: registrosPontoResp, isLoading: loadingPontos } = useQuery({
    queryKey: ['admin', 'registros-ponto', selectedMedico?.id, pontoInicio, pontoFim],
    queryFn: () =>
      adminService.listRegistrosPonto({
        medicoId: selectedMedico!.id,
        ...(pontoInicio ? { dataInicio: pontoInicio } : {}),
        ...(pontoFim ? { dataFim: pontoFim } : {}),
      }),
    enabled: !!user && isMaster && pontoModalOpen && !!selectedMedico?.id,
  });
  const registrosPonto: any[] = registrosPontoResp?.data?.data ?? registrosPontoResp?.data ?? [];

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Esta área é exclusiva para o perfil Master.</p>
      </div>
    );
  }

  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const selectedLabel = useMemo(() => {
    if (!selectedMedico) return 'Selecione um profissional';
    const nome = fixMojibake(selectedMedico.nomeCompleto);
    const crm = selectedMedico.crm ? formatCRM(selectedMedico.crm) : '';
    return crm ? `${nome} · ${crm}` : nome;
  }, [selectedMedico]);

  const docusealByEmail = docusealResumoResp?.data?.byEmail;

  function docusealStatusLabel(status: string): string {
    switch (status) {
      case 'nao_enviado':
        return 'Falta enviar o pedido ao profissional';
      case 'pendente_medico':
        return 'Pendente — profissional ainda não assinou';
      case 'pendente_outros':
        return 'Aguarda assinatura da 2.ª parte';
      case 'concluido':
        return 'Concluído';
      default:
        return status;
    }
  }

  return (
    <div className="card hover:shadow-lg transition-shadow">
      <h2 className="text-2xl font-bold text-viva-900 mb-1">Médicos</h2>
      <p className="text-gray-600 mb-6">Lista de profissionais vinculados ao seu tenant.</p>

      <form
        onSubmit={handleSearchSubmit}
        className="mb-6 flex flex-wrap items-center gap-3"
      >
        <div className="flex-1 min-w-[200px] flex flex-wrap items-center gap-2">
          <input
            type="search"
            className="input flex-1 min-w-[180px]"
            placeholder="Pesquisar por nome, CRM ou CPF..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Pesquisar médicos"
          />
          <button type="submit" className="btn btn-primary">
            Pesquisar
          </button>
          {(search || statusFilter !== 'all') && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setStatusFilter('all');
                setPage(1);
              }}
            >
              Limpar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="filter-status" className="text-sm font-medium text-viva-800 whitespace-nowrap">
            Status:
          </label>
          <select
            id="filter-status"
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
          >
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-600">Carregando médicos...</p>
      ) : medicos.length === 0 ? (
        <p className="text-sm text-gray-600">
          {search || statusFilter !== 'all'
            ? 'Nenhum médico encontrado com os filtros aplicados. Tente alterar a pesquisa ou o status.'
            : 'Nenhum médico cadastrado para este tenant.'}
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-viva-200/60 bg-viva-50/50 px-4 py-3">
            <div className="min-w-[220px] flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-viva-600 font-display">Profissional selecionado</p>
              <p className="text-sm font-semibold text-viva-900 font-display truncate">{selectedLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                disabled={!selectedMedico}
                onClick={() => setPontoModalOpen(true)}
              >
                Histórico de pontos
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-viva-700 border-b">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Profissão</th>
                  <th className="py-2 pr-4">CRM</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Especialidades</th>
                  <th className="py-2 pr-4">Vínculo</th>
                  <th className="py-2 pr-4">Status</th>
                  <th
                    className="py-2 pr-4 whitespace-nowrap"
                    title="DocuSeal: estado dos documentos configurados (até vários por profissional). Indica se falta enviar o pedido ou se o profissional ainda não assinou. Clique para ver cada documento e agir pela app."
                  >
                    Documentos / assinatura
                  </th>
                </tr>
              </thead>
              <tbody>
                {medicos.map((medico) => (
                  <tr
                    key={medico.id}
                    className={`border-b last:border-b-0 cursor-pointer ${
                      selectedMedico?.id === medico.id ? 'bg-viva-50/70' : 'hover:bg-viva-50/40'
                    }`}
                    onClick={() => setSelectedMedico(medico)}
                    title="Clique para selecionar"
                  >
                    <td className="py-2 pr-4 font-medium text-viva-900">
                      {fixMojibake(medico.nomeCompleto)}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">{fixMojibake(medico.profissao ?? '-')}</td>
                    <td className="py-2 pr-4 text-gray-700">{formatCRM(medico.crm ?? '')}</td>
                    <td className="py-2 pr-4 text-gray-700">{medico.email || '-'}</td>
                    <td className="py-2 pr-4 text-gray-700">
                      {(medico.especialidades?.length ?? 0) > 0
                        ? fixMojibake(medico.especialidades!.join(', '))
                        : '-'}
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {medico.vinculo?.trim() ? fixMojibake(medico.vinculo) : 'Associado'}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          medico.ativo
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}
                      >
                        {medico.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-2 pr-4" onClick={(e) => e.stopPropagation()}>
                      {isLoading ? (
                        <span className="text-xs text-viva-400">…</span>
                      ) : !docusealResumoResp?.data?.configured ? (
                        <span
                          className="text-xs text-viva-400"
                          title="No servidor: DOCUSEAL_URL (URL público do DocuSeal) + DOCUSEAL_API_KEY (token em Definições → API)."
                        >
                          —
                        </span>
                      ) : docusealResumoResp.data.error ? (
                        <span
                          className="text-xs font-semibold text-amber-800 cursor-help"
                          title={docusealResumoResp.data.error}
                        >
                          Erro
                        </span>
                      ) : !emailChaveDocuseal(medico.email) ? (
                        <span className="text-xs text-viva-500">Sem e-mail</span>
                      ) : loadingDocusealResumo ? (
                        <span className="text-xs text-viva-500">…</span>
                      ) : (
                        (() => {
                          const k = emailChaveDocuseal(medico.email);
                          const pend = k && docusealByEmail ? docusealByEmail[k] ?? [] : [];
                          const acoes = k ? docusealResumoResp?.data?.acoesPorEmail?.[k] : undefined;
                          const open = () =>
                            setDocusealModalMedico({
                              id: medico.id,
                              nomeCompleto: medico.nomeCompleto,
                              email: medico.email ?? null,
                            });
                          if (acoes) {
                            const { pendenteAssinaturaMedico, faltaEnviar, aguardaSegundaParte } = acoes;
                            if (pendenteAssinaturaMedico > 0) {
                              return (
                                <button
                                  type="button"
                                  onClick={open}
                                  title="O profissional ainda não assinou um ou mais documentos. Abra para ver o nome de cada um e reenviar o e-mail ou o link sem sair da app."
                                  className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300/60 rounded-full px-2.5 py-0.5 hover:bg-amber-200/80 transition"
                                >
                                  Não assinou ({pendenteAssinaturaMedico})
                                </button>
                              );
                            }
                            if (faltaEnviar > 0) {
                              return (
                                <button
                                  type="button"
                                  onClick={open}
                                  title="Ainda não foi criado o pedido de assinatura para um ou mais modelos. Abra para enviar ao profissional pela app."
                                  className="text-xs font-bold text-slate-800 bg-slate-200/90 border border-slate-300/70 rounded-full px-2.5 py-0.5 hover:bg-slate-200 transition"
                                >
                                  Falta enviar ({faltaEnviar})
                                </button>
                              );
                            }
                            if (aguardaSegundaParte > 0) {
                              return (
                                <button
                                  type="button"
                                  onClick={open}
                                  title="O profissional já assinou; falta a segunda parte no fluxo DocuSeal."
                                  className="text-xs font-bold text-sky-900 bg-sky-100 border border-sky-300/60 rounded-full px-2.5 py-0.5 hover:bg-sky-200/80 transition"
                                >
                                  Aguarda 2.ª parte ({aguardaSegundaParte})
                                </button>
                              );
                            }
                          }
                          if (pend.length > 0) {
                            return (
                              <button
                                type="button"
                                onClick={open}
                                title="Há assinaturas em falta no DocuSeal para este e-mail (fora da lista de documentos configurados na app)."
                                className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300/60 rounded-full px-2.5 py-0.5 hover:bg-amber-200/80 transition"
                              >
                                Pendente ({pend.length})
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={open}
                              title="Nada a tratar pelos documentos configurados no servidor. Abra para rever os detalhes."
                              className="text-xs font-semibold text-viva-700 bg-viva-100/90 border border-viva-200/80 rounded-full px-2.5 py-0.5 hover:bg-viva-100 transition"
                            >
                              Em dia
                            </button>
                          );
                        })()
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-viva-200 pt-4">
              <p className="text-sm text-viva-700">
                Exibindo <strong>{from}</strong> a <strong>{to}</strong> de <strong>{total}</strong> médicos
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-viva-800 bg-viva-100 hover:bg-viva-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Anterior
                </button>
                <span className="text-sm text-viva-700 px-2">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-viva-800 bg-viva-100 hover:bg-viva-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {docusealModalMedico &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] bg-black/40 overflow-y-auto flex items-start sm:items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="docuseal-modal-title"
            onClick={() => setDocusealModalMedico(null)}
          >
            <div
              className="card w-full max-w-lg border border-viva-200/70 shadow-2xl my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-viva-100 px-4 py-3">
                <div className="min-w-0">
                  <h3 id="docuseal-modal-title" className="text-base font-bold text-viva-900 font-display">
                    Documentos para assinatura (DocuSeal)
                  </h3>
                  <p className="text-xs text-viva-600 font-serif truncate">{fixMojibake(docusealModalMedico.nomeCompleto)}</p>
                  <p className="text-[10px] text-viva-500 truncate">{docusealModalMedico.email || '—'}</p>
                </div>
                <button
                  type="button"
                  className="btn text-sm border border-viva-300 bg-white text-viva-800 shrink-0"
                  onClick={() => setDocusealModalMedico(null)}
                >
                  Fechar
                </button>
              </div>
              <div className="px-4 py-4 max-h-[min(70vh,520px)] overflow-y-auto">
                {loadingPainelDoc ? (
                  <p className="text-sm text-viva-600 font-serif">A carregar documentos…</p>
                ) : (() => {
                  const pd = painelDocResp?.data;
                  if (!pd) {
                    return <p className="text-sm text-viva-600 font-serif">Sem dados.</p>;
                  }
                  if (!pd.configured) {
                    return (
                      <p className="text-sm text-viva-700 font-serif">
                        DocuSeal não está ligado. Defina <code className="text-xs bg-viva-100 px-1 rounded">DOCUSEAL_URL</code> +{' '}
                        <code className="text-xs bg-viva-100 px-1 rounded">DOCUSEAL_API_KEY</code> no servidor.
                      </p>
                    );
                  }
                  if (pd.error) {
                    return <p className="text-sm text-red-700 font-serif">{pd.error}</p>;
                  }
                  if (pd.documentos.length === 0) {
                    return (
                      <p className="text-sm text-viva-700 font-serif">
                        Nenhum documento de assinatura está configurado para este ambiente.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {!pd.inviteFlowOk ? (
                        <p className="text-sm text-amber-900 font-serif bg-amber-50 border border-amber-200/80 rounded-lg p-3">
                          Para usar <strong>Enviar ao profissional</strong>, o servidor precisa da segunda parte do fluxo
                          de assinatura (e-mail e papéis alinhados ao DocuSeal). Até lá pode consultar pedidos já
                          existentes.
                        </p>
                      ) : null}
                      <ul className="space-y-3">
                        {pd.documentos.map((doc) => (
                          <li
                            key={doc.templateId}
                            className="rounded-lg border border-viva-200/60 bg-viva-50/40 p-3 text-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-semibold text-viva-900">{doc.templateName}</p>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                                  doc.status === 'nao_enviado'
                                    ? 'bg-slate-200 text-slate-800'
                                    : doc.status === 'pendente_medico'
                                      ? 'bg-amber-100 text-amber-900'
                                      : doc.status === 'pendente_outros'
                                        ? 'bg-sky-100 text-sky-900'
                                        : 'bg-green-100 text-green-900'
                                }`}
                              >
                                {docusealStatusLabel(doc.status)}
                              </span>
                            </div>
                            {doc.submissionId != null && doc.submissionId > 0 ? (
                              <p className="text-[10px] text-viva-500 mt-0.5">Submissão #{doc.submissionId}</p>
                            ) : null}
                            {doc.signerStatus ? (
                              <p className="text-xs text-viva-600 mt-1">Estado no DocuSeal: {doc.signerStatus}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {doc.status === 'nao_enviado' ? (
                                <button
                                  type="button"
                                  className="btn-sm btn-primary"
                                  disabled={
                                    !pd.inviteFlowOk ||
                                    (enviarDocusealTplMutation.isPending &&
                                      enviarDocusealTplMutation.variables?.templateId === doc.templateId)
                                  }
                                  title={
                                    !pd.inviteFlowOk
                                      ? 'Complete a configuração da segunda parte no servidor para enviar pela app.'
                                      : undefined
                                  }
                                  onClick={() =>
                                    enviarDocusealTplMutation.mutate({
                                      medicoId: docusealModalMedico.id,
                                      templateId: doc.templateId,
                                    })
                                  }
                                >
                                  {enviarDocusealTplMutation.isPending &&
                                  enviarDocusealTplMutation.variables?.templateId === doc.templateId
                                    ? 'A enviar…'
                                    : 'Enviar ao profissional'}
                                </button>
                              ) : null}
                              {doc.status === 'pendente_medico' && doc.signUrl ? (
                                <a
                                  href={doc.signUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-sm btn-secondary inline-flex"
                                >
                                  Abrir assinatura
                                </a>
                              ) : null}
                              {doc.status === 'pendente_medico' ? (
                                <button
                                  type="button"
                                  className="btn-sm btn-primary"
                                  disabled={
                                    resendDocusealMutation.isPending ||
                                    doc.submitterId == null ||
                                    doc.submitterId <= 0
                                  }
                                  onClick={() => {
                                    if (doc.submitterId != null && doc.submitterId > 0) {
                                      resendDocusealMutation.mutate(doc.submitterId);
                                    }
                                  }}
                                >
                                  {resendDocusealMutation.isPending &&
                                  resendDocusealMutation.variables === doc.submitterId
                                    ? 'A enviar…'
                                    : 'Reenviar e-mail'}
                                </button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>,
          document.body
        )}

      {pontoModalOpen &&
        selectedMedico &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/40 overflow-y-auto sm:overflow-hidden flex items-start sm:items-center justify-center"
            role="dialog"
            aria-modal="true"
            onClick={() => setPontoModalOpen(false)}
          >
            <div
              className="card w-full sm:max-w-5xl border border-viva-200/70 shadow-2xl overflow-hidden flex flex-col rounded-none sm:rounded-2xl h-[100svh] sm:h-auto sm:max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-none bg-white/95 backdrop-blur-sm border-b border-viva-100 px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-viva-900 font-display">Histórico de pontos</h3>
                  <p className="text-xs text-viva-600 font-serif truncate">{selectedLabel}</p>
                </div>
                <button
                  type="button"
                  className="btn text-sm border border-viva-300 bg-white text-viva-800"
                  onClick={() => setPontoModalOpen(false)}
                >
                  Fechar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-5">
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-viva-200/60 bg-viva-50/50 p-3">
                  <div className="min-w-[160px]">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-viva-600 font-display mb-1">Início</label>
                    <input type="date" className="input w-full" value={pontoInicio} onChange={(e) => setPontoInicio(e.target.value)} />
                  </div>
                  <div className="min-w-[160px]">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-viva-600 font-display mb-1">Fim</label>
                    <input type="date" className="input w-full" value={pontoFim} onChange={(e) => setPontoFim(e.target.value)} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
                    onClick={() => {
                      setPontoInicio('');
                      setPontoFim('');
                    }}
                  >
                    Limpar
                  </button>
                </div>

                <div className="mt-4">
                  {loadingPontos ? (
                    <p className="text-sm text-viva-700">Carregando registros...</p>
                  ) : registrosPonto.length === 0 ? (
                    <p className="text-sm text-viva-700">Nenhum registro encontrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-viva-700 border-b">
                            <th className="py-2 pr-4">Check-in</th>
                            <th className="py-2 pr-4">Check-out</th>
                            <th className="py-2 pr-4">Duração</th>
                            <th className="py-2 pr-4">Escala</th>
                            <th className="py-2 pr-4">Origem</th>
                            <th className="py-2 pr-4">Foto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrosPonto.map((r) => {
                            const checkIn = r.checkInAt ? new Date(r.checkInAt).toLocaleString('pt-BR') : '—';
                            const checkOut = r.checkOutAt ? new Date(r.checkOutAt).toLocaleString('pt-BR') : '—';
                            const dur = r.duracaoMinutos != null ? `${r.duracaoMinutos} min` : '—';
                            const escalaNome = r.escala?.nome ? fixMojibake(r.escala.nome) : r.escalaId ? 'Escala' : '—';
                          const hasFoto = typeof r.fotoCheckinCaminho === 'string' && r.fotoCheckinCaminho.trim().length > 0;
                            return (
                              <tr key={r.id} className="border-b last:border-b-0">
                                <td className="py-2 pr-4 text-viva-900">{checkIn}</td>
                                <td className="py-2 pr-4 text-viva-900">{checkOut}</td>
                                <td className="py-2 pr-4 text-viva-900">{dur}</td>
                                <td className="py-2 pr-4 text-viva-900">{escalaNome}</td>
                                <td className="py-2 pr-4 text-viva-900">{r.origem ?? '—'}</td>
                                <td className="py-2 pr-4">
                                  {hasFoto ? (
                                    <button
                                      type="button"
                                      className="btn-sm btn-primary"
                                    onClick={async () => {
                                      try {
                                        await adminService.openRegistroPontoFotoCheckin(r.id);
                                      } catch (err: any) {
                                        const status = err?.response?.status;
                                        const msg = err?.response?.data?.error;
                                        notify({
                                          kind: 'warning',
                                          title: 'Foto indisponível',
                                          message:
                                            status === 404
                                              ? 'Este registro não possui foto (ou o arquivo não está mais disponível no servidor).'
                                              : (typeof msg === 'string' && msg.trim()) || 'Não foi possível abrir a foto.',
                                          source: 'admin',
                                        });
                                      }
                                    }}
                                    >
                                      Ver
                                    </button>
                                  ) : (
                                    <span className="text-xs text-viva-600">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Medicos;
