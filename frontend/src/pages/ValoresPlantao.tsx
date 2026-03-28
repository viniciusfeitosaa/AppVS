import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService, ConfigPontoEletronico, TipoPlantaoConfig, ValorPlantaoConfig } from '../services/admin.service';

function formatValor(valor: string | number | null | undefined): string {
  if (valor == null || valor === '') return '';
  const n = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseValorInput(s: string): number | null {
  const v = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

const ValoresPlantao = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const [contratoId, setContratoId] = useState<string>('');
  const [subgrupoId, setSubgrupoId] = useState<string>('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftEndereco, setDraftEndereco] = useState('');
  const [draftLatitude, setDraftLatitude] = useState('');
  const [draftLongitude, setDraftLongitude] = useState('');
  const [draftRaioMetros, setDraftRaioMetros] = useState('');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [enderecoSugestoes, setEnderecoSugestoes] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [enderecoDropdownOpen, setEnderecoDropdownOpen] = useState(false);
  const [enderecoBuscando, setEnderecoBuscando] = useState(false);
  const enderecoContainerRef = useRef<HTMLDivElement>(null);
  const [savingGeo, setSavingGeo] = useState(false);
  const [savedGeo, setSavedGeo] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoHi, setNovoTipoHi] = useState('08:00');
  const [novoTipoHf, setNovoTipoHf] = useState('20:00');
  const [novoTipoCruza, setNovoTipoCruza] = useState(false);
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [excluindoTipoId, setExcluindoTipoId] = useState<string | null>(null);
  const [excluirTipoModal, setExcluirTipoModal] = useState<{ id: string; nome: string } | null>(null);
  const [editarTipoModal, setEditarTipoModal] = useState<TipoPlantaoConfig | null>(null);
  const [salvandoEdicaoTipo, setSalvandoEdicaoTipo] = useState(false);

  const { data: opcoesResp, isLoading: loadingOpcoes } = useQuery({
    queryKey: ['admin', 'valores-plantao', 'opcoes'],
    queryFn: () => adminService.getValoresPlantaoOpcoes(),
    enabled: !!user && isMaster,
  });

  const opcoes = opcoesResp?.data;
  const contratos = useMemo(() => opcoes?.contratos ?? [], [opcoes]);
  const subgrupos = useMemo(() => opcoes?.subgrupos ?? [], [opcoes]);
  const contratoSubgrupos = useMemo(() => opcoes?.contratoSubgrupos ?? [], [opcoes]);
  const temContratoESubgrupo = !!contratoId && !!subgrupoId;

  const allowedSubgrupoIds = useMemo(() => {
    if (!contratoId) return new Set<string>();
    return new Set(
      contratoSubgrupos
        .filter((cs) => cs.contratoAtivoId === contratoId)
        .map((cs) => cs.subgrupoId)
    );
  }, [contratoId, contratoSubgrupos]);

  const subgruposDoContrato = useMemo(() => {
    if (!contratoId) return [];
    return subgrupos
      .filter((s) => s.ativo !== false)
      .filter((s) => allowedSubgrupoIds.has(s.id));
  }, [allowedSubgrupoIds, contratoId, subgrupos]);

  const contratosEscalaEPonto = useMemo(
    () => contratos.filter((c: any) => Boolean(c?.usaEscala && c?.usaPonto)),
    [contratos]
  );

  const { data: tiposResp, isLoading: loadingTipos } = useQuery({
    queryKey: ['admin', 'tipos-plantao', contratoId],
    queryFn: () => adminService.listTiposPlantao(contratoId),
    enabled: !!user && isMaster && temContratoESubgrupo,
  });
  const tiposPlantao = tiposResp?.data ?? [];

  const { data: resp, isLoading: loadingValores } = useQuery({
    queryKey: ['admin', 'valores-plantao', contratoId, subgrupoId],
    queryFn: () => adminService.getValoresPlantao(contratoId, subgrupoId),
    enabled: !!user && isMaster && temContratoESubgrupo,
  });

  const { data: configPontoResp, isLoading: loadingConfigPonto } = useQuery({
    queryKey: ['admin', 'config-ponto', contratoId, subgrupoId, null],
    queryFn: () => adminService.getConfigPonto(contratoId, subgrupoId, null),
    enabled: !!user && isMaster && temContratoESubgrupo,
  });

  const valores = resp?.data ?? [];
  const configPonto: ConfigPontoEletronico | null = configPontoResp?.data ?? null;

  useEffect(() => {
    if (!savedGeo) return;
    const t = setTimeout(() => setSavedGeo(false), 2500);
    return () => clearTimeout(t);
  }, [savedGeo]);

  useEffect(() => {
    const query = draftEndereco.trim();
    if (query.length < 3) {
      setEnderecoSugestoes([]);
      setEnderecoDropdownOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setEnderecoBuscando(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
          { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'GymApp-Ponto/1.0' } }
        );
        const data = await res.json();
        setEnderecoSugestoes(Array.isArray(data) ? data : []);
        setEnderecoDropdownOpen(true);
      } catch {
        setEnderecoSugestoes([]);
      } finally {
        setEnderecoBuscando(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [draftEndereco]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (enderecoContainerRef.current && !enderecoContainerRef.current.contains(e.target as Node)) {
        setEnderecoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const enderecoDisplay = draftEndereco !== '' ? draftEndereco : (configPonto?.enderecoPonto ?? '');
  const latitudeDisplay =
    draftLatitude !== '' ? draftLatitude : configPonto?.latitude != null && configPonto?.latitude !== '' ? String(configPonto.latitude) : '';
  const longitudeDisplay =
    draftLongitude !== '' ? draftLongitude : configPonto?.longitude != null && configPonto?.longitude !== '' ? String(configPonto.longitude) : '';
  const raioMetrosDisplay =
    draftRaioMetros !== '' ? draftRaioMetros : configPonto?.raioMetros != null ? String(configPonto.raioMetros) : '';
  const temCoordenadas = latitudeDisplay !== '' && longitudeDisplay !== '';

  const getValorForGrade = (gradeId: string): string => {
    if (draft[gradeId] !== undefined) return draft[gradeId];
    const row = valores.find((v: ValorPlantaoConfig) => v.gradeId === gradeId);
    if (row?.valorHora != null) return formatValor(row.valorHora);
    return '';
  };

  const handleSave = async (gradeId: string) => {
    if (!contratoId || !subgrupoId) return;
    setSaving(gradeId);
    setError(null);
    setSuccess(null);
    try {
      const valorStr = getValorForGrade(gradeId);
      const valor = parseValorInput(valorStr);
      await adminService.setValorPlantao(contratoId, subgrupoId, gradeId, valor);
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'valores-plantao', contratoId, subgrupoId],
      });
      setDraft((prev) => {
        const next = { ...prev };
        delete next[gradeId];
        return next;
      });
      const nomeTipo = tiposPlantao.find((t) => t.id === gradeId)?.nome;
      setSuccess(`Valor do plantão ${nomeTipo ?? 'atualizado'} salvo.`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar valor');
    } finally {
      setSaving(null);
    }
  };

  const limparRascunhosGeo = () => {
    setDraftEndereco('');
    setDraftLatitude('');
    setDraftLongitude('');
    setDraftRaioMetros('');
    setGeocodeError(null);
    setEnderecoSugestoes([]);
    setEnderecoDropdownOpen(false);
  };

  const onContratoChange = (id: string) => {
    setContratoId(id);
    setSubgrupoId('');
    setDraft({});
    limparRascunhosGeo();
    setNovoTipoNome('');
    setNovoTipoHi('08:00');
    setNovoTipoHf('20:00');
    setNovoTipoCruza(false);
  };

  const onSubgrupoChange = (id: string) => {
    setSubgrupoId(id);
    setDraft({});
    limparRascunhosGeo();
  };

  const buscarCoordenadas = async () => {
    const endereco = (draftEndereco !== '' ? draftEndereco : configPonto?.enderecoPonto ?? '').trim();
    if (!endereco) {
      setGeocodeError('Digite um endereço.');
      return;
    }
    setGeocoding(true);
    setGeocodeError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endereco)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'GymApp-Ponto/1.0' } }
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setGeocodeError('Endereço não encontrado. Tente ser mais específico (cidade, estado).');
        return;
      }
      const { lat, lon } = data[0];
      setDraftLatitude(String(Number(lat).toFixed(6)));
      setDraftLongitude(String(Number(lon).toFixed(6)));
    } catch {
      setGeocodeError('Erro ao buscar coordenadas. Tente novamente.');
    } finally {
      setGeocoding(false);
    }
  };

  const usarMinhaLocalizacao = () => {
    if (!navigator.geolocation) {
      setGeocodeError('Geolocalização não é suportada neste navegador.');
      return;
    }
    setGeocodeError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraftLatitude(pos.coords.latitude.toFixed(6));
        setDraftLongitude(pos.coords.longitude.toFixed(6));
      },
      () => setGeocodeError('Não foi possível obter sua localização. Verifique as permissões do navegador.')
    );
  };

  const selecionarEndereco = (item: { display_name: string; lat: string; lon: string }) => {
    setDraftEndereco(item.display_name);
    setDraftLatitude(String(Number(item.lat).toFixed(6)));
    setDraftLongitude(String(Number(item.lon).toFixed(6)));
    setEnderecoSugestoes([]);
    setEnderecoDropdownOpen(false);
    setGeocodeError(null);
  };

  const handleSaveGeo = async () => {
    if (!contratoId || !subgrupoId) return;
    setSavingGeo(true);
    setError(null);
    setSuccess(null);
    try {
      const cfg = configPonto;
      const horas = cfg?.horasPrevistasMes ?? null;
      const valor = cfg?.valorHora != null ? parseFloat(String(cfg.valorHora)) : null;
      const valorCobranca =
        cfg?.valorHoraCobranca != null ? parseFloat(String(cfg.valorHoraCobranca)) : null;
      const horarioEntrada = cfg?.horarioEntrada ?? null;
      const horarioSaida = cfg?.horarioSaida ?? null;
      const toleranciaMinutos = cfg?.toleranciaMinutos ?? null;

      const enderecoSalvar =
        draftEndereco !== '' ? draftEndereco.trim() || null : cfg?.enderecoPonto?.trim() || null;
      const lat =
        draftLatitude !== ''
          ? parseFloat(draftLatitude.replace(',', '.'))
          : cfg?.latitude != null && cfg?.latitude !== ''
            ? parseFloat(String(cfg.latitude))
            : null;
      const lng =
        draftLongitude !== ''
          ? parseFloat(draftLongitude.replace(',', '.'))
          : cfg?.longitude != null && cfg?.longitude !== ''
            ? parseFloat(String(cfg.longitude))
            : null;
      const raio =
        draftRaioMetros !== '' ? parseInt(draftRaioMetros, 10) : cfg?.raioMetros ?? null;
      const raioMetros = raio != null && !Number.isNaN(raio) && raio >= 0 ? raio : null;

      await adminService.setConfigPonto(contratoId, subgrupoId, null, {
        horasPrevistasMes: horas ?? null,
        valorHora: valor,
        valorHoraCobranca: valorCobranca,
        horarioEntrada: horarioEntrada || null,
        horarioSaida: horarioSaida || null,
        toleranciaMinutos: toleranciaMinutos != null && toleranciaMinutos >= 0 ? toleranciaMinutos : null,
        latitude: lat != null && !Number.isNaN(lat) ? lat : null,
        longitude: lng != null && !Number.isNaN(lng) ? lng : null,
        raioMetros,
        enderecoPonto: enderecoSalvar,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'config-ponto', contratoId, subgrupoId, null] });
      limparRascunhosGeo();
      setSuccess('Localização do ponto salva com sucesso.');
      setSavedGeo(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar localização do ponto.');
    } finally {
      setSavingGeo(false);
    }
  };

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Somente o perfil Master pode configurar valores de plantão.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">Valores Hora/Plantão</h2>
        <p className="text-gray-600">
          Escolha contrato e subgrupo abaixo. Em seguida aparecem os tipos de plantão do contrato e o{' '}
          <strong>valor total de cada turno</strong> (por tipo) neste subgrupo; o relatório converte em valor/hora
          usando a duração do horário do tipo. Opcional: local do ponto.
        </p>
      </div>

      {error && (
        <div className="card border-l-4 border-red-400">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="card border-l-4 border-green-400">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-4">Contrato e subgrupo</h3>
        {loadingOpcoes ? (
          <p className="text-sm text-gray-600">Carregando opções...</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            <div className="min-w-[200px]">
              <label className="block text-sm font-semibold text-viva-800 mb-1">Contrato</label>
              <select
                className="input w-full"
                value={contratoId}
                onChange={(e) => onContratoChange(e.target.value)}
              >
                <option value="">Selecione o contrato</option>
                {contratosEscalaEPonto.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px]">
              <label className="block text-sm font-semibold text-viva-800 mb-1">Subgrupo</label>
              <select
                className="input w-full"
                value={subgrupoId}
                onChange={(e) => onSubgrupoChange(e.target.value)}
                disabled={!contratoId}
              >
                <option value="">{contratoId ? 'Selecione o subgrupo' : 'Selecione o contrato primeiro'}</option>
                {subgruposDoContrato.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {temContratoESubgrupo && (
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-4">Tipos de plantão (contrato)</h3>
          <p className="text-sm text-viva-700 mb-4">
            Cada tipo tem nome e faixa de horário (usada na grade, calendário, troca e ponto). Os padrões MT/SN são
            criados automaticamente na primeira carga.
          </p>
          {loadingTipos ? (
            <p className="text-sm text-gray-600">Carregando tipos...</p>
          ) : (
            <>
              <div className="space-y-3 mb-6">
                {tiposPlantao.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-viva-200 bg-white"
                  >
                    <div>
                      <p className="text-sm font-semibold text-viva-900">{t.nome}</p>
                      <p className="text-xs text-viva-600">
                        {t.horaInicio.slice(0, 5)} – {t.horaFim.slice(0, 5)}
                        {t.cruzaMeiaNoite ? ' (cruza meia-noite)' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary text-sm py-1.5 px-3"
                        disabled={excluindoTipoId === t.id || salvandoEdicaoTipo}
                        onClick={() => setEditarTipoModal({ ...t })}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary text-sm py-1.5 px-3"
                        disabled={excluindoTipoId === t.id || salvandoEdicaoTipo}
                        onClick={() => setExcluirTipoModal({ id: t.id, nome: t.nome })}
                      >
                        {excluindoTipoId === t.id ? '…' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl border border-dashed border-viva-300 bg-viva-50/40 space-y-3">
                <p className="text-sm font-semibold text-viva-800">Novo tipo</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="min-w-[200px] flex-1">
                    <label className="block text-xs font-semibold text-viva-800 mb-1">Nome</label>
                    <input
                      className="input w-full"
                      placeholder="Ex.: Plantão vespertino"
                      value={novoTipoNome}
                      onChange={(e) => setNovoTipoNome(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[8.75rem]">
                    <label className="block text-xs font-semibold text-viva-800 mb-1">Início</label>
                    <input
                      type="time"
                      step={60}
                      className="input-time"
                      value={novoTipoHi}
                      onChange={(e) => setNovoTipoHi(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[8.75rem]">
                    <label className="block text-xs font-semibold text-viva-800 mb-1">Fim</label>
                    <input
                      type="time"
                      step={60}
                      className="input-time"
                      value={novoTipoHf}
                      onChange={(e) => setNovoTipoHf(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-viva-800 cursor-pointer pb-1">
                    <input
                      type="checkbox"
                      checked={novoTipoCruza}
                      onChange={(e) => setNovoTipoCruza(e.target.checked)}
                    />
                    Cruza meia-noite
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={criandoTipo || !novoTipoNome.trim()}
                    onClick={async () => {
                      setCriandoTipo(true);
                      setError(null);
                      setSuccess(null);
                      try {
                        await adminService.createTipoPlantao({
                          contratoAtivoId: contratoId,
                          nome: novoTipoNome.trim(),
                          horaInicio: novoTipoHi.length === 5 ? novoTipoHi : `${novoTipoHi}:00`.slice(0, 5),
                          horaFim: novoTipoHf.length === 5 ? novoTipoHf : `${novoTipoHf}:00`.slice(0, 5),
                          cruzaMeiaNoite: novoTipoCruza,
                        });
                        setNovoTipoNome('');
                        setNovoTipoCruza(false);
                        await queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] });
                        setSuccess('Tipo de plantão criado.');
                      } catch (err: any) {
                        setError(err.response?.data?.error || 'Erro ao criar tipo');
                      } finally {
                        setCriandoTipo(false);
                      }
                    }}
                  >
                    {criandoTipo ? 'Salvando...' : 'Adicionar tipo'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {temContratoESubgrupo && (
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-4">Valor por tipo de plantão</h3>
          {loadingValores ? (
            <p className="text-sm text-gray-600">Carregando valores...</p>
          ) : tiposPlantao.length === 0 ? (
            <p className="text-sm text-viva-700">Carregue os tipos do contrato acima.</p>
          ) : (
            <div className="space-y-6">
              {tiposPlantao.map((grade) => (
                <div
                  key={grade.id}
                  className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-viva-200 bg-viva-50/30"
                >
                  <div className="min-w-[200px]">
                    <label className="block text-sm font-semibold text-viva-800 mb-1">
                      {grade.nome}{' '}
                      <span className="font-normal text-viva-600">
                        ({grade.horaInicio.slice(0, 5)}–{grade.horaFim.slice(0, 5)})
                      </span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input w-full max-w-[180px]"
                      placeholder="Ex: 150,00"
                      value={getValorForGrade(grade.id)}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [grade.id]: e.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSave(grade.id)}
                    disabled={saving === grade.id}
                  >
                    {saving === grade.id ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {temContratoESubgrupo && (
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-4">Localização do ponto (opcional)</h3>
          {loadingConfigPonto ? (
            <p className="text-sm text-gray-600">Carregando configuração de ponto...</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-viva-200 bg-viva-50/30">
                <div className="min-w-[280px] flex-1 relative" ref={enderecoContainerRef}>
                  <label className="block text-sm font-semibold text-viva-800 mb-1">Endereço</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Digite para buscar (ex.: Rua X, 123 - Fortaleza/CE)"
                    value={enderecoDisplay}
                    onChange={(e) => {
                      setDraftEndereco(e.target.value);
                      setGeocodeError(null);
                    }}
                    onFocus={() => enderecoSugestoes.length > 0 && setEnderecoDropdownOpen(true)}
                    autoComplete="off"
                  />
                  {enderecoBuscando && <p className="text-xs text-viva-600 mt-1">Buscando endereços...</p>}
                  {enderecoDropdownOpen && enderecoSugestoes.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 mt-1 py-1 bg-white border border-viva-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                      {enderecoSugestoes.map((item, i) => (
                        <li
                          key={`${item.lat}-${item.lon}-${i}`}
                          role="option"
                          className="px-3 py-2 text-sm text-viva-800 cursor-pointer hover:bg-viva-100 truncate"
                          onClick={() => selecionarEndereco(item)}
                        >
                          {item.display_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="button" className="btn btn-secondary" onClick={buscarCoordenadas} disabled={geocoding}>
                  {geocoding ? 'Buscando...' : 'Buscar coordenadas'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={usarMinhaLocalizacao}>
                  Usar minha localização atual
                </button>
              </div>
              {geocodeError && <p className="text-sm text-red-600 mt-2">{geocodeError}</p>}
              {temCoordenadas && (
                <p className="text-sm text-viva-700 mt-2">
                  Coordenadas definidas: {latitudeDisplay}, {longitudeDisplay}
                </p>
              )}
              <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-viva-200 bg-viva-50/30 mt-3">
                <div className="min-w-[140px]">
                  <label className="block text-sm font-semibold text-viva-800 mb-1">Raio (metros)</label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    step={10}
                    className="input w-full max-w-[120px]"
                    placeholder="Ex: 200"
                    value={raioMetrosDisplay}
                    onChange={(e) => setDraftRaioMetros(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className={`btn ${savedGeo ? 'bg-green-600 hover:bg-green-700 border-green-700' : 'btn-primary'}`}
                  onClick={handleSaveGeo}
                  disabled={savingGeo}
                >
                  {savingGeo ? 'Salvando...' : savedGeo ? 'Salvo!' : 'Salvar'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {editarTipoModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onClick={() => !salvandoEdicaoTipo && setEditarTipoModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4 border border-viva-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-tipo-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="editar-tipo-titulo" className="text-lg font-bold text-viva-900 font-display">
              Editar tipo de plantão
            </h3>
            <p className="text-xs text-viva-600">
              O identificador na escala não muda; calendário, troca e ponto passam a usar o novo nome e horários.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-viva-800 mb-1">Nome</label>
                <input
                  className="input w-full"
                  value={editarTipoModal.nome}
                  onChange={(e) => setEditarTipoModal((m) => (m ? { ...m, nome: e.target.value } : m))}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[8.75rem]">
                  <label className="block text-xs font-semibold text-viva-800 mb-1">Início</label>
                  <input
                    type="time"
                    step={60}
                    className="input-time"
                    value={editarTipoModal.horaInicio.slice(0, 5)}
                    onChange={(e) =>
                      setEditarTipoModal((m) => (m ? { ...m, horaInicio: e.target.value } : m))
                    }
                  />
                </div>
                <div className="min-w-[8.75rem]">
                  <label className="block text-xs font-semibold text-viva-800 mb-1">Fim</label>
                  <input
                    type="time"
                    step={60}
                    className="input-time"
                    value={editarTipoModal.horaFim.slice(0, 5)}
                    onChange={(e) =>
                      setEditarTipoModal((m) => (m ? { ...m, horaFim: e.target.value } : m))
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-viva-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editarTipoModal.cruzaMeiaNoite}
                  onChange={(e) =>
                    setEditarTipoModal((m) => (m ? { ...m, cruzaMeiaNoite: e.target.checked } : m))
                  }
                />
                Cruza meia-noite
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={salvandoEdicaoTipo}
                onClick={() => setEditarTipoModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={salvandoEdicaoTipo || !editarTipoModal.nome.trim()}
                onClick={async () => {
                  const m = editarTipoModal;
                  const hi = m.horaInicio.length >= 5 ? m.horaInicio.slice(0, 5) : m.horaInicio;
                  const hf = m.horaFim.length >= 5 ? m.horaFim.slice(0, 5) : m.horaFim;
                  setSalvandoEdicaoTipo(true);
                  setError(null);
                  setSuccess(null);
                  try {
                    await adminService.updateTipoPlantao(m.id, {
                      nome: m.nome.trim(),
                      horaInicio: hi,
                      horaFim: hf,
                      cruzaMeiaNoite: m.cruzaMeiaNoite,
                    });
                    await queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] });
                    setEditarTipoModal(null);
                    setSuccess('Tipo atualizado.');
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Não foi possível salvar');
                  } finally {
                    setSalvandoEdicaoTipo(false);
                  }
                }}
              >
                {salvandoEdicaoTipo ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {excluirTipoModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onClick={() => !excluindoTipoId && setExcluirTipoModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4 border border-viva-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="excluir-tipo-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="excluir-tipo-titulo" className="text-lg font-bold text-viva-900 font-display">
              Excluir tipo de plantão?
            </h3>
            <p className="text-sm text-viva-700 leading-relaxed">
              O tipo <span className="font-semibold text-viva-900">{excluirTipoModal.nome}</span> será removido
              permanentemente. Valores por subgrupo e adicionais por data deste tipo serão apagados junto. A exclusão
              só é bloqueada se ainda existir <span className="font-semibold">plantão agendado na escala</span> usando
              este tipo.
            </p>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!!excluindoTipoId}
                onClick={() => setExcluirTipoModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 border border-red-700 disabled:opacity-60"
                disabled={!!excluindoTipoId}
                onClick={async () => {
                  const id = excluirTipoModal.id;
                  setExcluindoTipoId(id);
                  setError(null);
                  try {
                    await adminService.deleteTipoPlantao(id);
                    await queryClient.invalidateQueries({ queryKey: ['admin', 'tipos-plantao'] });
                    await queryClient.invalidateQueries({ queryKey: ['admin', 'valores-plantao', contratoId] });
                    setSuccess('Tipo removido.');
                    setExcluirTipoModal(null);
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Não foi possível excluir');
                  } finally {
                    setExcluindoTipoId(null);
                  }
                }}
              >
                {excluindoTipoId ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValoresPlantao;
