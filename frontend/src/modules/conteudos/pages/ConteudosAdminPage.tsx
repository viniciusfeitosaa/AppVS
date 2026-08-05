import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/auth.service';
import {
  conteudoAdminService,
  type ConteudoEvento,
  type ConteudoEventoStatus,
  type ConteudoPalestrante,
  type ConteudoParticipante,
  type ConteudoPrecadastro,
} from '../api/conteudo.service';
import { CapaUploadField } from '../components/CapaUploadField';
import { DateTimeField } from '../components/DateTimeField';
import { LocalQrCode } from '../components/LocalQrCode';
import { ShareLinkCard } from '../components/ShareLinkCard';

function statusLabel(s: ConteudoEventoStatus) {
  if (s === 'PUBLICADO') return 'Inscrições abertas';
  if (s === 'ENCERRADO') return 'Encerrado';
  return 'Rascunho';
}

function statusClass(s: ConteudoEventoStatus) {
  if (s === 'PUBLICADO') return 'bg-emerald-100 text-emerald-800';
  if (s === 'ENCERRADO') return 'bg-slate-200 text-slate-700';
  return 'bg-amber-100 text-amber-900';
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string) {
  const d = new Date(local);
  return d.toISOString();
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

const emptyForm = {
  titulo: '',
  youtubeUrl: '',
  iniciaEm: '',
  descricao: '',
};

const ConteudosAdminPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'eventos' | 'precadastros'>('eventos');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [palNome, setPalNome] = useState('');
  const [palEmail, setPalEmail] = useState('');
  const [palSearch, setPalSearch] = useState('');
  const [selectedPalId, setSelectedPalId] = useState('');
  const [palMode, setPalMode] = useState<'existente' | 'novo'>('existente');
  const [excluirParticipante, setExcluirParticipante] = useState<{
    id: string;
    eventoId: string;
    nome: string;
    email: string;
  } | null>(null);
  const [detalhePrecadastro, setDetalhePrecadastro] = useState<ConteudoPrecadastro | null>(null);
  const [selectedPrecadastroIds, setSelectedPrecadastroIds] = useState<string[]>([]);
  const [confirmAceitar, setConfirmAceitar] = useState(false);

  const { data: modulosResp } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });
  const moduloOff = modulosResp?.data?.map?.CONTEUDOS === false;

  const listQuery = useQuery({
    queryKey: ['admin', 'conteudos', 'eventos'],
    queryFn: async () => (await conteudoAdminService.listEventos()).data.data,
    enabled: !!user && user.role === 'MASTER' && !moduloOff,
  });

  const detailQuery = useQuery({
    queryKey: ['admin', 'conteudos', 'evento', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      return (await conteudoAdminService.getEvento(selectedId)).data.data;
    },
    enabled: !!selectedId,
  });

  const participantesQuery = useQuery({
    queryKey: ['admin', 'conteudos', 'participantes', selectedId],
    queryFn: async () => {
      if (!selectedId) return [] as ConteudoParticipante[];
      return (await conteudoAdminService.listParticipantes(selectedId)).data.data;
    },
    enabled: !!selectedId,
  });

  const palestrantesQuery = useQuery({
    queryKey: ['admin', 'conteudos', 'palestrantes', palSearch],
    queryFn: async () =>
      (await conteudoAdminService.listPalestrantes(palSearch || undefined)).data.data,
    enabled: !!selectedId && viewMode === 'eventos',
  });

  const precadastrosQuery = useQuery({
    queryKey: ['admin', 'conteudos', 'precadastros'],
    queryFn: async () => (await conteudoAdminService.listPrecadastros()).data.data,
    enabled: !!user && user.role === 'MASTER' && !moduloOff && viewMode === 'precadastros',
  });

  const evento = detailQuery.data;

  useEffect(() => {
    if (!evento) return;
    setForm({
      titulo: evento.titulo,
      youtubeUrl: evento.youtubeUrl || '',
      iniciaEm: toLocalInputValue(evento.iniciaEm),
      descricao: evento.descricao || '',
    });
    setSelectedPalId(evento.palestranteId || '');
    setPalMode(evento.palestranteId ? 'existente' : 'novo');
  }, [evento?.id, evento?.updatedAt]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'conteudos'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await conteudoAdminService.createEvento({
        titulo: form.titulo,
        youtubeUrl: form.youtubeUrl || null,
        iniciaEm: fromLocalInputValue(form.iniciaEm),
        descricao: form.descricao || null,
      });
      return res.data.data;
    },
    onSuccess: async (created) => {
      setError(null);
      setOkMsg('Conteúdo criado');
      await invalidate();
      setSelectedId(created.id);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Falha ao criar');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error('Sem id');
      return conteudoAdminService.updateEvento(selectedId, {
        titulo: form.titulo,
        youtubeUrl: form.youtubeUrl || null,
        iniciaEm: fromLocalInputValue(form.iniciaEm),
        descricao: form.descricao || null,
        palestranteId: selectedPalId || null,
      });
    },
    onSuccess: async () => {
      setOkMsg('Salvo');
      setError(null);
      await invalidate();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Falha ao salvar');
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (action: 'publicar' | 'encerrar' | 'rascunho') => {
      if (!selectedId) throw new Error('Sem id');
      if (action === 'publicar') {
        // Salva campos pendentes e abre inscrições (YouTube opcional — pode vir perto do horário)
        await conteudoAdminService.updateEvento(selectedId, {
          titulo: form.titulo,
          youtubeUrl: form.youtubeUrl.trim() || null,
          iniciaEm: fromLocalInputValue(form.iniciaEm),
          descricao: form.descricao || null,
          palestranteId: selectedPalId || null,
        });
        return conteudoAdminService.publicar(selectedId);
      }
      if (action === 'encerrar') return conteudoAdminService.encerrar(selectedId);
      return conteudoAdminService.rascunho(selectedId);
    },
    onSuccess: async (_data, action) => {
      setError(null);
      setOkMsg(
        action === 'publicar'
          ? 'Inscrições abertas — anúncio liberado'
          : action === 'encerrar'
            ? 'Inscrições encerradas'
            : 'Voltado a rascunho'
      );
      await invalidate();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Falha na ação');
    },
  });

  const conviteMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error('Sem id');
      return conteudoAdminService.convidarPalestrante(selectedId, {
        nome: palNome || undefined,
        email: palEmail || undefined,
      });
    },
    onSuccess: async () => {
      setOkMsg('Convite de palestrante criado — copie o link abaixo');
      setPalNome('');
      setPalEmail('');
      await invalidate();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Falha no convite');
    },
  });

  const capaMutation = useMutation({
    mutationFn: (file: File) => {
      if (!selectedId) throw new Error('Sem id');
      return conteudoAdminService.uploadCapa(selectedId, file);
    },
    onSuccess: async () => {
      setOkMsg('Capa atualizada');
      await invalidate();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Falha no upload da capa');
    },
  });

  const frequenciaMutation = useMutation({
    mutationFn: async (action: 'abrir' | 'fechar') => {
      if (!selectedId) throw new Error('Sem id');
      if (action === 'abrir') return conteudoAdminService.abrirFrequencia(selectedId);
      return conteudoAdminService.fecharFrequencia(selectedId);
    },
    onSuccess: async (_data, action) => {
      setError(null);
      setOkMsg(action === 'abrir' ? 'Frequência aberta — compartilhe o link' : 'Frequência encerrada');
      await invalidate();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Falha na frequência');
    },
  });

  const deleteParticipanteMutation = useMutation({
    mutationFn: (target: { eventoId: string; id: string }) =>
      conteudoAdminService.deleteParticipante(target.eventoId, target.id),
    onSuccess: async () => {
      setError(null);
      setOkMsg('Participante excluído da lista e dos precadastros');
      setExcluirParticipante(null);
      await invalidate();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Não foi possível excluir o participante');
    },
  });

  const aceitarPrecadastrosMutation = useMutation({
    mutationFn: (ids: string[]) => conteudoAdminService.aceitarPrecadastros(ids),
    onSuccess: async (res) => {
      setError(null);
      const d = res.data.data;
      const falhas = d.results.filter((r) => !r.ok);
      setOkMsg(
        falhas.length
          ? `${d.aceitos}/${d.total} aceitos. ${falhas.length} com erro (veja lista).`
          : `${d.aceitos} precadastro(s) aceito(s) — e-mail com link de cadastro enviado.`
      );
      setSelectedPrecadastroIds([]);
      setConfirmAceitar(false);
      await invalidate();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Falha ao aceitar precadastros');
    },
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setOkMsg(null);
    if (!form.titulo || !form.iniciaEm) {
      setError('Preencha título e data/hora');
      return;
    }
    createMutation.mutate();
  };

  const eventos = listQuery.data || [];
  const palestrantes: ConteudoPalestrante[] = palestrantesQuery.data || [];

  if (moduloOff) {
    return (
      <div className="p-6">
        <p className="text-viva-800">Módulo Conteúdos desabilitado para seu perfil.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto space-y-6">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-display font-semibold text-viva-950">Conteúdos</h1>
          <p className="text-sm text-viva-700">
            Anuncie aulas ao vivo, abra inscrições cedo e capture participantes — o link do YouTube pode
            entrar depois, perto do horário.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewMode('eventos')}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              viewMode === 'eventos' ? 'bg-viva-800 text-white' : 'border border-viva-300 text-viva-800'
            }`}
          >
            Eventos
          </button>
          <button
            type="button"
            onClick={() => setViewMode('precadastros')}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              viewMode === 'precadastros' ? 'bg-viva-800 text-white' : 'border border-viva-300 text-viva-800'
            }`}
          >
            Precadastros
          </button>
        </div>
      </header>

      {(error || okMsg) && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            error ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {error || okMsg}
        </div>
      )}

      {viewMode === 'precadastros' ? (
        <section className="rounded-2xl border border-viva-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-viva-100 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-viva-900">Precadastros (candidatos ao corpo clínico)</h2>
              <p className="text-xs text-viva-600 mt-1">
                Ainda não estão no corpo clínico. Aceite um ou vários: enviamos e-mail com link para completar o
                cadastro; ao concluir, o acesso é liberado na hora (sem Avaliação).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-viva-200 px-3 py-1.5 text-xs font-semibold text-viva-800 hover:bg-viva-50"
                onClick={() => {
                  const list = (precadastrosQuery.data || []).filter(
                    (p) => p.precadastroStatus !== 'CONVERTIDO'
                  );
                  const allIds = list.map((p) => p.id);
                  const allSelected =
                    allIds.length > 0 && allIds.every((id) => selectedPrecadastroIds.includes(id));
                  setSelectedPrecadastroIds(allSelected ? [] : allIds);
                }}
              >
                {selectedPrecadastroIds.length > 0 ? 'Limpar seleção' : 'Selecionar todos'}
              </button>
              <button
                type="button"
                disabled={selectedPrecadastroIds.length === 0 || aceitarPrecadastrosMutation.isPending}
                onClick={() => setConfirmAceitar(true)}
                className="rounded-lg bg-viva-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-viva-900 disabled:opacity-50"
              >
                Aceitar selecionados ({selectedPrecadastroIds.length})
              </button>
            </div>
          </div>
          {precadastrosQuery.isLoading ? (
            <p className="p-4 text-sm text-viva-600">Carregando…</p>
          ) : (precadastrosQuery.data || []).length === 0 ? (
            <p className="p-4 text-sm text-viva-600">Nenhum precadastro ainda.</p>
          ) : (
            <ul className="divide-y divide-viva-100">
              {(precadastrosQuery.data || []).map((p: ConteudoPrecadastro) => {
                const status = p.precadastroStatus || 'AGUARDANDO';
                const isConvertido = status === 'CONVERTIDO';
                const checked = selectedPrecadastroIds.includes(p.id);
                return (
                  <li key={p.id} className="px-4 py-3 space-y-1">
                    <div className="flex flex-wrap items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={isConvertido}
                        checked={checked}
                        onChange={() => {
                          setSelectedPrecadastroIds((prev) =>
                            prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                          );
                        }}
                        aria-label={`Selecionar ${p.nome}`}
                      />
                      <button
                        type="button"
                        onClick={() => setDetalhePrecadastro(p)}
                        className="min-w-0 flex-1 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-viva-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-viva-500/30"
                      >
                        <p className="text-sm font-medium text-viva-950">{p.resumo}</p>
                        <p className="text-xs text-viva-600 mt-1">
                          Conteúdo: {p.evento.titulo} · {new Date(p.evento.iniciaEm).toLocaleString('pt-BR')}
                        </p>
                        {p.camposFaltantes && p.camposFaltantes.length > 0 && status !== 'CONVERTIDO' && (
                          <p className="text-[11px] text-amber-800 mt-1">
                            Faltam: {p.camposFaltantes.slice(0, 4).join(', ')}
                            {p.camposFaltantes.length > 4 ? '…' : ''}
                          </p>
                        )}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            status === 'CONVERTIDO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'ACEITO'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {status === 'CONVERTIDO'
                            ? 'No corpo clínico'
                            : status === 'ACEITO'
                              ? 'Aceito · aguarda cadastro'
                              : 'Aguardando'}
                        </span>
                        <span className="text-[11px] text-viva-500 whitespace-nowrap">
                          {new Date(p.createdAt).toLocaleString('pt-BR')}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExcluirParticipante({
                              id: p.id,
                              eventoId: p.evento.id,
                              nome: p.nome,
                              email: p.email,
                            });
                          }}
                          className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
      <div className="grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <form onSubmit={onCreate} className="rounded-2xl border border-viva-200 bg-white p-4 space-y-3">
            <h2 className="font-semibold text-viva-900">Novo anúncio</h2>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-viva-800">Nome do conteúdo</span>
              <input
                className="w-full rounded-lg border border-viva-200 bg-white px-3 py-2.5 text-sm text-viva-900 shadow-sm outline-none transition focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20"
                placeholder="Ex.: Aula ao vivo — escalas"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                disabled={!!selectedId}
                required={!selectedId}
              />
            </label>
            {!selectedId && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-viva-800">YouTube (opcional)</span>
                  <input
                    className="w-full rounded-lg border border-viva-200 bg-white px-3 py-2.5 text-sm text-viva-900 shadow-sm outline-none transition focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20"
                    placeholder="Pode ficar em branco — adicione perto do horário"
                    value={form.youtubeUrl}
                    onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
                  />
                </label>
                <DateTimeField
                  id="novo-conteudo-inicia"
                  required
                  value={form.iniciaEm}
                  onChange={(iniciaEm) => setForm((f) => ({ ...f, iniciaEm }))}
                  hint="obrigatório"
                />
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full rounded-lg bg-viva-800 text-white py-2.5 text-sm font-medium hover:bg-viva-900 disabled:opacity-60"
                >
                  {createMutation.isPending ? 'Criando…' : 'Criar rascunho'}
                </button>
              </>
            )}
            {selectedId && (
              <button
                type="button"
                className="text-sm text-viva-700 underline"
                onClick={() => {
                  setSelectedId(null);
                  setForm(emptyForm);
                  setError(null);
                }}
              >
                Limpar seleção e criar outro
              </button>
            )}
          </form>

          <div className="rounded-2xl border border-viva-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-viva-100 font-semibold text-viva-900">Lista</div>
            {listQuery.isLoading ? (
              <p className="p-4 text-sm text-viva-600">Carregando…</p>
            ) : eventos.length === 0 ? (
              <p className="p-4 text-sm text-viva-600">Nenhum conteúdo ainda.</p>
            ) : (
              <ul className="divide-y divide-viva-100 max-h-[28rem] overflow-auto">
                {eventos.map((ev: ConteudoEvento) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(ev.id);
                        setError(null);
                        setOkMsg(null);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-viva-50 ${
                        selectedId === ev.id ? 'bg-viva-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-viva-900 text-sm">{ev.titulo}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusClass(ev.status)}`}>
                          {statusLabel(ev.status)}
                        </span>
                      </div>
                      <p className="text-xs text-viva-600 mt-1">
                        {new Date(ev.iniciaEm).toLocaleString('pt-BR')} · {ev.participantesCount ?? 0}{' '}
                        participantes
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="lg:col-span-3 space-y-4" aria-label="Detalhe do conteúdo">
          {!selectedId || !evento ? (
            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-dashed border-viva-300 bg-[radial-gradient(circle_at_top,_rgba(82,163,58,0.08),_transparent_55%),linear-gradient(180deg,#f8faf7,#fff)] p-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-viva-700 shadow-sm ring-1 ring-viva-200">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" aria-hidden>
                  <path d="M4 19.5V6.75A2.25 2.25 0 0 1 6.25 4.5h11.5A2.25 2.25 0 0 1 20 6.75v12.75" strokeLinecap="round" />
                  <path d="M8 8h8M8 12h5" strokeLinecap="round" />
                </svg>
              </span>
              <p className="font-display text-lg font-semibold text-viva-950">Nenhum anúncio selecionado</p>
              <p className="mt-1 max-w-sm text-sm text-viva-600 leading-relaxed">
                Crie um rascunho à esquerda ou escolha um item da lista para editar capa, palestrante e abrir
                inscrições.
              </p>
            </div>
          ) : (
            <>
              <article className="overflow-hidden rounded-2xl border border-viva-200 bg-white shadow-[0_10px_30px_rgba(26,64,17,0.04)]">
                <header className="border-b border-viva-100 bg-gradient-to-r from-viva-50 via-white to-white px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-viva-500">
                        Anúncio da aula
                      </p>
                      <h2 className="font-display text-xl font-semibold text-viva-950 truncate">
                        {evento.titulo || 'Sem título'}
                      </h2>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(evento.status)}`}>
                      {statusLabel(evento.status)}
                    </span>
                  </div>
                  <div
                    className={`mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                      evento.status === 'PUBLICADO'
                        ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100'
                        : evento.status === 'ENCERRADO'
                          ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                          : 'bg-amber-50 text-amber-950 ring-1 ring-amber-100'
                    }`}
                    role="status"
                  >
                    {evento.status === 'RASCUNHO' &&
                      'Rascunho: só a equipe vê. Abra as inscrições quando o anúncio estiver pronto — YouTube não é obrigatório.'}
                    {evento.status === 'PUBLICADO' &&
                      'Inscrições abertas: médicos veem na lista e o link externo já captura participantes. O vídeo pode ser adicionado depois.'}
                    {evento.status === 'ENCERRADO' &&
                      'Encerrado: ainda consultável, mas novas inscrições (app e link) estão bloqueadas.'}
                  </div>
                </header>

                <div className="space-y-5 p-4 sm:p-5">
                  <section className="space-y-3" aria-labelledby="conteudo-dados-title">
                    <h3 id="conteudo-dados-title" className="text-sm font-semibold text-viva-900">
                      Dados principais
                    </h3>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-viva-800">Título</span>
                      <input
                        className="w-full rounded-lg border border-viva-200 bg-white px-3 py-2.5 text-sm text-viva-900 shadow-sm outline-none transition focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20"
                        value={form.titulo}
                        onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                      />
                    </label>
                    <DateTimeField
                      id="editar-conteudo-inicia"
                      required
                      value={form.iniciaEm}
                      onChange={(iniciaEm) => setForm((f) => ({ ...f, iniciaEm }))}
                    />
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-viva-800">Descrição</span>
                      <textarea
                        className="min-h-[96px] w-full rounded-lg border border-viva-200 bg-white px-3 py-2.5 text-sm text-viva-900 shadow-sm outline-none transition focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20"
                        value={form.descricao}
                        onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                        placeholder="Resumo curto para a lista e a página do conteúdo"
                      />
                    </label>
                  </section>

                  <section className="space-y-3 border-t border-viva-100 pt-5" aria-labelledby="conteudo-midia-title">
                    <h3 id="conteudo-midia-title" className="text-sm font-semibold text-viva-900">
                      Mídia
                    </h3>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-viva-800">YouTube (opcional)</span>
                      <input
                        className="w-full rounded-lg border border-viva-200 bg-white px-3 py-2.5 text-sm text-viva-900 shadow-sm outline-none transition focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20"
                        value={form.youtubeUrl}
                        onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
                        placeholder="Adicione perto do horário da aula ao vivo"
                      />
                      <span className="text-[11px] text-viva-500">
                        Não precisa para anunciar. Quando tiver o link, cole aqui e salve — a prévia aparece abaixo.
                      </span>
                    </label>
                    {evento.youtubeEmbedUrl && (
                      <div className="aspect-video w-full overflow-hidden rounded-xl border border-viva-200 bg-black shadow-sm">
                        <iframe
                          title="Prévia YouTube"
                          src={evento.youtubeEmbedUrl}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                    <CapaUploadField
                      eventoId={evento.id}
                      capaUrl={evento.capaUrl}
                      updatedAt={evento.updatedAt}
                      uploading={capaMutation.isPending}
                      onUpload={(file) => capaMutation.mutate(file)}
                    />
                  </section>

                  <footer className="sticky bottom-0 z-[1] -mx-4 border-t border-viva-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        className="rounded-lg border border-viva-300 bg-white px-4 py-2.5 text-sm font-semibold text-viva-900 shadow-sm transition hover:bg-viva-50 disabled:opacity-60"
                      >
                        {saveMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
                      </button>
                      {evento.status !== 'PUBLICADO' && (
                        <button
                          type="button"
                          onClick={() => actionMutation.mutate('publicar')}
                          disabled={actionMutation.isPending}
                          title="Salva os campos e abre as inscrições (YouTube opcional)"
                          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
                        >
                          {actionMutation.isPending && actionMutation.variables === 'publicar'
                            ? 'Abrindo…'
                            : 'Abrir inscrições'}
                        </button>
                      )}
                      {evento.status === 'PUBLICADO' && (
                        <button
                          type="button"
                          onClick={() => actionMutation.mutate('encerrar')}
                          disabled={actionMutation.isPending}
                          className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          Encerrar inscrições
                        </button>
                      )}
                      {evento.status !== 'RASCUNHO' && (
                        <button
                          type="button"
                          onClick={() => actionMutation.mutate('rascunho')}
                          disabled={actionMutation.isPending}
                          className="rounded-lg px-3 py-2.5 text-sm font-medium text-viva-700 underline-offset-2 hover:underline disabled:opacity-60"
                        >
                          Voltar a rascunho
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-viva-500">
                      Salvar guarda os campos. Abrir inscrições anuncia a aula para médicos e ativa o link
                      público — o YouTube pode ser preenchido depois.
                    </p>
                  </footer>
                </div>
              </article>

              <article className="rounded-2xl border border-viva-200 bg-white p-4 shadow-[0_8px_24px_rgba(26,64,17,0.03)] sm:p-5 space-y-4">
                <header className="space-y-1">
                  <h3 className="font-display text-lg font-semibold text-viva-950">Palestrante</h3>
                  <p className="text-xs text-viva-600 leading-relaxed">
                    Vincule alguém já cadastrado ou convide uma pessoa nova — ela completa o perfil no link.
                  </p>
                </header>

                {evento.palestrante && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-viva-50 px-3 py-2.5 ring-1 ring-viva-100">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-viva-800 text-xs font-bold text-white">
                      {evento.palestrante.nome.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-viva-950">{evento.palestrante.nome}</p>
                      <p className="truncate text-xs text-viva-600">{evento.palestrante.email}</p>
                      {evento.palestrante.cpf && (
                        <p className="truncate text-xs text-viva-600">CPF {evento.palestrante.cpf}</p>
                      )}
                    </div>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        evento.palestrante.status === 'COMPLETO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {evento.palestrante.status === 'COMPLETO' ? 'Cadastro completo' : 'Aguardando formulário'}
                    </span>
                  </div>
                )}

                <div className="inline-flex rounded-xl bg-viva-50 p-1 ring-1 ring-viva-100" role="tablist" aria-label="Modo do palestrante">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={palMode === 'existente'}
                    onClick={() => setPalMode('existente')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      palMode === 'existente' ? 'bg-white text-viva-950 shadow-sm' : 'text-viva-600 hover:text-viva-900'
                    }`}
                  >
                    Já cadastrado
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={palMode === 'novo'}
                    onClick={() => setPalMode('novo')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      palMode === 'novo' ? 'bg-white text-viva-950 shadow-sm' : 'text-viva-600 hover:text-viva-900'
                    }`}
                  >
                    Convidar novo
                  </button>
                </div>

                {palMode === 'existente' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block space-y-1 sm:col-span-1">
                      <span className="text-xs font-medium text-viva-700">Buscar</span>
                      <input
                        className="w-full rounded-lg border border-viva-200 px-3 py-2.5 text-sm outline-none focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20"
                        placeholder="Nome ou e-mail"
                        value={palSearch}
                        onChange={(e) => setPalSearch(e.target.value)}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-viva-700">Selecionar</span>
                      <select
                        className="w-full rounded-lg border border-viva-200 px-3 py-2.5 text-sm outline-none focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20"
                        value={selectedPalId}
                        onChange={(e) => setSelectedPalId(e.target.value)}
                      >
                        <option value="">Sem palestrante</option>
                        {palestrantes.map((p: ConteudoPalestrante) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} ({p.email})
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="sm:col-span-2 text-[11px] text-viva-500">
                      Depois de escolher, clique em <strong>Salvar alterações</strong> no bloco acima para vincular.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-viva-700">Nome</span>
                        <input
                          className="w-full rounded-lg border border-viva-200 px-3 py-2.5 text-sm outline-none focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20"
                          placeholder="Nome completo"
                          value={palNome}
                          onChange={(e) => setPalNome(e.target.value)}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-viva-700">E-mail</span>
                        <input
                          type="email"
                          className="w-full rounded-lg border border-viva-200 px-3 py-2.5 text-sm outline-none focus:border-viva-500 focus:ring-2 focus:ring-viva-500/20"
                          placeholder="email@exemplo.com"
                          value={palEmail}
                          onChange={(e) => setPalEmail(e.target.value)}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => conviteMutation.mutate()}
                      disabled={conviteMutation.isPending}
                      className="inline-flex items-center justify-center rounded-lg bg-viva-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-viva-900 disabled:opacity-60"
                    >
                      {conviteMutation.isPending ? 'Gerando convite…' : 'Gerar convite e link'}
                    </button>
                  </div>
                )}

                {evento.linkPalestrante && (
                  <ShareLinkCard
                    label="Link do formulário do palestrante"
                    description="Envie por WhatsApp ou e-mail para a pessoa completar o cadastro."
                    url={evento.linkPalestrante}
                    onCopy={async () => {
                      await copyText(evento.linkPalestrante!);
                      setOkMsg('Link do palestrante copiado');
                    }}
                  />
                )}
              </article>

              <article className="rounded-2xl border border-viva-200 bg-white p-4 shadow-[0_8px_24px_rgba(26,64,17,0.03)] sm:p-5 space-y-4">
                <header className="flex flex-wrap items-end justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-semibold text-viva-950">Frequência</h3>
                    <p className="text-xs text-viva-600 leading-relaxed">
                      Durante a aula, abra a frequência e compartilhe o link/QR. Médicos confirmam no app;
                      externos usam o e-mail da inscrição.
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      evento.frequenciaAberta
                        ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                        : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                    }`}
                  >
                    {evento.frequenciaAberta ? 'Aberta agora' : 'Fechada'}
                  </span>
                </header>

                <div className="flex flex-wrap gap-2">
                  {!evento.frequenciaAberta ? (
                    <button
                      type="button"
                      onClick={() => frequenciaMutation.mutate('abrir')}
                      disabled={frequenciaMutation.isPending || evento.status === 'RASCUNHO'}
                      title={
                        evento.status === 'RASCUNHO'
                          ? 'Abra as inscrições antes de liberar a frequência'
                          : undefined
                      }
                      className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
                    >
                      {frequenciaMutation.isPending && frequenciaMutation.variables === 'abrir'
                        ? 'Abrindo…'
                        : 'Abrir frequência'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => frequenciaMutation.mutate('fechar')}
                      disabled={frequenciaMutation.isPending}
                      className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {frequenciaMutation.isPending && frequenciaMutation.variables === 'fechar'
                        ? 'Encerrando…'
                        : 'Encerrar frequência'}
                    </button>
                  )}
                </div>

                {evento.linkFrequencia && (
                  <ShareLinkCard
                    label="Link público de frequência"
                    description="Mostre na aula ou envie no chat — o inscrito confirma com o e-mail do cadastro."
                    url={evento.linkFrequencia}
                    disabledHint={!evento.frequenciaAberta ? 'Abra a frequência para ativar este link.' : null}
                    onCopy={async () => {
                      await copyText(evento.linkFrequencia!);
                      setOkMsg('Link de frequência copiado');
                    }}
                  />
                )}

                {evento.frequenciaAberta && evento.linkFrequencia && (
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                    <LocalQrCode
                      value={evento.linkFrequencia}
                      size={160}
                      alt="QR Code da frequência"
                      className="h-40 w-40 rounded-xl border border-viva-200 bg-white p-2"
                    />
                    <div className="space-y-2 max-w-xs">
                      <p className="text-xs text-viva-600 leading-relaxed">
                        QR gerado neste aparelho (sem enviar o link a serviços externos). Presentes:{' '}
                        {evento.presentesCount ?? 0} · Ausentes:{' '}
                        {evento.ausentesCount ??
                          Math.max(0, (evento.participantesCount ?? 0) - (evento.presentesCount ?? 0))}
                      </p>
                      <button
                        type="button"
                        className="text-xs font-medium text-viva-700 underline"
                        onClick={async () => {
                          if (!selectedId) return;
                          try {
                            await conteudoAdminService.regenerarToken(selectedId, 'frequencia');
                            setOkMsg('Link de frequência regenerado — use o novo QR');
                            await invalidate();
                          } catch (e: unknown) {
                            const err = e as { response?: { data?: { error?: string } } };
                            setError(err.response?.data?.error || 'Falha ao regenerar link');
                          }
                        }}
                      >
                        Regenerar link de frequência
                      </button>
                    </div>
                  </div>
                )}
              </article>

              <article className="rounded-2xl border border-viva-200 bg-white p-4 shadow-[0_8px_24px_rgba(26,64,17,0.03)] sm:p-5 space-y-4">
                <header className="flex flex-wrap items-end justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-semibold text-viva-950">Participantes</h3>
                    <p className="text-xs text-viva-600 leading-relaxed">
                      Médicos pelo app · externos pelo link público (com inscrições abertas).
                    </p>
                  </div>
                  <span className="rounded-full bg-viva-50 px-2.5 py-1 text-xs font-semibold text-viva-800 ring-1 ring-viva-100">
                    {(participantesQuery.data || []).length} inscrito
                    {(participantesQuery.data || []).length === 1 ? '' : 's'}
                    {evento.presentesCount != null ? ` · ${evento.presentesCount} presente(s)` : ''}
                  </span>
                </header>

                {evento.linkInscricao && (
                  <ShareLinkCard
                    label="Link público de inscrição"
                    description="Para quem não está no app — gera precadastro com dados mínimos."
                    url={evento.linkInscricao}
                    disabledHint={
                      evento.status !== 'PUBLICADO'
                        ? 'Abra as inscrições para ativar este link.'
                        : null
                    }
                    onCopy={async () => {
                      await copyText(evento.linkInscricao!);
                      setOkMsg('Link de inscrição copiado');
                    }}
                  />
                )}

                {(participantesQuery.data || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-viva-300 bg-viva-50/50 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-viva-900">Nenhum participante ainda</p>
                    <p className="mt-1 text-xs text-viva-600">
                      {evento.status === 'PUBLICADO'
                        ? 'Assim que alguém se inscrever pelo app ou pelo link, a lista aparece aqui.'
                        : 'Abra as inscrições para começar a captar participantes.'}
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-64 divide-y divide-viva-100 overflow-auto rounded-xl border border-viva-100">
                    {(participantesQuery.data || []).map((p: ConteudoParticipante) => (
                      <li key={p.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium text-viva-950 truncate">{p.nome}</p>
                          <p className="truncate text-xs text-viva-600">
                            {[
                              p.perfil === 'ESTUDANTE' ? 'Estudante' : p.perfil === 'MEDICO' ? 'Médico' : null,
                              p.email,
                              p.telefone,
                              p.cpf ? `CPF ${p.cpf}` : null,
                              p.crm ? `CRM ${p.crm}` : null,
                              p.especialidade,
                              p.faculdade,
                              p.semestre ? `Semestre: ${p.semestre}` : null,
                              p.participaLiga && p.ligaNome ? `Liga: ${p.ligaNome}` : null,
                              p.cidade,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {p.presenteEm && (
                            <p className="text-[11px] text-emerald-700">
                              Presente às {new Date(p.presenteEm).toLocaleString('pt-BR')}
                              {p.presencaOrigem === 'APP'
                                ? ' · app'
                                : p.presencaOrigem === 'LINK_PUBLICO'
                                  ? ' · link'
                                  : ''}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className="rounded-full bg-viva-50 px-2 py-0.5 text-[11px] font-semibold text-viva-700">
                            {p.origem === 'MEDICO' ? 'App' : 'Precadastro'}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              p.presenteEm
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.presenteEm ? 'Presente' : 'Ausente'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExcluirParticipante({
                                id: p.id,
                                eventoId: selectedId!,
                                nome: p.nome,
                                email: p.email,
                              })
                            }
                            className="mt-0.5 rounded-lg border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                          >
                            Excluir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </>
          )}
        </section>
      </div>
      )}

      {detalhePrecadastro && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDetalhePrecadastro(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-viva-100 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detalhe-precadastro-titulo"
          >
            <header className="mb-4 space-y-1">
              <h3 id="detalhe-precadastro-titulo" className="text-lg font-semibold text-viva-950">
                Dados do precadastro
              </h3>
              <p className="text-sm text-viva-800 font-medium">{detalhePrecadastro.nome}</p>
            </header>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {(
                [
                  [
                    'Perfil',
                    detalhePrecadastro.perfil === 'ESTUDANTE'
                      ? 'Estudante'
                      : detalhePrecadastro.perfil === 'MEDICO'
                        ? 'Médico'
                        : '—',
                  ],
                  ['E-mail', detalhePrecadastro.email],
                  ['Telefone', detalhePrecadastro.telefone || '—'],
                  ['CPF', detalhePrecadastro.cpf || '—'],
                  ['CRM', detalhePrecadastro.crm || '—'],
                  ['Especialidade', detalhePrecadastro.especialidade || '—'],
                  ['Cidade', detalhePrecadastro.cidade || '—'],
                  ['Faculdade', detalhePrecadastro.faculdade || '—'],
                  ['Semestre', detalhePrecadastro.semestre || '—'],
                  [
                    'Liga acadêmica',
                    detalhePrecadastro.participaLiga
                      ? detalhePrecadastro.ligaNome || 'Sim'
                      : detalhePrecadastro.participaLiga === false
                        ? 'Não'
                        : '—',
                  ],
                  [
                    'Interesse corpo clínico',
                    detalhePrecadastro.interesseCorpoClinico ? 'Sim' : 'Não',
                  ],
                  [
                    'Consentimento LGPD',
                    detalhePrecadastro.consentimentoLgpd ? 'Sim' : 'Não',
                  ],
                  [
                    'Status no pipeline',
                    detalhePrecadastro.precadastroStatus === 'CONVERTIDO'
                      ? 'Já no corpo clínico'
                      : detalhePrecadastro.precadastroStatus === 'ACEITO'
                        ? 'Aceito — aguardando completar cadastro'
                        : 'Aguardando aceite da equipe',
                  ],
                  [
                    'Campos a completar',
                    (detalhePrecadastro.camposFaltantes || []).join(', ') || '—',
                  ],
                  [
                    'Presença',
                    detalhePrecadastro.presenteEm
                      ? `${new Date(detalhePrecadastro.presenteEm).toLocaleString('pt-BR')}${
                          detalhePrecadastro.presencaOrigem === 'APP'
                            ? ' · app'
                            : detalhePrecadastro.presencaOrigem === 'LINK_PUBLICO'
                              ? ' · link'
                              : ''
                        }`
                      : 'Não registrada',
                  ],
                  [
                    'Inscrito em',
                    new Date(detalhePrecadastro.createdAt).toLocaleString('pt-BR'),
                  ],
                  ['Conteúdo', detalhePrecadastro.evento.titulo],
                  [
                    'Data do conteúdo',
                    new Date(detalhePrecadastro.evento.iniciaEm).toLocaleString('pt-BR'),
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className={label === 'Conteúdo' || label === 'E-mail' ? 'sm:col-span-2' : ''}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-viva-500">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-viva-900 break-words">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap gap-2 justify-end">
              {detalhePrecadastro.precadastroStatus !== 'CONVERTIDO' && (
                <button
                  type="button"
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                  onClick={() => {
                    setSelectedPrecadastroIds([detalhePrecadastro.id]);
                    setDetalhePrecadastro(null);
                    setConfirmAceitar(true);
                  }}
                >
                  Aceitar e enviar e-mail
                </button>
              )}
              <button
                type="button"
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                onClick={() => {
                  setExcluirParticipante({
                    id: detalhePrecadastro.id,
                    eventoId: detalhePrecadastro.evento.id,
                    nome: detalhePrecadastro.nome,
                    email: detalhePrecadastro.email,
                  });
                  setDetalhePrecadastro(null);
                }}
              >
                Excluir
              </button>
              <button
                type="button"
                className="rounded-lg bg-viva-800 px-3 py-2 text-sm font-medium text-white hover:bg-viva-900"
                onClick={() => setDetalhePrecadastro(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAceitar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !aceitarPrecadastrosMutation.isPending && setConfirmAceitar(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-viva-100"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="aceitar-precadastro-titulo"
          >
            <h3 id="aceitar-precadastro-titulo" className="text-lg font-semibold text-viva-950 mb-2">
              Aceitar precadastro{selectedPrecadastroIds.length > 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-viva-700 mb-3">
              {selectedPrecadastroIds.length} pessoa(s) receberão e-mail com link para completar o cadastro.
              Ao finalizarem, entram no corpo clínico como <strong>ativos</strong> — sem passar pela área de
              Avaliação.
            </p>
            <p className="text-xs text-viva-600 mb-5">
              Se já existir médico com o mesmo e-mail/CPF, o aceite deste item será recusado.
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="rounded-lg border border-viva-200 px-3 py-2 text-sm font-medium text-viva-800 hover:bg-viva-50"
                onClick={() => setConfirmAceitar(false)}
                disabled={aceitarPrecadastrosMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-viva-800 px-3 py-2 text-sm font-medium text-white hover:bg-viva-900 disabled:opacity-60"
                disabled={aceitarPrecadastrosMutation.isPending || selectedPrecadastroIds.length === 0}
                onClick={() => aceitarPrecadastrosMutation.mutate(selectedPrecadastroIds)}
              >
                {aceitarPrecadastrosMutation.isPending ? 'Enviando…' : 'Confirmar aceite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {excluirParticipante && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !deleteParticipanteMutation.isPending && setExcluirParticipante(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-viva-100"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="excluir-participante-titulo"
          >
            <h3 id="excluir-participante-titulo" className="text-lg font-semibold text-viva-950 mb-2">
              Excluir participante?
            </h3>
            <p className="text-sm text-viva-800 mb-1">
              <span className="font-semibold">{excluirParticipante.nome}</span>
            </p>
            <p className="text-xs text-viva-600 mb-1">{excluirParticipante.email}</p>
            <p className="text-sm text-viva-600 mb-5">
              A pessoa será removida da lista de participantes deste conteúdo e, se for precadastro,
              também da lista unificada de precadastros. Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="rounded-lg border border-viva-200 px-3 py-2 text-sm font-medium text-viva-800 hover:bg-viva-50"
                onClick={() => setExcluirParticipante(null)}
                disabled={deleteParticipanteMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                disabled={deleteParticipanteMutation.isPending}
                onClick={() =>
                  deleteParticipanteMutation.mutate({
                    eventoId: excluirParticipante.eventoId,
                    id: excluirParticipante.id,
                  })
                }
              >
                {deleteParticipanteMutation.isPending ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConteudosAdminPage;
