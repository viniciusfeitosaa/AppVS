import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import {
  adminService,
  type CadastroPendenteDetalhe,
  type CadastroPendenteDocumento,
  type CadastroPendenteListItem,
} from '../services/admin.service';
import {
  DOCUMENTO_LABEL_BY_FIELD,
  DOCUMENTO_TIPO_BY_FIELD,
  type DocumentoPerfilField,
} from '../constants/documentosPerfil';

function labelDocumentoTipo(tipo: string): string {
  const entry = Object.entries(DOCUMENTO_TIPO_BY_FIELD).find(([, v]) => v === tipo);
  if (entry) return DOCUMENTO_LABEL_BY_FIELD[entry[0] as DocumentoPerfilField];
  return tipo;
}

function triggerBlobDownload(blob: Blob, nomeArquivo: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo || 'documento';
  a.click();
  window.URL.revokeObjectURL(url);
}

function statusBadge(status: CadastroPendenteDocumento['statusRevisao']) {
  const s = status || 'PENDENTE';
  if (s === 'OK') {
    return (
      <span className="mt-1 inline-block text-[11px] font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
        OK
      </span>
    );
  }
  if (s === 'SOLICITADO') {
    return (
      <span className="mt-1 inline-block text-[11px] font-semibold px-2 py-0.5 rounded border bg-amber-50 text-amber-900 border-amber-200">
        Solicitado
      </span>
    );
  }
  return (
    <span className="mt-1 inline-block text-[11px] font-semibold px-2 py-0.5 rounded border bg-viva-100 text-viva-800 border-viva-200">
      Pendente
    </span>
  );
}

function canPreviewMime(mime: string | undefined): 'pdf' | 'image' | null {
  const m = (mime || '').toLowerCase();
  if (m === 'application/pdf' || m.includes('pdf')) return 'pdf';
  if (m.startsWith('image/')) return 'image';
  return null;
}

const Avaliacao = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  const [preview, setPreview] = useState<{
    open: boolean;
    title: string;
    mime: string;
    url: string | null;
  }>({ open: false, title: '', mime: '', url: null });

  const [solicitarModal, setSolicitarModal] = useState<{
    open: boolean;
    doc: CadastroPendenteDocumento | null;
    mensagem: string;
  }>({ open: false, doc: null, mensagem: '' });

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    return () => {
      if (preview.url) window.URL.revokeObjectURL(preview.url);
    };
  }, [preview.url]);

  const { data: modulosResp, isLoading: modulosLoading } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });

  const mapModulos = modulosResp?.data?.map;
  const moduloDesabilitado = modulosResp && mapModulos ? mapModulos.AVALIACAO === false : false;

  const listQuery = useQuery({
    queryKey: ['admin', 'cadastros-pendentes', user?.tenantId],
    queryFn: async () => {
      const r = await adminService.listCadastrosPendentes();
      return (r.data ?? []) as CadastroPendenteListItem[];
    },
    enabled: !!user && user.role === 'MASTER' && !moduloDesabilitado,
  });

  const detailQuery = useQuery({
    queryKey: ['admin', 'cadastros-pendentes', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const r = await adminService.getCadastroPendenteDetalhe(selectedId);
      return r.data as CadastroPendenteDetalhe;
    },
    enabled: !!selectedId && user?.role === 'MASTER' && !moduloDesabilitado,
  });

  const invalidateDetalhe = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'cadastros-pendentes', selectedId] });
  };

  const aprovarMutation = useMutation({
    mutationFn: (medicoId: string) => adminService.aprovarCadastroPendente(medicoId),
    onSuccess: async () => {
      setActionError(null);
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'cadastros-pendentes'] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setActionError(err.response?.data?.error || 'Não foi possível aprovar.');
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: (medicoId: string) => adminService.rejeitarCadastroPendente(medicoId),
    onSuccess: async () => {
      setActionError(null);
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'cadastros-pendentes'] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setActionError(err.response?.data?.error || 'Não foi possível rejeitar.');
    },
  });

  const downloadDoc = async (medicoId: string, docId: string, nomeArquivo: string) => {
    try {
      setBusyDocId(docId);
      const blob = await adminService.downloadCadastroPendenteDocumento(medicoId, docId);
      triggerBlobDownload(blob, nomeArquivo);
    } catch {
      setActionError('Falha ao baixar o documento.');
    } finally {
      setBusyDocId(null);
    }
  };

  const previewDoc = async (medicoId: string, doc: CadastroPendenteDocumento) => {
    const kind = canPreviewMime(doc.mimeType);
    if (!kind) {
      setActionError('Este tipo de ficheiro não tem pré-visualização. Use Descarregar.');
      return;
    }
    try {
      setBusyDocId(doc.id);
      setActionError(null);
      const blob = await adminService.downloadCadastroPendenteDocumento(medicoId, doc.id);
      const url = window.URL.createObjectURL(blob);
      if (preview.url) window.URL.revokeObjectURL(preview.url);
      setPreview({
        open: true,
        title: labelDocumentoTipo(doc.tipo),
        mime: doc.mimeType,
        url,
      });
    } catch {
      setActionError('Falha ao pré-visualizar o documento.');
    } finally {
      setBusyDocId(null);
    }
  };

  const confirmarOk = async (medicoId: string, docId: string) => {
    try {
      setBusyDocId(docId);
      setActionError(null);
      await adminService.confirmarOkDocumentoCadastroPendente(medicoId, docId);
      setActionInfo('Documento marcado como OK.');
      await invalidateDetalhe();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setActionError(err.response?.data?.error || 'Não foi possível confirmar o documento.');
    } finally {
      setBusyDocId(null);
    }
  };

  const enviarSolicitacao = async () => {
    if (!selectedId || !solicitarModal.doc) return;
    const mensagem = solicitarModal.mensagem.trim();
    if (!mensagem) {
      setActionError('Escreva o motivo / mensagem para o profissional.');
      return;
    }
    try {
      setBusyDocId(solicitarModal.doc.id);
      setActionError(null);
      await adminService.solicitarDocumentoCadastroPendente(
        selectedId,
        solicitarModal.doc.id,
        mensagem
      );
      setSolicitarModal({ open: false, doc: null, mensagem: '' });
      setActionInfo('E-mail de solicitação enviado.');
      await invalidateDetalhe();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setActionError(err.response?.data?.error || 'Não foi possível enviar a solicitação.');
    } finally {
      setBusyDocId(null);
    }
  };

  const substituirDoc = async (medicoId: string, docId: string, file: File) => {
    try {
      setBusyDocId(docId);
      setActionError(null);
      await adminService.substituirDocumentoCadastroPendente(medicoId, docId, file);
      setActionInfo('Documento substituído e marcado como OK.');
      await invalidateDetalhe();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setActionError(err.response?.data?.error || 'Não foi possível substituir o ficheiro.');
    } finally {
      setBusyDocId(null);
    }
  };

  const tentarAprovar = (d: CadastroPendenteDetalhe) => {
    const pendentes = (d.documentos || []).filter((doc) => {
      const s = doc.statusRevisao || 'PENDENTE';
      return s === 'PENDENTE' || s === 'SOLICITADO';
    });
    const aviso =
      pendentes.length > 0
        ? `Atenção: ainda há ${pendentes.length} documento(s) Pendente ou Solicitado. Aprovar mesmo assim?`
        : 'Aprovar este cadastro? O profissional passará a poder entrar na plataforma.';
    if (window.confirm(aviso)) {
      aprovarMutation.mutate(d.id);
    }
  };

  if (modulosLoading) {
    return (
      <div className="card">
        <p className="text-sm text-viva-700 font-serif">Carregando permissões…</p>
      </div>
    );
  }

  if (moduloDesabilitado) {
    return (
      <div className="card border-l-4 border-amber-500">
        <h2 className="text-base font-bold text-viva-900 mb-2 font-display">Acesso ao módulo</h2>
        <p className="text-sm text-viva-700 font-serif">
          O módulo Avaliação não está habilitado para o seu perfil neste tenant. Um administrador pode ativá-lo em{' '}
          <strong>Minha Conta</strong> (matriz de acessos).
        </p>
      </div>
    );
  }

  if (user?.role !== 'MASTER') {
    return (
      <div className="card border-l-4 border-amber-500">
        <h2 className="text-base font-bold text-viva-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-viva-700 font-serif">A fila de cadastros públicos é exclusiva do perfil Master.</p>
      </div>
    );
  }

  const d = detailQuery.data;
  const previewKind = canPreviewMime(preview.mime);

  return (
    <div className="space-y-6">
      <div className="card dashboard-hero border-l-4 border-l-viva-500 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600 mb-2 font-display">Cadastros</p>
        <h1 className="text-2xl md:text-3xl font-bold text-viva-950 font-display tracking-tight mb-2">Avaliação</h1>
        <p className="text-viva-800 font-serif max-w-2xl">
          Profissionais que se cadastraram pela página pública aparecem aqui até serem aprovados ou rejeitados. Abra um
          registo para ver dados, pré-visualizar ficheiros, confirmar OK, solicitar reenvio por e-mail ou substituir o
          documento.
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>
      )}
      {actionInfo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex justify-between gap-3">
          <span>{actionInfo}</span>
          <button type="button" className="underline text-emerald-800" onClick={() => setActionInfo(null)}>
            Fechar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 card overflow-hidden">
          <h2 className="text-sm font-bold text-viva-900 font-display mb-3">Pendentes de análise</h2>
          {listQuery.isLoading && <p className="text-sm text-viva-700 font-serif">A carregar…</p>}
          {listQuery.isError && (
            <p className="text-sm text-red-700 font-serif">Não foi possível carregar a lista. Verifique a sessão e a API.</p>
          )}
          {!listQuery.isLoading && !listQuery.data?.length && (
            <p className="text-sm text-viva-700 font-serif">Nenhum cadastro aguardando análise.</p>
          )}
          <ul className="divide-y divide-viva-100 max-h-[520px] overflow-y-auto -mx-4 sm:-mx-6">
            {(listQuery.data || []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActionInfo(null);
                    setSelectedId(row.id);
                  }}
                  className={`w-full text-left px-4 py-3 sm:px-6 transition hover:bg-viva-50 ${
                    selectedId === row.id ? 'bg-viva-50 border-l-4 border-l-viva-600' : ''
                  }`}
                >
                  <p className="font-semibold text-viva-900 text-sm">{row.nomeCompleto}</p>
                  <p className="text-xs text-viva-700 mt-0.5">{row.email}</p>
                  <p className="text-xs text-viva-600 mt-1">
                    {row.profissao}
                    {row.crm ? ` · ${row.crm}` : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="xl:col-span-3 card min-h-[320px]">
          {!selectedId && <p className="text-sm text-viva-700 font-serif">Selecione um profissional à esquerda.</p>}
          {selectedId && detailQuery.isLoading && <p className="text-sm text-viva-700 font-serif">A carregar detalhe…</p>}
          {selectedId && detailQuery.isError && (
            <p className="text-sm text-red-700 font-serif">Não foi possível carregar este cadastro (pode já ter sido processado).</p>
          )}
          {d && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-viva-950 font-display">{d.nomeCompleto}</h2>
                  <p className="text-sm text-viva-800 font-serif mt-1">{d.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary text-sm py-2 px-4 rounded-lg disabled:opacity-50"
                    disabled={aprovarMutation.isPending || rejeitarMutation.isPending}
                    onClick={() => tentarAprovar(d)}
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm py-2 px-4 rounded-lg border-red-200 text-red-800 hover:bg-red-50 disabled:opacity-50"
                    disabled={aprovarMutation.isPending || rejeitarMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Rejeitar este cadastro? O acesso continuará bloqueado.')) {
                        rejeitarMutation.mutate(d.id);
                      }
                    }}
                  >
                    Rejeitar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-sm py-2 px-4 rounded-lg shrink-0 border-viva-300 text-viva-900 hover:bg-viva-50"
                    onClick={() => {
                      window.open('https://portal.cfm.org.br/busca-medicos', '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Busca médicos (CFM)
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-viva-600 font-medium">CPF</dt>
                  <dd className="text-viva-900 font-mono">{d.cpf}</dd>
                </div>
                <div>
                  <dt className="text-viva-600 font-medium">Telefone</dt>
                  <dd className="text-viva-900">{d.telefone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-viva-600 font-medium">Profissão / CRM</dt>
                  <dd className="text-viva-900">
                    {d.profissao}
                    {d.crm ? ` · ${d.crm}` : ''}
                  </dd>
                </div>
                {d.rqe ? (
                  <div>
                    <dt className="text-viva-600 font-medium">RQE</dt>
                    <dd className="text-viva-900">{d.rqe}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-viva-600 font-medium">Vínculo</dt>
                  <dd className="text-viva-900">{d.vinculo || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-viva-600 font-medium">Especialidades</dt>
                  <dd className="text-viva-900">{(d.especialidades || []).join(', ') || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-viva-600 font-medium">Local de interesse de trabalho</dt>
                  <dd className="text-viva-900 whitespace-pre-wrap">{d.localInteresseTrabalho || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-viva-600 font-medium">Interesse de trabalho</dt>
                  <dd className="text-viva-900 whitespace-pre-wrap">{d.interesseTrabalho || '—'}</dd>
                </div>
                <div>
                  <dt className="text-viva-600 font-medium">Estado civil</dt>
                  <dd className="text-viva-900">{d.estadoCivil || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-viva-600 font-medium">Endereço</dt>
                  <dd className="text-viva-900 whitespace-pre-wrap">{d.enderecoResidencial || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-viva-600 font-medium">Dados bancários (texto)</dt>
                  <dd className="text-viva-900 whitespace-pre-wrap">{d.dadosBancarios || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-viva-600 font-medium">Chave Pix</dt>
                  <dd className="text-viva-900">{d.chavePix || '—'}</dd>
                </div>
              </dl>

              <div>
                <h3 className="text-sm font-bold text-viva-900 font-display mb-2">Documentos enviados</h3>
                {!d.documentos?.length && (
                  <p className="text-sm text-viva-700 font-serif">Nenhum ficheiro anexado no cadastro.</p>
                )}
                <ul className="space-y-2">
                  {d.documentos?.map((doc) => {
                    const busy = busyDocId === doc.id;
                    const previewable = !!canPreviewMime(doc.mimeType);
                    return (
                      <li key={doc.id} className="rounded-lg border border-viva-200/80 bg-viva-50/40 px-3 py-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-viva-900">{labelDocumentoTipo(doc.tipo)}</p>
                            <p className="text-xs text-viva-700 truncate">{doc.nomeArquivo}</p>
                            {doc.validadeEm ? (
                              <p className="text-[11px] text-viva-700 mt-0.5">
                                Validade: {String(doc.validadeEm).slice(0, 10).split('-').reverse().join('/')}
                                {doc.statusValidade && doc.statusValidade !== 'OK' && doc.statusValidade !== 'NAO_APLICA'
                                  ? ` · ${doc.statusValidade === 'VENCIDO' ? 'Vencido' : doc.statusValidade === 'PROXIMO' ? 'Próximo do vencimento' : 'Sem data'}`
                                  : ''}
                              </p>
                            ) : null}
                            {statusBadge(doc.statusRevisao)}
                            {doc.statusRevisao === 'SOLICITADO' && doc.solicitacaoMensagem ? (
                              <p className="mt-1 text-[11px] text-amber-900/90 whitespace-pre-wrap">
                                Último pedido: {doc.solicitacaoMensagem}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <button
                              type="button"
                              className="text-sm font-semibold text-viva-700 hover:text-viva-900 underline disabled:opacity-50"
                              disabled={busy || !previewable}
                              title={previewable ? 'Pré-visualizar' : 'Sem pré-visualização para este tipo'}
                              onClick={() => previewDoc(d.id, doc)}
                            >
                              Pré-visualizar
                            </button>
                            <button
                              type="button"
                              className="text-sm font-semibold text-viva-700 hover:text-viva-900 underline disabled:opacity-50"
                              disabled={busy}
                              onClick={() => downloadDoc(d.id, doc.id, doc.nomeArquivo)}
                            >
                              Descarregar
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-viva-200/60 pt-2">
                          <button
                            type="button"
                            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                            disabled={busy || doc.statusRevisao === 'OK'}
                            onClick={() => confirmarOk(d.id, doc.id)}
                          >
                            Confirmar OK
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold px-2.5 py-1 rounded-md border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-40"
                            disabled={busy}
                            onClick={() =>
                              setSolicitarModal({
                                open: true,
                                doc,
                                mensagem: doc.solicitacaoMensagem || '',
                              })
                            }
                          >
                            Solicitar por e-mail
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold px-2.5 py-1 rounded-md border border-viva-300 bg-white text-viva-800 hover:bg-viva-50 disabled:opacity-40"
                            disabled={busy}
                            onClick={() => fileInputRefs.current[doc.id]?.click()}
                          >
                            Substituir ficheiro
                          </button>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[doc.id] = el;
                            }}
                            type="file"
                            className="hidden"
                            accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (f) void substituirDoc(d.id, doc.id, f);
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {preview.open && preview.url ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-viva-200">
              <p className="font-semibold text-viva-900 text-sm truncate">{preview.title}</p>
              <button
                type="button"
                className="text-sm font-semibold text-viva-700 underline"
                onClick={() => {
                  if (preview.url) window.URL.revokeObjectURL(preview.url);
                  setPreview({ open: false, title: '', mime: '', url: null });
                }}
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-viva-50">
              {previewKind === 'pdf' ? (
                <iframe title="Pré-visualização PDF" src={preview.url} className="w-full h-[70vh] border-0" />
              ) : previewKind === 'image' ? (
                <div className="p-4 overflow-auto max-h-[70vh] flex justify-center">
                  <img src={preview.url} alt={preview.title} className="max-w-full max-h-[65vh] object-contain" />
                </div>
              ) : (
                <p className="p-6 text-sm text-viva-700">Pré-visualização indisponível.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {solicitarModal.open && solicitarModal.doc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div>
              <h3 className="font-bold text-viva-950 font-display">Solicitar documento por e-mail</h3>
              <p className="text-sm text-viva-700 mt-1">
                Será enviado um e-mail formal ao profissional pedindo o reenvio de:{' '}
                <strong>{labelDocumentoTipo(solicitarModal.doc.tipo)}</strong>
              </p>
            </div>
            <div>
              <label htmlFor="msg-solicitar-doc" className="block text-xs font-medium text-viva-600 mb-1">
                Motivo / orientação (obrigatório)
              </label>
              <textarea
                id="msg-solicitar-doc"
                rows={5}
                value={solicitarModal.mensagem}
                onChange={(e) => setSolicitarModal((s) => ({ ...s, mensagem: e.target.value }))}
                placeholder="Ex.: a imagem está ilegível / o CRM não confere / envie a frente e o verso…"
                className="w-full py-2 px-3 text-sm border border-viva-200 rounded-lg outline-none bg-viva-50/50 focus:ring-2 focus:ring-viva-500/30 focus:border-viva-500"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary text-sm py-2 px-4 rounded-lg"
                onClick={() => setSolicitarModal({ open: false, doc: null, mensagem: '' })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary text-sm py-2 px-4 rounded-lg disabled:opacity-50"
                disabled={busyDocId === solicitarModal.doc.id || !solicitarModal.mensagem.trim()}
                onClick={() => void enviarSolicitacao()}
              >
                Enviar e-mail
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Avaliacao;
