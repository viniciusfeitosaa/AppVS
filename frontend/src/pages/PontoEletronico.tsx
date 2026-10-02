import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { PONTO_SEM_ESCALA_ESCALA_ID } from '../constants/ponto';
import { pontoService, type MinhaBiometriaFacial } from '../services/ponto.service';
import { BIOMETRIA_CONSENTIMENTO_TEXTO } from '../constants/biometria';
import { usePontoOffline } from '../hooks/usePontoOffline';
import { enfileirarPonto, type PontoOfflineItem } from '../lib/pontoOfflineQueue';
import {
  fimPlantaoCliente,
  inicioPlantaoCliente,
  type PlantaoAgendaInput,
} from '../utils/plantao-agenda';
import { notify } from '../lib/notificationEmitter';
import { BadgeFaceSituacao, type FaceSituacao } from '../components/ponto/SituacaoRegistroPonto';

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
};

const formatClock = (d: Date) => {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const LiveClock = ({ tickMs = 1000 }: { tickMs?: number }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return (
    <span className="text-3xl md:text-4xl font-mono font-bold text-viva-900 tabular-nums tracking-tight" aria-live="polite">
      {formatClock(now)}
    </span>
  );
};

type PlantaoHojeMeuDia = {
  id: string;
  escalaId: string;
  data: string;
  gradeId: string;
  faixaHorario?: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  cruzaMeiaNoite?: boolean | null;
};

/** Formato de `GET /ponto/meu-dia` / `painel-inicial.data.meuDia` (tipagem local para a UI). */
type MeuDiaPontoApi = {
  registroAberto?: {
    checkInAt?: string;
    escalaId?: string | null;
    escala?: { nome?: string } | null;
  } | null;
  registrosHoje?: Array<{
    id: string;
    checkInAt: string;
    checkOutAt?: string | null;
    duracaoMinutos?: number | null;
    checkInAtrasado?: boolean;
    minutosAtrasoCheckin?: number | null;
    escalaId?: string | null;
    escala?: { nome?: string } | null;
    faceSituacao?: FaceSituacao | null;
  }>;
  totalMinutosHoje?: number;
  totalMinutosSemana?: number;
  ultimoRegistroPonto?: { checkInAt?: string } | null;
  equipeDoDia?: string[];
  minhasEquipes?: string[];
  plantoesHoje?: PlantaoHojeMeuDia[];
  configHorario?: { horarioEntrada?: string | null; horarioSaida?: string | null };
  exigeGeolocalizacao?: boolean;
};

/** Um plantão: em andamento agora, senão o próximo, senão o que acabou mais tarde hoje. */
function escolherPlantaoMaisRelevante(lista: PlantaoHojeMeuDia[], at: Date): PlantaoHojeMeuDia | null {
  if (lista.length === 0) return null;
  if (lista.length === 1) return lista[0];

  const toAgenda = (p: PlantaoHojeMeuDia): PlantaoAgendaInput => ({
    gradeId: p.gradeId,
    horaInicio: p.horaInicio ?? null,
    horaFim: p.horaFim ?? null,
    cruzaMeiaNoite: p.cruzaMeiaNoite ?? null,
  });

  const scored = lista.map((p) => {
    const q = toAgenda(p);
    return {
      p,
      inicio: inicioPlantaoCliente(p.data, q),
      fim: fimPlantaoCliente(p.data, q),
    };
  });

  const t = at.getTime();
  const emAndamento = scored.find((s) => t >= s.inicio.getTime() && t <= s.fim.getTime());
  if (emAndamento) return emAndamento.p;

  const futuros = scored
    .filter((s) => s.inicio.getTime() > t)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  if (futuros.length > 0) return futuros[0].p;

  const passados = scored
    .filter((s) => s.fim.getTime() < t)
    .sort((a, b) => b.fim.getTime() - a.fim.getTime());
  return passados[0]?.p ?? lista[0];
}

const PLANTOES_HOJE_VAZIO: PlantaoHojeMeuDia[] = [];
const TOLERANCIA_MINUTOS_ATRASO_CHECKIN = 30;

const formatDiaPlantaoCurto = (dataStr: string) => {
  const d = new Date(`${dataStr}T12:00:00`);
  return d
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '');
};

const formatHoraCurta = (valor: string | null | undefined) => {
  if (!valor) return '—';
  const t = String(valor).trim();
  if (!t) return '—';
  return t.slice(0, 5);
};

/** Haversine (metros) — alinhado ao backend de ponto. */
function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type EscalaPontoPainel = {
  id: string;
  nome: string;
  referenciaGeo?: { latitude: number; longitude: number; raioMetros: number } | null;
};

/** Várias escalas: `ok` = mais próxima por GPS; `fallback` = GPS indisponível ou sem referência — usa primeira da lista. */
type EscalaAutoStatus = 'idle' | 'unica' | 'loading' | 'ok' | 'fallback';

type ModoCaptura = 'checkin' | 'checkout' | 'biometria';

function textoConferenciaRosto(conferencia: 'ok' | 'sem-conferencia' | 'parar', assimMesmo: boolean): string {
  if (assimMesmo) return ' Rosto não reconhecido: a foto será analisada pelo administrador.';
  if (conferencia === 'ok') return ' Rosto reconhecido.';
  return '';
}

const PontoEletronico = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEscalaId, setSelectedEscalaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // “Agora” para lógica (seleção de plantão / janelas) — não precisa atualizar a cada 1s.
  const [agora, setAgora] = useState(() => new Date());
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [cameraErro, setCameraErro] = useState(false);
  const [cameraErroTipo, setCameraErroTipo] = useState<string | null>(null);
  const [videoPronto, setVideoPronto] = useState(false);
  /** Incrementa quando há stream novo — força reanexo ao <video> (mount tardio / iOS). */
  const [streamAttachKey, setStreamAttachKey] = useState(0);
  const [motivoSemFoto, setMotivoSemFoto] = useState('');
  const [showSemFotoSection, setShowSemFotoSection] = useState(false);
  /** O mesmo modal de câmera serve para entrada, saída e cadastro da foto de referência. */
  const [modoCaptura, setModoCaptura] = useState<ModoCaptura>('checkin');
  const [aposBiometria, setAposBiometria] = useState<'checkin' | 'checkout' | null>(null);
  const [consentiuBiometria, setConsentiuBiometria] = useState(false);
  const [conferindoRosto, setConferindoRosto] = useState(false);
  /** Foto que não passou na conferência facial: o médico escolhe tirar outra ou registrar assim (vai para revisão). */
  const [fotoNaoConferida, setFotoNaoConferida] = useState<{
    foto: File;
    previewUrl: string;
    mensagem: string;
  } | null>(null);
  /** Várias escalas: escolha automática por GPS (sem select). */
  const [escalaAutoStatus, setEscalaAutoStatus] = useState<EscalaAutoStatus>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStartAttemptRef = useRef(0);

  const isMedico = user?.role === 'MEDICO';

  const { data: modulosResp } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user && isMedico,
    staleTime: 2 * 60 * 1000,
  });

  const { fila, online, sincronizando, sincronizar, descartar } = usePontoOffline(isMedico ? user?.id : undefined);
  /** Sem internet ou com pontos ainda na fila, novos pontos também vão para a fila (preserva a ordem). */
  const usarFila = !online || fila.length > 0;

  const { data: painelRespRede, isLoading: loadingPainelRede } = useQuery({
    queryKey: ['ponto', 'painel-inicial'],
    queryFn: () => pontoService.getPainelInicial(),
    enabled: !!user && isMedico,
    staleTime: 25 * 1000,
    refetchInterval: (query) => {
      const regs = (query.state.data?.data?.meuDia as MeuDiaPontoApi | undefined)?.registrosHoje ?? [];
      const recente = (iso?: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
      return regs.some((r) => r.faceSituacao === 'EM_ANALISE' && (recente(r.checkInAt) || recente(r.checkOutAt)))
        ? 5000
        : false;
    },
  });

  const { data: biometriaResp } = useQuery({
    queryKey: ['ponto', 'biometria'],
    queryFn: () => pontoService.getMinhaBiometria(),
    enabled: !!user && isMedico,
    staleTime: 60 * 1000,
  });
  const biometriaInfo = biometriaResp?.data;
  const precisaBiometria = !!biometriaInfo?.habilitado && !!biometriaInfo?.precisaCadastrar;

  const painelCacheKey = user?.id ? `ponto-painel:${user.id}` : null;
  useEffect(() => {
    if (painelRespRede && painelCacheKey) {
      try {
        localStorage.setItem(painelCacheKey, JSON.stringify(painelRespRede));
      } catch {
        // armazenamento cheio: offline fica sem dados da última visita
      }
    }
  }, [painelRespRede, painelCacheKey]);
  const painelResp = useMemo(() => {
    if (painelRespRede || online || !painelCacheKey) return painelRespRede;
    try {
      const raw = localStorage.getItem(painelCacheKey);
      return raw ? (JSON.parse(raw) as typeof painelRespRede) : undefined;
    } catch {
      return undefined;
    }
  }, [painelRespRede, online, painelCacheKey]);
  const loadingPainel = loadingPainelRede && !painelResp;

  const meuDiaPayload = painelResp?.data?.meuDia as MeuDiaPontoApi | undefined;
  const meuDiaResp =
    painelResp != null && meuDiaPayload != null
      ? { success: painelResp.success, data: meuDiaPayload }
      : undefined;
  const listaEscalas: EscalaPontoPainel[] = useMemo(
    () => (painelResp?.data?.escalas ?? []) as EscalaPontoPainel[],
    [painelResp?.data?.escalas]
  );
  const registroAbertoPainel = meuDiaPayload?.registroAberto;

  const plantoesHojePainel: PlantaoHojeMeuDia[] =
    (meuDiaPayload as { plantoesHoje?: PlantaoHojeMeuDia[] } | undefined)?.plantoesHoje ?? PLANTOES_HOJE_VAZIO;

  const escalaIdEfetivo = useMemo(() => {
    const ids = new Set(listaEscalas.map((e) => e.id));
    const abertoId = registroAbertoPainel?.escalaId ?? null;
    if (abertoId && (ids.has(abertoId) || abertoId === PONTO_SEM_ESCALA_ESCALA_ID)) {
      return abertoId;
    }
    if (plantoesHojePainel.length > 0) {
      const p = escolherPlantaoMaisRelevante(plantoesHojePainel, agora);
      if (p && (ids.has(p.escalaId) || p.escalaId === PONTO_SEM_ESCALA_ESCALA_ID)) {
        return p.escalaId;
      }
    }
    return selectedEscalaId;
  }, [listaEscalas, registroAbertoPainel?.escalaId, plantoesHojePainel, agora, selectedEscalaId]);

  const { data: canCheckInResp, isPending: canCheckInPending, isError: canCheckInErro } = useQuery({
    queryKey: ['ponto', 'can-checkin', escalaIdEfetivo],
    queryFn: () => pontoService.canCheckIn(escalaIdEfetivo!),
    enabled:
      !!user &&
      isMedico &&
      !!escalaIdEfetivo &&
      painelResp != null &&
      !registroAbertoPainel,
    /**
     * Polling só com última tentativa bem-sucedida e sem erro pendente.
     * Evita requisições a cada 30s quando o backend cai (ERR_CONNECTION_RESET) ou após falha em segundo plano.
     */
    refetchInterval: (q) => {
      if (q.state.status !== 'success' || q.state.error) return false;
      const id = q.queryKey[2] as string | undefined;
      if (!id || id === PONTO_SEM_ESCALA_ESCALA_ID) return false;
      return 30_000;
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
    staleTime: 10 * 1000,
  });

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const escalasAutoDep = useMemo(() => {
    const arr = (painelResp?.data?.escalas ?? []) as EscalaPontoPainel[];
    return JSON.stringify(arr.map((e) => ({ id: e.id, ref: e.referenciaGeo ?? null })));
  }, [painelResp?.data?.escalas]);

  useEffect(() => {
    if (loadingPainel) return;

    type Parsed = { id: string; ref: EscalaPontoPainel['referenciaGeo'] };
    let parsed: Parsed[];
    try {
      parsed = JSON.parse(escalasAutoDep) as Parsed[];
    } catch {
      setSelectedEscalaId('');
      setEscalaAutoStatus('idle');
      return;
    }

    if (parsed.length === 0) {
      setSelectedEscalaId('');
      setEscalaAutoStatus('idle');
      return;
    }

    if (parsed.length === 1) {
      setSelectedEscalaId(parsed[0].id);
      setEscalaAutoStatus('unica');
      return;
    }

    const comGeo = parsed
      .map((row) => {
        const r = row.ref;
        if (!r) return null;
        const lat = Number(r.latitude);
        const lon = Number(r.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
        return { id: row.id, lat, lon };
      })
      .filter((x): x is { id: string; lat: number; lon: number } => x != null);

    const usarPrimeiraEscala = () => {
      setSelectedEscalaId(parsed[0].id);
      setEscalaAutoStatus('fallback');
    };

    /** GPS e referências no ponto são opcionais: sem isso, mantém o comportamento anterior (primeira escala). */
    if (comGeo.length === 0 || !navigator.geolocation) {
      usarPrimeiraEscala();
      return;
    }

    let cancelled = false;
    setEscalaAutoStatus('loading');
    setSelectedEscalaId('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const uLat = pos.coords.latitude;
        const uLon = pos.coords.longitude;
        let best = comGeo[0];
        let bestD = distanciaMetros(uLat, uLon, best.lat, best.lon);
        for (let i = 1; i < comGeo.length; i++) {
          const d = distanciaMetros(uLat, uLon, comGeo[i].lat, comGeo[i].lon);
          if (d < bestD) {
            bestD = d;
            best = comGeo[i];
          }
        }
        setSelectedEscalaId(best.id);
        setEscalaAutoStatus('ok');
      },
      () => {
        if (cancelled) return;
        setSelectedEscalaId(parsed[0].id);
        setEscalaAutoStatus('fallback');
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
    );

    return () => {
      cancelled = true;
    };
  }, [loadingPainel, escalasAutoDep]);

  if (!isMedico) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-base font-bold text-viva-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-viva-700 font-serif">Somente profissionais (perfil médico) podem registrar ponto eletrônico.</p>
      </div>
    );
  }

  const mapModulos = modulosResp?.data?.map;
  if (modulosResp && mapModulos && mapModulos.PONTO_ELETRONICO === false) {
    return (
      <div className="card border-l-4 border-amber-500">
        <h2 className="text-base font-bold text-viva-900 mb-2 font-display">Acesso ao módulo</h2>
        <p className="text-sm text-viva-700 font-serif">
          O Ponto Eletrônico não está habilitado para o seu perfil neste tenant. Peça ao administrador para ativar o
          módulo ou verifique suas permissões.
        </p>
      </div>
    );
  }

  const ultimoDaFila = fila[fila.length - 1];
  const registroAberto: { checkInAt?: string | null } | null | undefined = ultimoDaFila
    ? ultimoDaFila.tipo === 'checkin'
      ? { checkInAt: ultimoDaFila.capturadoEm }
      : null
    : meuDiaResp?.data?.registroAberto;
  const podeCheckinOffline = usarFila && !!escalaIdEfetivo;
  const registrosHoje = meuDiaResp?.data?.registrosHoje || [];
  const totalMinutosHoje = meuDiaResp?.data?.totalMinutosHoje || 0;
  const totalMinutosSemana = meuDiaResp?.data?.totalMinutosSemana || 0;
  const ultimoRegistroPonto = meuDiaResp?.data?.ultimoRegistroPonto;
  const plantoesHoje = plantoesHojePainel;
  const plantoesHojeNaEscala = escalaIdEfetivo
    ? plantoesHoje.filter((p) => p.escalaId === escalaIdEfetivo)
    : [];
  const plantaoHojeExibir =
    escalaIdEfetivo &&
    escalaIdEfetivo !== PONTO_SEM_ESCALA_ESCALA_ID &&
    plantoesHojeNaEscala.length > 0
      ? escolherPlantaoMaisRelevante(plantoesHojeNaEscala, agora)
      : null;
  const configHorario: { horarioEntrada?: string | null; horarioSaida?: string | null } = meuDiaResp?.data?.configHorario || {};
  const exigeGeolocalizacao = !!meuDiaResp?.data?.exigeGeolocalizacao;

  const canCheckIn = !!canCheckInResp?.data?.allowed;
  const canCheckInReason: string | null = canCheckInResp?.data?.reason ?? null;
  const mostrarAtrasoCheckin =
    !!plantaoHojeExibir &&
    !registroAberto &&
    canCheckIn &&
    (() => {
      const inicio = inicioPlantaoCliente(plantaoHojeExibir.data, {
        gradeId: plantaoHojeExibir.gradeId,
        horaInicio: plantaoHojeExibir.horaInicio ?? null,
        horaFim: plantaoHojeExibir.horaFim ?? null,
        cruzaMeiaNoite: plantaoHojeExibir.cruzaMeiaNoite ?? null,
      });
      const limiteSemAtraso = new Date(inicio.getTime() + TOLERANCIA_MINUTOS_ATRASO_CHECKIN * 60 * 1000);
      return agora.getTime() > limiteSemAtraso.getTime();
    })();
  const mensagemAtrasoCheckin = mostrarAtrasoCheckin
    ? `Este check-in será registrado como atrasado (acima de ${TOLERANCIA_MINUTOS_ATRASO_CHECKIN} min de tolerância).`
    : null;

  /** Não duplicar com o motivo da API nem sugerir “sem plantão” quando o check-in já está liberado ou ainda está sendo verificado. */
  const mostrarAvisoCalendarioSemPlantaoHoje =
    !loadingPainel &&
    painelResp != null &&
    !!escalaIdEfetivo &&
    escalaIdEfetivo !== PONTO_SEM_ESCALA_ESCALA_ID &&
    !plantaoHojeExibir &&
    !registroAberto &&
    !canCheckIn &&
    !canCheckInReason &&
    !canCheckInPending &&
    !canCheckInErro;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ponto', 'painel-inicial'] });
    await queryClient.invalidateQueries({ queryKey: ['ponto', 'meu-dia'] });
    await queryClient.invalidateQueries({ queryKey: ['ponto', 'can-checkin'] });
  };

  const pararStreamCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  /**
   * Safari/iOS exige que getUserMedia seja invocado a partir de um gesto do usuário.
   * Chamar só em useEffect após abrir o modal quebra essa cadeia — a câmera não liga ou fecha na hora.
   * Por isso iniciarCamera deve ser chamado de openCheckinModal / tentarCameraNovamente (e opcionalmente após retry key).
   */
  const iniciarCamera = async () => {
    const attempt = ++cameraStartAttemptRef.current;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraErro(false);
    setCameraErroTipo(null);
    setVideoPronto(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (attempt !== cameraStartAttemptRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setStreamAttachKey((k) => k + 1);

      const el = videoRef.current;
      if (el) {
        el.srcObject = stream;
        await el.play().catch(() => {});
      }
    } catch (err: any) {
      if (attempt !== cameraStartAttemptRef.current) return;
      setCameraErro(true);
      setCameraErroTipo(err?.name || 'UNKNOWN_ERROR');
    }
  };

  /** Só quando o modal fecha: invalida tentativas e para tracks (evita parar stream em remounts estranhos só com modal aberto). */
  useEffect(() => {
    if (checkinModalOpen) return;
    cameraStartAttemptRef.current++;
    pararStreamCamera();
    setVideoPronto(false);
  }, [checkinModalOpen]);

  /** Anexa stream ao <video> quando o elemento existe (stream pode chegar antes do primeiro paint). */
  useLayoutEffect(() => {
    if (!checkinModalOpen || cameraErro) return;
    const el = videoRef.current;
    const stream = streamRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [checkinModalOpen, cameraErro, streamAttachKey]);

  const tentarCameraNovamente = () => {
    setError(null);
    // Mesmo gesto do toque — obrigatório no Safari/iOS; não depender só de useEffect.
    void iniciarCamera();
  };

  const descartarFotoNaoConferida = () => {
    setFotoNaoConferida((atual) => {
      if (atual) URL.revokeObjectURL(atual.previewUrl);
      return null;
    });
  };

  /**
   * Confere o rosto antes de registrar. Retorna 'ok' (reconhecido), 'sem-conferencia'
   * (sem biometria/serviço fora) ou 'parar' (não reconhecido: modal mostra as opções).
   */
  const conferirRostoAntes = async (foto: File): Promise<'ok' | 'sem-conferencia' | 'parar'> => {
    if (!biometriaInfo?.habilitado || usarFila) return 'sem-conferencia';
    setConferindoRosto(true);
    try {
      const { data } = await pontoService.conferirRosto(foto);
      if (!data?.resultado || data.resultado === 'INDISPONIVEL') return 'sem-conferencia';
      if (data.resultado === 'CONFERE') return 'ok';
      setFotoNaoConferida({
        foto,
        previewUrl: URL.createObjectURL(foto),
        mensagem: data.mensagem || 'Não conseguimos confirmar que é você.',
      });
      return 'parar';
    } catch {
      return 'sem-conferencia';
    } finally {
      setConferindoRosto(false);
    }
  };

  const closeCheckinModal = () => {
    descartarFotoNaoConferida();
    setVideoPronto(false);
    setMotivoSemFoto('');
    setShowSemFotoSection(false);
    setStreamAttachKey(0);
    setAposBiometria(null);
    setConsentiuBiometria(false);
    setCheckinModalOpen(false);
  };

  const abrirModalCamera = (modo: ModoCaptura, depois: 'checkin' | 'checkout' | null = null) => {
    descartarFotoNaoConferida();
    setError(null);
    setCameraErro(false);
    setVideoPronto(false);
    setMotivoSemFoto('');
    setShowSemFotoSection(false);
    setStreamAttachKey(0);
    setModoCaptura(modo);
    setAposBiometria(depois);
    setConsentiuBiometria(false);
    setCheckinModalOpen(true);
    // Mesmo gesto do clique: necessário para Safari/iOS aceitar getUserMedia.
    void iniciarCamera();
  };

  const openCheckoutModal = () => {
    if (precisaBiometria && online) {
      abrirModalCamera('biometria', 'checkout');
      return;
    }
    abrirModalCamera('checkout');
  };

  const openCheckinModal = () => {
    if (listaEscalas.length > 0 && !escalaIdEfetivo) {
      if (escalaAutoStatus === 'loading') {
        setError('Aguarde um instante enquanto definimos a escala.');
      } else {
        setError('Não foi possível identificar a escala. Atualize a página ou tente novamente.');
      }
      return;
    }
    if (!usarFila && !registroAberto && escalaIdEfetivo && canCheckInResp?.data?.allowed === false) {
      setError(null);
      return;
    }
    if (precisaBiometria && online) {
      abrirModalCamera('biometria', 'checkin');
      return;
    }
    abrirModalCamera('checkin');
  };

  const tratarErroCheckin = (err: any) => {
    const status = err.response?.status;
    const msg = err.response?.data?.error;
    if (status === 403) {
      if (typeof msg === 'string' && /m[oó]dulo|permiss[aã]o/i.test(msg)) {
        setError('Você não tem permissão para registrar ponto. Verifique o acesso ao módulo Ponto Eletrônico com o administrador.');
      } else {
        setError(null);
      }
    } else {
      setError(msg || 'Não foi possível registrar check-in.');
    }
  };

  /** Foto tirada no instante da chamada, a partir do quadro atual da câmera (sem galeria/arquivo). */
  const capturarQuadroAtualComoArquivo = (): Promise<File | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        resolve(null);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      // Câmera frontal costuma gerar imagem espelhada; invertendo no canvas
      // para salvar a foto na orientação esperada.
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          resolve(new File([blob], 'checkin-face.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.88
      );
    });
  };

  const obterPosicao = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
      );
    });
  };

  type DadosPontoFila = Omit<PontoOfflineItem, 'clientUuid' | 'capturadoEm' | 'tentativas' | 'medicoId'>;

  const guardarNoAparelho = async (dados: DadosPontoFila) => {
    if (!user?.id) return;
    try {
      await enfileirarPonto({ ...dados, medicoId: user.id });
    } catch (e: any) {
      setError(e?.message || 'Não foi possível guardar o ponto no aparelho.');
      return;
    }
    setObservacao('');
    closeCheckinModal();
    notify({
      kind: 'warning',
      title: dados.tipo === 'checkin' ? 'Entrada guardada no aparelho' : 'Saída guardada no aparelho',
      message: 'Sem conexão agora. O ponto será enviado automaticamente quando houver internet.',
      source: 'ponto',
    });
  };

  const handleCheckIn = async (fotoAssimMesmo?: File) => {
    setLoadingAction(true);
    setError(null);
    let pendente: DadosPontoFila | null = null;
    try {
      const foto = fotoAssimMesmo ?? (await capturarQuadroAtualComoArquivo());
      if (!foto) {
        setError(
          'Não foi possível capturar a imagem da câmera. Aguarde o vídeo carregar e posicione-se em frente à câmera antes de confirmar.'
        );
        setLoadingAction(false);
        return;
      }
      const conferencia = fotoAssimMesmo ? 'sem-conferencia' : await conferirRostoAntes(foto);
      if (conferencia === 'parar') {
        setLoadingAction(false);
        return;
      }

      const pos = await obterPosicao();
      if (exigeGeolocalizacao && !pos) {
        setError(
          'Não foi possível obter sua localização. Verifique se o acesso à localização está permitido para este site no navegador e tente novamente. Se o GPS estiver buscando sinal, aguarde alguns segundos.'
        );
        setLoadingAction(false);
        return;
      }
      pendente = {
        tipo: 'checkin',
        escalaId: escalaIdEfetivo || undefined,
        observacao: observacao || undefined,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
        foto,
      };
      if (usarFila) {
        await guardarNoAparelho(pendente);
        return;
      }
      const resposta = await pontoService.checkIn({
        ...(escalaIdEfetivo && { escalaId: escalaIdEfetivo }),
        observacao,
        ...(pos && { latitude: pos.latitude, longitude: pos.longitude }),
        foto,
      });
      setObservacao('');
      closeCheckinModal();
      await refresh();
      const minutosAtraso = Number(resposta?.data?.minutosAtrasoCheckin ?? 0);
      const atrasado = !!resposta?.data?.checkInAtrasado;
      notify({
        kind: atrasado || fotoAssimMesmo ? 'warning' : 'success',
        title: atrasado ? 'Check-in realizado com atraso' : 'Check-in realizado',
        message:
          (atrasado
            ? `Ponto de entrada registrado com atraso de ${Math.max(1, minutosAtraso)} min.`
            : 'Ponto de entrada registrado com sucesso.') + textoConferenciaRosto(conferencia, !!fotoAssimMesmo),
        source: 'ponto',
      });
    } catch (err: any) {
      if (!err?.response && pendente) await guardarNoAparelho(pendente);
      else tratarErroCheckin(err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCheckInSemFoto = async () => {
    const m = motivoSemFoto.trim();
    if (m.length < 15) {
      setError('Descreva o motivo em pelo menos 15 caracteres (ex.: permissão de câmera negada no Chrome).');
      return;
    }

    setLoadingAction(true);
    setError(null);
    let pendente: DadosPontoFila | null = null;
    try {
      const pos = await obterPosicao();
      if (exigeGeolocalizacao && !pos) {
        setError(
          'Não foi possível obter sua localização. Verifique se o acesso à localização está permitido para este site no navegador e tente novamente. Se o GPS estiver buscando sinal, aguarde alguns segundos.'
        );
        setLoadingAction(false);
        return;
      }
      pendente = {
        tipo: 'checkin',
        escalaId: escalaIdEfetivo || undefined,
        observacao: observacao || undefined,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
        motivoSemFoto: m,
      };
      if (usarFila) {
        await guardarNoAparelho(pendente);
        return;
      }
      const resposta = await pontoService.checkInSemFoto({
        ...(escalaIdEfetivo && { escalaId: escalaIdEfetivo }),
        observacao,
        motivoSemFoto: m,
        ...(pos && { latitude: pos.latitude, longitude: pos.longitude }),
      });
      setObservacao('');
      closeCheckinModal();
      await refresh();
      const minutosAtraso = Number(resposta?.data?.minutosAtrasoCheckin ?? 0);
      const atrasado = !!resposta?.data?.checkInAtrasado;
      notify({
        kind: atrasado ? 'warning' : 'success',
        title: atrasado ? 'Check-in sem foto (atrasado)' : 'Check-in realizado',
        message: atrasado
          ? `Ponto registrado sem foto, com atraso de ${Math.max(1, minutosAtraso)} min.`
          : 'Ponto de entrada registrado sem foto.',
        source: 'ponto',
      });
    } catch (err: any) {
      if (!err?.response && pendente) await guardarNoAparelho(pendente);
      else tratarErroCheckin(err);
    } finally {
      setLoadingAction(false);
    }
  };

  const tratarErroCheckout = (err: any) => {
    const status = err.response?.status;
    const msg = err.response?.data?.error;
    if (status === 403) {
      setError('Você não tem permissão para registrar ponto. Verifique o acesso ao módulo Ponto Eletrônico com o administrador.');
    } else if (status === 404 || msg?.toLowerCase().includes('check-in em aberto')) {
      setError('Seu ponto foi fechado.');
    } else {
      setError(msg || 'Não foi possível registrar checkout.');
    }
  };

  const handleCheckOut = async (semFoto: boolean, fotoAssimMesmo?: File) => {
    const motivo = motivoSemFoto.trim();
    if (semFoto && motivo.length < 15) {
      setError('Descreva o motivo em pelo menos 15 caracteres (ex.: permissão de câmera negada no Chrome).');
      return;
    }
    setLoadingAction(true);
    setError(null);
    let pendente: DadosPontoFila | null = null;
    try {
      const foto = semFoto ? null : (fotoAssimMesmo ?? (await capturarQuadroAtualComoArquivo()));
      if (!semFoto && !foto) {
        setError('Não foi possível capturar a imagem da câmera. Aguarde o vídeo carregar e tente novamente.');
        setLoadingAction(false);
        return;
      }
      const conferencia = !foto || fotoAssimMesmo ? 'sem-conferencia' : await conferirRostoAntes(foto);
      if (conferencia === 'parar') {
        setLoadingAction(false);
        return;
      }
      const pos = await obterPosicao();
      if (exigeGeolocalizacao && !pos) {
        setError(
          'Não foi possível obter sua localização. Verifique se o acesso à localização está permitido para este site no navegador e tente novamente. Se o GPS estiver buscando sinal, aguarde alguns segundos.'
        );
        setLoadingAction(false);
        return;
      }
      pendente = {
        tipo: 'checkout',
        observacao: observacao || undefined,
        latitude: pos?.latitude,
        longitude: pos?.longitude,
        ...(foto ? { foto } : { motivoSemFoto: motivo }),
      };
      if (usarFila) {
        await guardarNoAparelho(pendente);
        return;
      }
      await pontoService.checkOut({
        observacao,
        ...(pos && { latitude: pos.latitude, longitude: pos.longitude }),
        ...(foto ? { foto } : { motivoSemFoto: motivo }),
      });
      setObservacao('');
      closeCheckinModal();
      await refresh();
      notify({
        kind: fotoAssimMesmo ? 'warning' : 'success',
        title: 'Checkout realizado',
        message: foto
          ? 'Ponto de saída registrado com sucesso.' + textoConferenciaRosto(conferencia, !!fotoAssimMesmo)
          : 'Ponto de saída registrado sem foto.',
        source: 'ponto',
      });
    } catch (err: any) {
      if (!err?.response && pendente) await guardarNoAparelho(pendente);
      else tratarErroCheckout(err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCadastrarBiometria = async () => {
    if (!consentiuBiometria || !biometriaInfo) {
      setError('Leia e aceite o termo para cadastrar sua foto de referência.');
      return;
    }
    setLoadingAction(true);
    setError(null);
    try {
      const foto = await capturarQuadroAtualComoArquivo();
      if (!foto) {
        setError('Não foi possível capturar a imagem da câmera. Aguarde o vídeo carregar e tente novamente.');
        return;
      }
      await pontoService.cadastrarBiometria(foto, biometriaInfo.consentimentoVersao);
      await queryClient.invalidateQueries({ queryKey: ['ponto', 'biometria'] });
      notify({
        kind: 'success',
        title: 'Foto de referência enviada',
        message: 'Ela será usada para confirmar sua identidade ao bater o ponto.',
        source: 'ponto',
      });
      if (aposBiometria) {
        setModoCaptura(aposBiometria);
        setAposBiometria(null);
      } else {
        closeCheckinModal();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível cadastrar a foto. Tente novamente.');
    } finally {
      setLoadingAction(false);
    }
  };

  const pularBiometria = () => {
    setError(null);
    setModoCaptura(aposBiometria ?? 'checkin');
    setAposBiometria(null);
  };

  const confirmarComFoto = () => {
    if (modoCaptura === 'biometria') return void handleCadastrarBiometria();
    if (modoCaptura === 'checkout') return void handleCheckOut(false);
    return void handleCheckIn();
  };

  const tirarOutraFoto = () => {
    setError(null);
    descartarFotoNaoConferida();
  };

  const registrarAssimMesmo = () => {
    const foto = fotoNaoConferida?.foto;
    if (!foto) return;
    descartarFotoNaoConferida();
    if (modoCaptura === 'checkout') return void handleCheckOut(false, foto);
    return void handleCheckIn(foto);
  };

  const confirmarSemFoto = () => {
    if (modoCaptura === 'checkout') return void handleCheckOut(true);
    return void handleCheckInSemFoto();
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600 mb-2 font-display">
          Controle de jornada
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-viva-900 font-display leading-tight mb-2">
          Ponto Eletrônico
        </h1>
        <p className="text-viva-700 font-serif text-base">
          Registre seu check-in e checkout atual.
        </p>
      </div>

      {/* Relógio + Ação */}
      <div className="card stagger-2">
        <div className="flex items-center justify-center mb-6 py-6 rounded-2xl bg-gradient-to-br from-viva-50/80 to-viva-100/40 border border-viva-200/50">
          <LiveClock />
        </div>

        <h3 className="text-xs font-semibold uppercase tracking-wider text-viva-600 mb-4 font-display">
          Registrar ponto
        </h3>
        {listaEscalas.length > 1 && (
          <div className="w-full max-w-sm mx-auto mb-4 text-center space-y-1">
            <label className="block text-xs font-semibold text-viva-800 mb-1 font-display">
              Onde está registrando o ponto
            </label>
            {escalaAutoStatus === 'loading' && !escalaIdEfetivo && (
              <p className="text-sm text-viva-600 font-serif">A localizar a unidade mais próxima (opcional)…</p>
            )}
            {escalaIdEfetivo &&
              (escalaAutoStatus !== 'loading' || escalaIdEfetivo !== selectedEscalaId) && (
                <p className="input w-full text-sm py-2.5 bg-viva-50/80 text-viva-900 font-medium text-center">
                  {listaEscalas.find((e) => e.id === escalaIdEfetivo)?.nome ?? '—'}
                </p>
              )}
          </div>
        )}
        <div className="flex flex-col items-center gap-3 text-center mb-6">
          {escalaIdEfetivo === PONTO_SEM_ESCALA_ESCALA_ID ? (
            <p className="text-xs text-viva-600 font-serif">
              <span className="font-medium text-viva-800">Ponto sem escala de plantão</span>
            </p>
          ) : plantaoHojeExibir ? (
            <p className="text-xs text-viva-600 font-serif">
              <span className="font-medium text-viva-800">
                {formatDiaPlantaoCurto(plantaoHojeExibir.data)} ·{' '}
                {plantaoHojeExibir.faixaHorario?.trim() || '—'}
              </span>
            </p>
          ) : mostrarAvisoCalendarioSemPlantaoHoje ? (
            <p className="text-xs text-viva-600 font-serif">
              Você não tem plantão nesta escala hoje (conforme seu calendário de escalas).
            </p>
          ) : null}
          {plantaoHojeExibir ? (
            <p className="text-xs text-viva-600">
              Entrada: {formatHoraCurta(plantaoHojeExibir.horaInicio)} · Saída: {formatHoraCurta(plantaoHojeExibir.horaFim)}
            </p>
          ) : (configHorario.horarioEntrada || configHorario.horarioSaida) && (
            <p className="text-xs text-viva-600">
              Entrada: {configHorario.horarioEntrada ?? '—'} · Saída: {configHorario.horarioSaida ?? '—'}
            </p>
          )}
          {mostrarAtrasoCheckin && (
            <p className="text-xs text-amber-700 font-medium">
              Check-in em atraso (acima de {TOLERANCIA_MINUTOS_ATRASO_CHECKIN} min de tolerância).
            </p>
          )}
        </div>

        {biometriaInfo?.habilitado && (
          <BiometriaStatusAviso
            info={biometriaInfo}
            onCadastrar={() => abrirModalCamera('biometria')}
          />
        )}

        {!online && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-center text-[11px] text-amber-900 font-serif">
            Sem internet. Os pontos serão guardados neste aparelho e enviados automaticamente quando a conexão voltar.
          </p>
        )}

        {fila.length > 0 && (
          <FilaOfflineAviso
            fila={fila}
            online={online}
            sincronizando={sincronizando}
            onEnviar={() => void sincronizar()}
            onDescartar={(id) => void descartar(id)}
          />
        )}

        {error && !checkinModalOpen && (
          <p className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">
            {error}
          </p>
        )}

        <div className="flex justify-center">
          {!registroAberto ? (
            canCheckIn || podeCheckinOffline ? (
              <button
                type="button"
                className="btn btn-primary px-8 py-3"
                onClick={openCheckinModal}
                disabled={loadingAction}
              >
                Bater ponto (entrada)
              </button>
            ) : (
              <p className="text-xs text-viva-600 font-serif">
                {loadingPainel || canCheckInPending
                  ? 'Carregando dados do ponto…'
                  : canCheckInErro
                    ? 'Não foi possível verificar o registro de ponto (servidor ou rede). Confirme se o backend está em execução e atualize a página.'
                    : canCheckInReason
                      ? canCheckInReason
                      : 'Sem plantão disponível para registrar ponto.'}
              </p>
            )
          ) : (
            <button
              className="btn btn-primary px-8 py-3"
              onClick={openCheckoutModal}
              disabled={loadingAction}
            >
              {loadingAction ? 'Registrando...' : 'Bater ponto (saída)'}
            </button>
          )}
        </div>
      </div>

      {/* Status de hoje */}
      <div className="card stagger-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-viva-600 mb-4 font-display">
          Status de hoje
        </h3>
        {loadingPainel ? (
          <p className="text-xs text-viva-600 font-serif">Carregando status...</p>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-viva-50/60 border border-viva-200/50">
                <p className="text-xs font-medium text-viva-700">Ponto atual</p>
                <span className="text-xs font-bold text-viva-900">
                  {registroAberto?.checkInAt
                    ? `Em aberto desde ${new Date(registroAberto.checkInAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : registroAberto
                      ? 'Em aberto'
                      : 'Fechado'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-viva-50/60 border border-viva-200/50">
                <p className="text-xs font-medium text-viva-700">Último ponto batido</p>
                <span className="text-xs font-bold text-viva-900">
                  {ultimoRegistroPonto?.checkInAt
                    ? (() => {
                        const d = new Date(ultimoRegistroPonto.checkInAt);
                        const hoje = new Date();
                        const mesmoDia = d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
                        return mesmoDia
                          ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      })()
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-viva-50/60 border border-viva-200/50">
                <p className="text-xs font-medium text-viva-700">Total de horas hoje</p>
                <span className="text-xs font-bold text-viva-900">{formatDuration(totalMinutosHoje)}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-viva-50/60 border border-viva-200/50">
                <p className="text-xs font-medium text-viva-700">Total da semana</p>
                <span className="text-xs font-bold text-viva-900">{formatDuration(totalMinutosSemana)}</span>
              </div>
            </div>

            {registrosHoje.length === 0 ? (
              <p className="text-xs text-viva-600 font-serif">Sem registros hoje.</p>
            ) : (
              <div className="space-y-2">
                {registrosHoje.map((r: any) => {
                  const nomeEscala =
                    r.escala?.nome ??
                    (!r.escalaId
                      ? 'Ponto sem escala de plantão'
                      : listaEscalas.find((e: { id?: string; nome?: string }) => e.id === r.escalaId)?.nome) ??
                    (listaEscalas.length > 0 ? (listaEscalas[0] as { nome?: string }).nome ?? 'Sem escala' : 'Sem escala');
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl bg-viva-50/50 border border-viva-200/50 px-4 py-3 hover:bg-viva-50/70 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-viva-900 font-display text-xs">{nomeEscala}</p>
                        <BadgeFaceSituacao situacao={r.faceSituacao} />
                      </div>
                      <p className="text-[10px] text-viva-600 mt-1">
                        Início: {new Date(r.checkInAt).toLocaleTimeString()} · Fim:{' '}
                        {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : 'Em aberto'} · Duração:{' '}
                        {r.duracaoMinutos ? formatDuration(r.duracaoMinutos) : '-'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {checkinModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-viva-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkin-foto-titulo"
        >
          <div className="card max-w-md w-full shadow-2xl border border-viva-200/80 max-h-[90vh] overflow-y-auto">
            <h2 id="checkin-foto-titulo" className="text-base font-bold text-viva-900 font-display mb-1">
              {modoCaptura === 'biometria'
                ? 'Foto de referência (reconhecimento facial)'
                : modoCaptura === 'checkout'
                  ? 'Foto do rosto — saída'
                  : 'Foto do rosto — check-in'}
            </h2>
            {modoCaptura === 'biometria' && (
              <p className="text-[11px] text-viva-600 font-serif mb-3">
                Rosto centralizado, sem óculos escuros, boné ou máscara, em local bem iluminado. Esta foto será
                comparada com as fotos tiradas ao bater o ponto.
              </p>
            )}

            <div className="space-y-3">
              {!cameraErro ? (
                <>
                  <div className="rounded-xl overflow-hidden bg-viva-900 w-full max-w-[min(100%,320px)] mx-auto aspect-[3/4] flex items-center justify-center relative">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover [transform:scaleX(-1)]"
                      playsInline
                      muted
                      autoPlay
                      onLoadedMetadata={(e) => {
                        if (e.currentTarget.videoWidth > 0) setVideoPronto(true);
                      }}
                      onPlaying={(e) => {
                        if (e.currentTarget.videoWidth > 0) setVideoPronto(true);
                      }}
                    />
                    {!videoPronto && (
                      <span className="absolute inset-0 flex items-center justify-center bg-viva-950/40 text-xs text-white font-serif px-4 text-center">
                        Iniciando câmera…
                      </span>
                    )}
                    {fotoNaoConferida && (
                      <img
                        src={fotoNaoConferida.previewUrl}
                        alt="Foto que não foi reconhecida"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    {conferindoRosto && (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-viva-950/55 text-sm text-white font-serif px-4 text-center">
                        <span className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Conferindo seu rosto…
                      </span>
                    )}
                  </div>
                  {fotoNaoConferida && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-1">
                      <p className="text-xs font-semibold text-amber-900">Rosto não reconhecido</p>
                      <p className="text-[11px] text-amber-800 font-serif leading-relaxed">{fotoNaoConferida.mensagem}</p>
                      <p className="text-[11px] text-amber-800 font-serif leading-relaxed">
                        Se registrar assim mesmo, o ponto será salvo e a foto será analisada pelo administrador.
                      </p>
                    </div>
                  )}
                  {videoPronto && !fotoNaoConferida && (
                    <p className="text-[11px] text-viva-600 font-serif text-center">
                      Quando estiver pronto, confirme — a captura ocorre no momento do clique.
                    </p>
                  )}
                  {mensagemAtrasoCheckin && modoCaptura === 'checkin' && (
                    <p className="text-[11px] text-amber-700 font-medium text-center">{mensagemAtrasoCheckin}</p>
                  )}
                  {modoCaptura === 'biometria' && (
                    <label className="flex items-start gap-2 rounded-xl border border-viva-200 bg-viva-50/60 p-3 text-[11px] text-viva-800 font-serif leading-relaxed">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={consentiuBiometria}
                        onChange={(e) => setConsentiuBiometria(e.target.checked)}
                      />
                      <span>{BIOMETRIA_CONSENTIMENTO_TEXTO}</span>
                    </label>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 space-y-3">
                  <p className="text-xs text-viva-800 font-serif leading-relaxed">
                    {cameraErroTipo === 'NotAllowedError' || cameraErroTipo === 'PermissionDeniedError'
                      ? 'A permissão da câmera foi negada. Em alguns navegadores o prompt não aparece novamente; habilite em Configurações do site e tente novamente.'
                      : 'Não foi possível abrir a câmera (permissão negada ou bloqueio do navegador). Ajuste a permissão no site ou use o formulário abaixo para registrar sem foto.'}
                  </p>
                  <button type="button" className="btn btn-primary text-sm w-full" onClick={tentarCameraNovamente}>
                    Tentar câmera novamente
                  </button>
                </div>
              )}
            </div>

            {showSemFotoSection && modoCaptura !== 'biometria' && (
              <div className="mt-5 pt-4 border-t border-viva-100 border-dashed">
                <p className="text-xs font-semibold text-viva-800 font-display mb-2">Sem câmera agora</p>
                <p className="text-[11px] text-viva-600 font-serif mb-2">
                  Se não for possível usar a câmera (permissão persistente, dispositivo corporativo, etc.), descreva o motivo em pelo menos 15 caracteres.
                </p>
                <textarea
                  className="w-full rounded-xl border border-viva-200 bg-white px-3 py-2 text-xs text-viva-900 font-serif min-h-[72px] resize-y"
                  placeholder="Ex.: permissão de câmera negada no Chrome e o site não mostra o prompt de novo"
                  value={motivoSemFoto}
                  onChange={(e) => setMotivoSemFoto(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <p className="text-[10px] text-viva-500 mt-1">{motivoSemFoto.trim().length}/500 · mínimo 15 caracteres</p>
              </div>
            )}

            {error && checkinModalOpen && (
              <p className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</p>
            )}

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-end mt-6 pt-4 border-t border-viva-100">
              <button type="button" className="btn text-sm border border-viva-300 bg-white text-viva-800" onClick={closeCheckinModal}>
                Cancelar
              </button>
              {fotoNaoConferida ? (
                <>
                  <button
                    type="button"
                    className="btn text-sm border border-amber-300 bg-white text-amber-800"
                    onClick={registrarAssimMesmo}
                    disabled={loadingAction}
                  >
                    Registrar assim mesmo
                  </button>
                  <button type="button" className="btn btn-primary text-sm" onClick={tirarOutraFoto} disabled={loadingAction}>
                    Tirar outra foto
                  </button>
                </>
              ) : (
                <>
              {modoCaptura === 'biometria' ? (
                aposBiometria && (
                  <button
                    type="button"
                    className="btn text-sm border border-viva-300 bg-white text-viva-800"
                    onClick={pularBiometria}
                    disabled={loadingAction}
                  >
                    Agora não, só bater o ponto
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="btn text-sm border border-viva-300 bg-white text-viva-800"
                  onClick={() => {
                    if (!showSemFotoSection) {
                      setShowSemFotoSection(true);
                      return;
                    }
                    confirmarSemFoto();
                  }}
                  disabled={loadingAction || (showSemFotoSection && motivoSemFoto.trim().length < 15)}
                >
                  {showSemFotoSection ? (loadingAction ? 'Registrando...' : 'Confirmar sem foto') : 'Registrar sem foto'}
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={confirmarComFoto}
                disabled={
                  loadingAction ||
                  cameraErro ||
                  !videoPronto ||
                  (modoCaptura === 'biometria' && !consentiuBiometria)
                }
              >
                {conferindoRosto
                  ? 'Conferindo rosto...'
                  : loadingAction
                    ? 'Enviando...'
                    : modoCaptura === 'biometria'
                      ? 'Salvar foto de referência'
                      : modoCaptura === 'checkout'
                        ? 'Confirmar saída (com foto)'
                        : 'Confirmar entrada (com foto)'}
              </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function FilaOfflineAviso({
  fila,
  online,
  sincronizando,
  onEnviar,
  onDescartar,
}: {
  fila: PontoOfflineItem[];
  online: boolean;
  sincronizando: boolean;
  onEnviar: () => void;
  onDescartar: (clientUuid: string) => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-viva-200 bg-viva-50/70 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-viva-900 font-display">
          {fila.length === 1 ? '1 ponto guardado no aparelho' : `${fila.length} pontos guardados no aparelho`}
        </p>
        <button
          type="button"
          className="btn-sm btn-primary"
          onClick={onEnviar}
          disabled={!online || sincronizando || !!fila[0]?.erro}
        >
          {sincronizando ? 'Enviando…' : 'Enviar agora'}
        </button>
      </div>
      <ul className="space-y-1.5">
        {fila.map((item) => (
          <li key={item.clientUuid} className="rounded-lg bg-white/80 border border-viva-200/70 px-3 py-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-viva-800">
                <strong>{item.tipo === 'checkin' ? 'Entrada' : 'Saída'}</strong> ·{' '}
                {new Date(item.capturadoEm).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {!item.foto && ' · sem foto'}
              </span>
              {item.erro && (
                <button
                  type="button"
                  className="text-red-700 font-semibold hover:underline"
                  onClick={() => {
                    if (window.confirm('Descartar este ponto? Ele não será registrado; use a justificativa de ponto se precisar.')) {
                      onDescartar(item.clientUuid);
                    }
                  }}
                >
                  Descartar
                </button>
              )}
            </div>
            {item.erro && <p className="mt-1 text-red-700">{item.erro}</p>}
          </li>
        ))}
      </ul>
      {fila[0]?.erro && (
        <p className="text-[10px] text-viva-600 font-serif">
          O servidor recusou o primeiro ponto da fila. Descarte-o para que os seguintes possam ser enviados.
        </p>
      )}
    </div>
  );
}

function BiometriaStatusAviso({ info, onCadastrar }: { info: MinhaBiometriaFacial; onCadastrar: () => void }) {
  const b = info.biometria;
  if (b?.status === 'APROVADA') return null;
  if (b?.status === 'PENDENTE_APROVACAO') {
    return (
      <p className="mb-4 rounded-xl border border-viva-200 bg-viva-50/70 p-3 text-center text-[11px] text-viva-700 font-serif">
        Sua foto de referência foi enviada e está em análise pela coordenação.
      </p>
    );
  }
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-center space-y-2">
      <p className="text-xs text-viva-800 font-serif">
        {b?.status === 'REJEITADA'
          ? `Sua foto de referência não foi aprovada${b.motivoRejeicao ? `: ${b.motivoRejeicao}` : ''}. Tire uma nova foto.`
          : 'Cadastre sua foto de referência para o reconhecimento facial do ponto.'}
      </p>
      <button type="button" className="btn btn-primary text-xs px-4 py-2" onClick={onCadastrar}>
        Cadastrar foto de referência
      </button>
    </div>
  );
}

export default PontoEletronico;
