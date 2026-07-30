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
import { AuthImage } from '../components/AuthImage';

function statusLabel(s: ConteudoEventoStatus) {
  if (s === 'PUBLICADO') return 'Publicado';
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
      if (action === 'publicar') return conteudoAdminService.publicar(selectedId);
      if (action === 'encerrar') return conteudoAdminService.encerrar(selectedId);
      return conteudoAdminService.rascunho(selectedId);
    },
    onSuccess: async () => {
      setOkMsg('Status atualizado');
      await invalidate();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Falha na ação');
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
            Cadastre eventos e capture participantes como precadastro do corpo clínico.
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
          <div className="px-4 py-3 border-b border-viva-100">
            <h2 className="font-semibold text-viva-900">Precadastros (corpo clínico)</h2>
            <p className="text-xs text-viva-600 mt-1">
              Todos os inscritos externos dos conteúdos, com dados mínimos em um só lugar.
            </p>
          </div>
          {precadastrosQuery.isLoading ? (
            <p className="p-4 text-sm text-viva-600">Carregando…</p>
          ) : (precadastrosQuery.data || []).length === 0 ? (
            <p className="p-4 text-sm text-viva-600">Nenhum precadastro ainda.</p>
          ) : (
            <ul className="divide-y divide-viva-100">
              {(precadastrosQuery.data || []).map((p: ConteudoPrecadastro) => (
                <li key={p.id} className="px-4 py-3 space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-viva-950">{p.resumo}</p>
                    <span className="text-[11px] text-viva-500 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs text-viva-600">
                    Conteúdo: {p.evento.titulo} · {new Date(p.evento.iniciaEm).toLocaleString('pt-BR')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
      <div className="grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <form onSubmit={onCreate} className="rounded-2xl border border-viva-200 bg-white p-4 space-y-3">
            <h2 className="font-semibold text-viva-900">Novo conteúdo</h2>
            <input
              className="w-full rounded-lg border border-viva-200 px-3 py-2 text-sm"
              placeholder="Nome do conteúdo"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              disabled={!!selectedId}
            />
            {!selectedId && (
              <>
                <input
                  className="w-full rounded-lg border border-viva-200 px-3 py-2 text-sm"
                  placeholder="Link do YouTube (opcional no rascunho)"
                  value={form.youtubeUrl}
                  onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
                />
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-viva-200 px-3 py-2 text-sm"
                  value={form.iniciaEm}
                  onChange={(e) => setForm((f) => ({ ...f, iniciaEm: e.target.value }))}
                />
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full rounded-lg bg-viva-800 text-white py-2 text-sm font-medium hover:bg-viva-900 disabled:opacity-60"
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

        <section className="lg:col-span-3 space-y-4">
          {!selectedId || !evento ? (
            <div className="rounded-2xl border border-dashed border-viva-300 bg-viva-50/50 p-10 text-center text-viva-700 text-sm">
              Selecione um conteúdo na lista ou crie um novo.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-viva-200 bg-white p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-viva-900">Editar</h2>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusClass(evento.status)}`}>
                    {statusLabel(evento.status)}
                  </span>
                </div>
                <p className="text-xs text-viva-600 leading-relaxed">
                  {evento.status === 'RASCUNHO' &&
                    'Rascunho: só a equipe vê. Médicos e links públicos de inscrição ficam fechados até publicar.'}
                  {evento.status === 'PUBLICADO' &&
                    'Publicado: médicos veem na lista e podem participar. Link externo de inscrição ativo.'}
                  {evento.status === 'ENCERRADO' &&
                    'Encerrado: ainda aparece para consulta, mas novas inscrições (app e link) ficam bloqueadas.'}
                </p>

                <label className="block text-sm space-y-1">
                  <span className="text-viva-700">Título</span>
                  <input
                    className="w-full rounded-lg border border-viva-200 px-3 py-2"
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  />
                </label>
                <label className="block text-sm space-y-1">
                  <span className="text-viva-700">YouTube (opcional no rascunho; obrigatório para publicar)</span>
                  <input
                    className="w-full rounded-lg border border-viva-200 px-3 py-2"
                    value={form.youtubeUrl}
                    onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
                  />
                </label>
                {evento.youtubeEmbedUrl && (
                  <div className="aspect-video w-full overflow-hidden rounded-xl border border-viva-200 bg-black">
                    <iframe
                      title="Prévia YouTube"
                      src={evento.youtubeEmbedUrl}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                <label className="block text-sm space-y-1">
                  <span className="text-viva-700">Data e hora</span>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-viva-200 px-3 py-2"
                    value={form.iniciaEm}
                    onChange={(e) => setForm((f) => ({ ...f, iniciaEm: e.target.value }))}
                  />
                </label>
                <label className="block text-sm space-y-1">
                  <span className="text-viva-700">Descrição</span>
                  <textarea
                    className="w-full rounded-lg border border-viva-200 px-3 py-2 min-h-[80px]"
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-sm text-viva-700">Capa</span>
                  {evento.capaUrl && (
                    <AuthImage
                      key={evento.updatedAt || evento.capaUrl}
                      apiPath={`/admin/conteudos/eventos/${evento.id}/capa`}
                      alt="Capa"
                      className="w-full max-h-48 object-cover rounded-xl border border-viva-100"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) capaMutation.mutate(file);
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="rounded-lg bg-viva-800 text-white px-4 py-2 text-sm"
                  >
                    Salvar
                  </button>
                  {evento.status !== 'PUBLICADO' && (
                    <button
                      type="button"
                      onClick={() => actionMutation.mutate('publicar')}
                      className="rounded-lg bg-emerald-700 text-white px-4 py-2 text-sm"
                    >
                      Publicar
                    </button>
                  )}
                  {evento.status === 'PUBLICADO' && (
                    <button
                      type="button"
                      onClick={() => actionMutation.mutate('encerrar')}
                      className="rounded-lg bg-slate-700 text-white px-4 py-2 text-sm"
                    >
                      Encerrar
                    </button>
                  )}
                  {evento.status !== 'RASCUNHO' && (
                    <button
                      type="button"
                      onClick={() => actionMutation.mutate('rascunho')}
                      className="rounded-lg border border-viva-300 px-4 py-2 text-sm"
                    >
                      Voltar a rascunho
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-viva-200 bg-white p-4 space-y-3">
                <h3 className="font-semibold text-viva-900">Palestrante</h3>
                <p className="text-xs text-viva-600">
                  Escolha um já cadastrado e salve, ou convide um novo pelo e-mail — ele preenche o formulário no
                  link abaixo.
                </p>
                {evento.palestrante && (
                  <p className="text-sm text-viva-800">
                    {evento.palestrante.nome} · {evento.palestrante.email}{' '}
                    <span className="text-xs text-viva-500">
                      (
                      {evento.palestrante.status === 'COMPLETO'
                        ? 'cadastro completo'
                        : 'aguardando formulário'}
                      )
                    </span>
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-viva-200 px-3 py-2 text-sm"
                    placeholder="Buscar palestrante existente"
                    value={palSearch}
                    onChange={(e) => setPalSearch(e.target.value)}
                  />
                  <select
                    className="rounded-lg border border-viva-200 px-3 py-2 text-sm"
                    value={selectedPalId}
                    onChange={(e) => setSelectedPalId(e.target.value)}
                  >
                    <option value="">Sem palestrante / novo convite</option>
                    {palestrantes.map((p: ConteudoPalestrante) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-viva-200 px-3 py-2 text-sm"
                    placeholder="Nome (novo)"
                    value={palNome}
                    onChange={(e) => setPalNome(e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-viva-200 px-3 py-2 text-sm"
                    placeholder="E-mail (novo)"
                    value={palEmail}
                    onChange={(e) => setPalEmail(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => conviteMutation.mutate()}
                  disabled={conviteMutation.isPending}
                  className="rounded-lg border border-viva-300 px-3 py-2 text-sm"
                >
                  {conviteMutation.isPending ? 'Gerando…' : 'Convidar novo palestrante'}
                </button>
                {evento.linkPalestrante && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-viva-800">
                      Link do formulário do palestrante (envie por WhatsApp/e-mail)
                    </p>
                    <div className="flex flex-wrap gap-2 items-center text-sm">
                      <code className="text-xs bg-viva-50 px-2 py-1 rounded break-all flex-1">
                        {evento.linkPalestrante}
                      </code>
                      <button
                        type="button"
                        className="text-viva-800 underline"
                        onClick={async () => {
                          await copyText(evento.linkPalestrante!);
                          setOkMsg('Link do palestrante copiado');
                        }}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-viva-200 bg-white p-4 space-y-3">
                <h3 className="font-semibold text-viva-900">Participantes</h3>
                <p className="text-xs text-viva-600">
                  Médicos se inscrevem pelo app. Externos usam o link abaixo (precadastro com dados
                  mínimos; só funciona com status Publicado).
                </p>
                {evento.linkInscricao && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-viva-800">Link público de inscrição</p>
                    <div className="flex flex-wrap gap-2 items-center text-sm">
                      <code className="text-xs bg-viva-50 px-2 py-1 rounded break-all flex-1">
                        {evento.linkInscricao}
                      </code>
                      <button
                        type="button"
                        className="text-viva-800 underline"
                        onClick={async () => {
                          await copyText(evento.linkInscricao!);
                          setOkMsg('Link de inscrição copiado');
                        }}
                      >
                        Copiar link
                      </button>
                    </div>
                  </div>
                )}
                <ul className="divide-y divide-viva-100 max-h-56 overflow-auto text-sm">
                  {(participantesQuery.data || []).map((p: ConteudoParticipante) => (
                    <li key={p.id} className="py-2 space-y-0.5">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-viva-900">
                          {[
                            p.nome,
                            p.email,
                            p.telefone,
                            p.crm ? `CRM ${p.crm}` : null,
                            p.especialidade,
                            p.cidade,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span className="text-xs text-viva-500 shrink-0">
                          {p.origem === 'MEDICO' ? 'App' : 'Precadastro'}
                        </span>
                      </div>
                    </li>
                  ))}
                  {(participantesQuery.data || []).length === 0 && (
                    <li className="py-2 text-viva-600">Nenhum participante ainda.</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </section>
      </div>
      )}
    </div>
  );
};

export default ConteudosAdminPage;
