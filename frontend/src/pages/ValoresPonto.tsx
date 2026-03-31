import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService, ConfigPontoEletronico } from '../services/admin.service';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Retorna a quantidade de dias úteis (segunda a sexta) no mês. mes: 1-12 */
function getDiasUteis(ano: number, mes: number): number {
  const primeiro = new Date(ano, mes - 1, 1);
  const ultimo = new Date(ano, mes, 0);
  let count = 0;
  for (let d = new Date(primeiro); d <= ultimo; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay();
    if (diaSemana >= 1 && diaSemana <= 5) count++;
  }
  return count;
}

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

const DIAS_SEMANA = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
] as const;

const mapaVazioPorDia = (): Record<string, string> =>
  Object.fromEntries(DIAS_SEMANA.map(({ key }) => [key, ''])) as Record<string, string>;

/** Monta mapa numérico seg→dom + primeiro valor não nulo (fallback global no backend). */
function buildMapaValorPorDiaComFallback(draft: Record<string, string>): {
  map: Record<string, number | null>;
  fallbackGlobal: number | null;
} {
  const map: Record<string, number | null> = {};
  let fallbackGlobal: number | null = null;
  for (const { key } of DIAS_SEMANA) {
    const raw = draft[key] ?? '';
    if (raw.trim() === '') {
      map[key] = null;
    } else {
      const n = parseValorInput(raw);
      const rounded = n != null ? Math.round(n * 100) / 100 : null;
      map[key] = rounded;
      if (fallbackGlobal == null && rounded != null) fallbackGlobal = rounded;
    }
  }
  return { map, fallbackGlobal };
}

const ValoresPonto = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const [contratoId, setContratoId] = useState<string>('');
  const [subgrupoId, setSubgrupoId] = useState<string>('');
  const [equipeId, setEquipeId] = useState<string>(''); // '' = Subgrupo (todas as equipes)
  const [mes, setMes] = useState<number>(() => new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(() => new Date().getFullYear());
  const [draftHoras, setDraftHoras] = useState<string>('');
  const [draftValorPorDia, setDraftValorPorDia] = useState<Record<string, string>>({});
  const [draftValorCobrancaPorDia, setDraftValorCobrancaPorDia] = useState<Record<string, string>>({});
  const [draftHorarioEntrada, setDraftHorarioEntrada] = useState<string>('');
  const [draftHorarioSaida, setDraftHorarioSaida] = useState<string>('');
  const [draftTolerancia, setDraftTolerancia] = useState<string>('');
  const [draftEndereco, setDraftEndereco] = useState<string>('');
  const [draftLatitude, setDraftLatitude] = useState<string>('');
  const [draftLongitude, setDraftLongitude] = useState<string>('');
  const [draftRaioMetros, setDraftRaioMetros] = useState<string>('');
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [enderecoSugestoes, setEnderecoSugestoes] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [enderecoDropdownOpen, setEnderecoDropdownOpen] = useState(false);
  const [enderecoBuscando, setEnderecoBuscando] = useState(false);
  const enderecoContainerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

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

  const { data: opcoesResp, isLoading: loadingOpcoes } = useQuery({
    queryKey: ['admin', 'config-ponto', 'opcoes'],
    queryFn: () => adminService.getConfigPontoOpcoes(),
    enabled: !!user && isMaster,
  });

  const opcoes = opcoesResp?.data;
  const contratos = useMemo(() => opcoes?.contratos ?? [], [opcoes]);
  const subgrupos = useMemo(() => opcoes?.subgrupos ?? [], [opcoes]);
  const equipes = useMemo(() => opcoes?.equipes ?? [], [opcoes]);
  const contratoSubgrupos = useMemo(() => opcoes?.contratoSubgrupos ?? [], [opcoes]);

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

  const contratosPontoSemEscala = useMemo(
    () => contratos.filter((c: any) => !(c?.usaEscala && c?.usaPonto)),
    [contratos]
  );

  const equipesDoSubgrupo = useMemo(
    () => (subgrupoId ? equipes.filter((e) => e.subgrupoId === subgrupoId && e.ativo !== false) : []),
    [equipes, subgrupoId]
  );
  const temContratoESubgrupo = !!contratoId && !!subgrupoId;

  const { data: configResp, isLoading: loadingConfig } = useQuery({
    queryKey: ['admin', 'config-ponto', contratoId, subgrupoId, equipeId || null],
    queryFn: () => adminService.getConfigPonto(contratoId, subgrupoId, equipeId || null),
    enabled: !!user && isMaster && temContratoESubgrupo,
  });

  const config: ConfigPontoEletronico | null = configResp?.data ?? null;

  useEffect(() => {
    if (!temContratoESubgrupo) {
      setDraftValorPorDia({});
      setDraftValorCobrancaPorDia({});
      return;
    }
    if (loadingConfig) return;

    if (!config) {
      const z = mapaVazioPorDia();
      setDraftValorPorDia(z);
      setDraftValorCobrancaPorDia({ ...z });
      return;
    }

    const rep: Record<string, string> = {};
    const cob: Record<string, string> = {};
    const baseRep = config.valorHora != null ? parseFloat(String(config.valorHora)) : NaN;
    const baseCob = config.valorHoraCobranca != null ? parseFloat(String(config.valorHoraCobranca)) : NaN;
    for (const { key } of DIAS_SEMANA) {
      const mk = config.valorHoraPorDia?.[key];
      let nRep: number | null = null;
      if (mk != null && String(mk).trim() !== '') {
        const n = Number(mk);
        if (Number.isFinite(n)) nRep = n;
      } else if (Number.isFinite(baseRep)) {
        nRep = baseRep;
      }
      rep[key] = nRep != null ? formatValor(nRep) : '';

      const ck = config.valorHoraCobrancaPorDia?.[key];
      let nCob: number | null = null;
      if (ck != null && String(ck).trim() !== '') {
        const n = Number(ck);
        if (Number.isFinite(n)) nCob = n;
      } else if (Number.isFinite(baseCob)) {
        nCob = baseCob;
      }
      cob[key] = nCob != null ? formatValor(nCob) : '';
    }
    setDraftValorPorDia(rep);
    setDraftValorCobrancaPorDia(cob);
  }, [temContratoESubgrupo, loadingConfig, config, contratoId, subgrupoId, equipeId]);

  const horasPrevistasDisplay = draftHoras !== '' ? draftHoras : (config?.horasPrevistasMes != null ? String(config.horasPrevistasMes) : '');
  const horarioEntradaDisplay = draftHorarioEntrada !== '' ? draftHorarioEntrada : (config?.horarioEntrada ?? '');
  const horarioSaidaDisplay = draftHorarioSaida !== '' ? draftHorarioSaida : (config?.horarioSaida ?? '');
  const toleranciaDisplay = draftTolerancia !== '' ? draftTolerancia : (config?.toleranciaMinutos != null ? String(config.toleranciaMinutos) : '');
  const latitudeDisplay = draftLatitude !== '' ? draftLatitude : (config?.latitude != null && config?.latitude !== '' ? String(config.latitude) : '');
  const longitudeDisplay = draftLongitude !== '' ? draftLongitude : (config?.longitude != null && config?.longitude !== '' ? String(config.longitude) : '');
  const raioMetrosDisplay = draftRaioMetros !== '' ? draftRaioMetros : (config?.raioMetros != null ? String(config.raioMetros) : '');
  const temCoordenadas = latitudeDisplay !== '' && longitudeDisplay !== '';
  const enderecoDisplay = draftEndereco !== '' ? draftEndereco : (config?.enderecoPonto ?? '');

  const diasUteis = useMemo(() => getDiasUteis(ano, mes), [ano, mes]);

  const buscarCoordenadas = async () => {
    const endereco = draftEndereco.trim();
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

  const selecionarEndereco = (item: { display_name: string; lat: string; lon: string }) => {
    setDraftEndereco(item.display_name);
    setDraftLatitude(String(Number(item.lat).toFixed(6)));
    setDraftLongitude(String(Number(item.lon).toFixed(6)));
    setEnderecoSugestoes([]);
    setEnderecoDropdownOpen(false);
    setGeocodeError(null);
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

  const onContratoChange = (id: string) => {
    setContratoId(id);
    setSubgrupoId('');
    setEquipeId('');
    setDraftHoras('');
    setDraftValorPorDia({});
    setDraftValorCobrancaPorDia({});
    setDraftHorarioEntrada('');
    setDraftHorarioSaida('');
    setDraftTolerancia('');
    setDraftEndereco('');
    setDraftLatitude('');
    setDraftLongitude('');
    setDraftRaioMetros('');
  };

  const onSubgrupoChange = (id: string) => {
    setSubgrupoId(id);
    setEquipeId('');
    setDraftHoras('');
    setDraftValorPorDia({});
    setDraftValorCobrancaPorDia({});
    setDraftHorarioEntrada('');
    setDraftHorarioSaida('');
    setDraftTolerancia('');
    setDraftEndereco('');
    setDraftLatitude('');
    setDraftLongitude('');
    setDraftRaioMetros('');
  };

  const onEquipeChange = (id: string) => {
    setEquipeId(id);
    setDraftHoras('');
    setDraftValorPorDia({});
    setDraftValorCobrancaPorDia({});
    setDraftHorarioEntrada('');
    setDraftHorarioSaida('');
    setDraftTolerancia('');
    setDraftEndereco('');
    setDraftLatitude('');
    setDraftLongitude('');
    setDraftRaioMetros('');
  };

  const handleSave = async () => {
    if (!contratoId || !subgrupoId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const horas = draftHoras !== '' ? parseInt(draftHoras, 10) : (config?.horasPrevistasMes ?? null);
      if (horas !== null && (Number.isNaN(horas) || horas < 0)) {
        throw new Error('Horas previstas deve ser um número válido.');
      }

      const gradeRepassePronta = DIAS_SEMANA.every(({ key }) => draftValorPorDia[key] !== undefined);
      const gradeCobrancaPronta = DIAS_SEMANA.every(({ key }) => draftValorCobrancaPorDia[key] !== undefined);

      const { map: mapRepasse, fallbackGlobal: valorRepasseGlobal } = gradeRepassePronta
        ? buildMapaValorPorDiaComFallback(draftValorPorDia)
        : { map: {} as Record<string, number | null>, fallbackGlobal: null as number | null };
      const { map: mapCobranca, fallbackGlobal: valorCobrancaGlobal } = gradeCobrancaPronta
        ? buildMapaValorPorDiaComFallback(draftValorCobrancaPorDia)
        : { map: {} as Record<string, number | null>, fallbackGlobal: null as number | null };

      const valorHora =
        gradeRepassePronta
          ? valorRepasseGlobal
          : config?.valorHora != null
            ? parseFloat(String(config.valorHora))
            : null;
      const valorHoraCobranca =
        gradeCobrancaPronta
          ? valorCobrancaGlobal
          : config?.valorHoraCobranca != null
            ? parseFloat(String(config.valorHoraCobranca))
            : null;

      const horarioEntrada = draftHorarioEntrada !== '' ? draftHorarioEntrada : (config?.horarioEntrada ?? null);
      const horarioSaida = draftHorarioSaida !== '' ? draftHorarioSaida : (config?.horarioSaida ?? null);
      const tolerancia = draftTolerancia !== '' ? parseInt(draftTolerancia, 10) : (config?.toleranciaMinutos ?? null);
      const toleranciaMinutos = tolerancia != null && !Number.isNaN(tolerancia) && tolerancia >= 0 ? tolerancia : null;

      const lat = draftLatitude !== '' ? parseFloat(draftLatitude.replace(',', '.')) : (config?.latitude != null && config?.latitude !== '' ? parseFloat(String(config.latitude)) : null);
      const lng = draftLongitude !== '' ? parseFloat(draftLongitude.replace(',', '.')) : (config?.longitude != null && config?.longitude !== '' ? parseFloat(String(config.longitude)) : null);
      const raio = draftRaioMetros !== '' ? parseInt(draftRaioMetros, 10) : (config?.raioMetros ?? null);
      const raioMetros = raio != null && !Number.isNaN(raio) && raio >= 0 ? raio : null;

      await adminService.setConfigPonto(contratoId, subgrupoId, equipeId || null, {
        horasPrevistasMes: horas ?? null,
        valorHora,
        valorHoraCobranca,
        ...(gradeRepassePronta ? { valorHoraPorDia: mapRepasse } : {}),
        ...(gradeCobrancaPronta ? { valorHoraCobrancaPorDia: mapCobranca } : {}),
        horarioEntrada: horarioEntrada || null,
        horarioSaida: horarioSaida || null,
        toleranciaMinutos,
        latitude: lat != null && !Number.isNaN(lat) ? lat : null,
        longitude: lng != null && !Number.isNaN(lng) ? lng : null,
        raioMetros,
        enderecoPonto: draftEndereco.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'config-ponto', contratoId, subgrupoId, equipeId || null] });
      setDraftHoras('');
      setDraftHorarioEntrada('');
      setDraftHorarioSaida('');
      setDraftTolerancia('');
      setDraftLatitude('');
      setDraftLongitude('');
      setDraftRaioMetros('');
      setGeocodeError(null);
      setSuccess('Configuração salva com sucesso.');
      setSaved(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Somente o perfil Master pode configurar valores e horas do ponto eletrônico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">Horas e valor – Ponto Eletrônico</h2>
        <p className="text-gray-600">
          Por <strong>Contrato</strong>, <strong>Subgrupo</strong> e <strong>Equipe</strong>, defina as <strong>horas previstas no mês</strong> e os <strong>valores por hora</strong> (repasse ao profissional e cobrança). Se não escolher equipe, a configuração vale para todo o subgrupo. Use a seção &quot;Dias úteis do mês&quot; para consultar quantos dias úteis tem cada mês.
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
        <h3 className="text-lg font-bold text-viva-900 mb-4">Contrato, subgrupo e equipe</h3>
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
                {contratosPontoSemEscala.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
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
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px]">
              <label className="block text-sm font-semibold text-viva-800 mb-1">Equipe</label>
              <select
                className="input w-full"
                value={equipeId}
                onChange={(e) => onEquipeChange(e.target.value)}
                disabled={!subgrupoId}
              >
                <option value="">Subgrupo (todas as equipes)</option>
                {equipesDoSubgrupo.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-2">Dias úteis do mês</h3>
        <p className="text-sm text-gray-600 mb-4">
          Quantidade de dias úteis (segunda a sexta) no mês selecionado. Ex.: fevereiro de 2026 possui 20 dias úteis.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-semibold text-viva-800 mb-1">Mês</label>
            <select
              className="input w-[180px]"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
            >
              {MESES.map((nome, i) => (
                <option key={i} value={i + 1}>{nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-viva-800 mb-1">Ano</label>
            <select
              className="input w-[120px]"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
            >
              {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-viva-100 border border-viva-200">
            <span className="text-viva-900 font-semibold">
              {MESES[mes - 1]} de {ano}: <strong className="text-viva-800">{diasUteis} dias úteis</strong>
            </span>
          </div>
        </div>
      </div>

      {temContratoESubgrupo && (
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-4">Horas previstas e valores por hora</h3>
          {loadingConfig ? (
            <p className="text-sm text-gray-600">Carregando configuração...</p>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 mb-3">
                Contratos <strong>só ponto</strong> (sem escala): defina <strong>repasse</strong> e <strong>cobrança</strong> por dia da semana (Seg–Dom). No{' '}
                <strong>Relatório de Horas</strong>, cada batida <strong>sem escala</strong> usa o valor do <strong>dia do check-in</strong>. Dia em branco usa o
                primeiro valor preenchido da semana (seg → dom) como fallback no sistema.
              </p>
              <div className="p-4 rounded-xl border border-viva-200 bg-white space-y-5">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[200px]">
                    <label className="block text-sm font-semibold text-viva-800 mb-1">Horas previstas no mês</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input w-full max-w-[180px]"
                      placeholder="Ex: 160"
                      value={horasPrevistasDisplay}
                      onChange={(e) => setDraftHoras(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t border-viva-100 pt-4">
                  <h4 className="text-base font-bold text-viva-900 mb-1">Valor hora por dia (ponto sem escala)</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Preencha cada dia em reais por hora. Configurações antigas com um único valor aparecem repetidas em todos os dias até você ajustar.
                  </p>

                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-semibold text-viva-800 mb-2">Repasse (R$/h)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {DIAS_SEMANA.map(({ key, label }) => (
                          <div
                            key={key}
                            className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-viva-200 bg-viva-50/30"
                          >
                            <div className="min-w-[200px] flex-1">
                              <label className="block text-sm font-semibold text-viva-800 mb-1">
                                {label}{' '}
                                <span className="font-normal text-viva-600">(R$/h)</span>
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="input w-full max-w-[180px]"
                                placeholder="Ex: 150,00"
                                value={draftValorPorDia[key] ?? ''}
                                onChange={(e) =>
                                  setDraftValorPorDia((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <button
                              type="button"
                              className={`btn btn-primary`}
                              onClick={handleSave}
                              disabled={saving}
                            >
                              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-viva-800 mb-2">Cobrança (R$/h)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {DIAS_SEMANA.map(({ key, label }) => (
                          <div
                            key={key}
                            className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-viva-200 bg-viva-50/30"
                          >
                            <div className="min-w-[200px] flex-1">
                              <label className="block text-sm font-semibold text-viva-800 mb-1">
                                {label}{' '}
                                <span className="font-normal text-viva-600">(R$/h)</span>
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="input w-full max-w-[180px]"
                                placeholder="Ex: 150,00"
                                value={draftValorCobrancaPorDia[key] ?? ''}
                                onChange={(e) =>
                                  setDraftValorCobrancaPorDia((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <button
                              type="button"
                              className={`btn btn-primary`}
                              onClick={handleSave}
                              disabled={saving}
                            >
                              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-viva-200 pt-4">
                <h4 className="text-base font-bold text-viva-900 mb-2">Horário de entrada e saída</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Defina o horário exato de chegada e saída da equipe. A <strong>tolerância</strong> (em minutos) vale para os dois: o profissional pode bater ponto de entrada entre (entrada − tolerância) e (entrada + tolerância), e de saída entre (saída − tolerância) e (saída + tolerância). Após o fim da tolerância, atrasos são registrados apenas a título de organização, sem penalidade.
                </p>
                <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-viva-200 bg-viva-50/30">
                  <div className="min-w-[140px]">
                    <label className="block text-sm font-semibold text-viva-800 mb-1">Horário de entrada</label>
                    <input
                      type="time"
                      className="input w-full max-w-[140px]"
                      value={horarioEntradaDisplay}
                      onChange={(e) => setDraftHorarioEntrada(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[140px]">
                    <label className="block text-sm font-semibold text-viva-800 mb-1">Horário de saída</label>
                    <input
                      type="time"
                      className="input w-full max-w-[140px]"
                      value={horarioSaidaDisplay}
                      onChange={(e) => setDraftHorarioSaida(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[160px]">
                    <label className="block text-sm font-semibold text-viva-800 mb-1">Tolerância (min)</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={1}
                      className="input w-full max-w-[100px]"
                      placeholder="Ex: 15"
                      value={toleranciaDisplay}
                      onChange={(e) => setDraftTolerancia(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={`btn ${saved ? 'bg-green-600 hover:bg-green-700 border-green-700' : 'btn-primary'}`}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
              </div>

              <div className="border-t border-viva-200 pt-4">
                <h4 className="text-base font-bold text-viva-900 mb-2">Localização do ponto (opcional)</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Informe o <strong>endereço</strong> onde o ponto deve ser registrado e clique em &quot;Buscar coordenadas&quot; (ou use sua localização atual). Se preenchido, o profissional precisará estar dentro do <strong>raio</strong> (em metros) desse local para bater o ponto. Deixe em branco para não exigir geolocalização.
                </p>
                <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-viva-200 bg-viva-50/30">
                  <div className="min-w-[280px] flex-1 relative" ref={enderecoContainerRef}>
                    <label className="block text-sm font-semibold text-viva-800 mb-1">Endereço</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="Digite para buscar (ex.: Rua X, 123 - Fortaleza/CE)"
                      value={enderecoDisplay}
                      onChange={(e) => { setDraftEndereco(e.target.value); setGeocodeError(null); }}
                      onFocus={() => enderecoSugestoes.length > 0 && setEnderecoDropdownOpen(true)}
                      autoComplete="off"
                    />
                    {enderecoBuscando && (
                      <p className="text-xs text-viva-600 mt-1">Buscando endereços...</p>
                    )}
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
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={buscarCoordenadas}
                    disabled={geocoding}
                  >
                    {geocoding ? 'Buscando...' : 'Buscar coordenadas'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={usarMinhaLocalizacao}
                  >
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
                    className={`btn ${saved ? 'bg-green-600 hover:bg-green-700 border-green-700' : 'btn-primary'}`}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-viva-600 mt-4">
            Estas informações podem ser usadas em relatórios e cálculos de produtividade por subgrupo ou por equipe. Os horários e a tolerância definem a janela em que o check-in e o checkout são aceitos e o registro de atrasos (sem penalidade). A localização e o raio, quando definidos, restringem onde o profissional pode bater ponto.
          </p>
        </div>
      )}
    </div>
  );
};

export default ValoresPonto;
