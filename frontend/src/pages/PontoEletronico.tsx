import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { PONTO_SEM_ESCALA_ESCALA_ID } from '../constants/ponto';
import { pontoService } from '../services/ponto.service';
import {
  fimPlantaoCliente,
  inicioPlantaoCliente,
  type PlantaoAgendaInput,
} from '../utils/plantao-agenda';

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
    escalaId?: string | null;
    escala?: { nome?: string } | null;
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

const formatDiaPlantaoCurto = (dataStr: string) => {
  const d = new Date(`${dataStr}T12:00:00`);
  return d
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '');
};

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

  const { data: painelResp, isLoading: loadingPainel } = useQuery({
    queryKey: ['ponto', 'painel-inicial'],
    queryFn: () => pontoService.getPainelInicial(),
    enabled: !!user && isMedico,
    staleTime: 25 * 1000,
  });

  const meuDiaPayload = painelResp?.data?.meuDia as MeuDiaPontoApi | undefined;
  const meuDiaResp =
    painelResp != null && meuDiaPayload != null
      ? { success: painelResp.success, data: meuDiaPayload }
      : undefined;
  const listaEscalas = painelResp?.data?.escalas ?? [];
  const registroAbertoPainel = meuDiaPayload?.registroAberto;

  const { data: canCheckInResp } = useQuery({
    queryKey: ['ponto', 'can-checkin', selectedEscalaId],
    queryFn: () => pontoService.canCheckIn(selectedEscalaId!),
    enabled:
      !!user &&
      isMedico &&
      !!selectedEscalaId &&
      painelResp != null &&
      !registroAbertoPainel,
    refetchInterval:
      painelResp != null &&
      !registroAbertoPainel &&
      selectedEscalaId &&
      selectedEscalaId !== PONTO_SEM_ESCALA_ESCALA_ID
        ? 30000
        : false,
    staleTime: 10 * 1000,
  });

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (listaEscalas.length > 0 && !selectedEscalaId) {
      setSelectedEscalaId(listaEscalas[0].id);
    }
  }, [listaEscalas.length, selectedEscalaId]);

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

  const registroAberto = meuDiaResp?.data?.registroAberto;
  const registrosHoje = meuDiaResp?.data?.registrosHoje || [];
  const totalMinutosHoje = meuDiaResp?.data?.totalMinutosHoje || 0;
  const totalMinutosSemana = meuDiaResp?.data?.totalMinutosSemana || 0;
  const ultimoRegistroPonto = meuDiaResp?.data?.ultimoRegistroPonto;
  const equipeDoDia: string[] = meuDiaResp?.data?.equipeDoDia || [];
  const minhasEquipes: string[] = meuDiaResp?.data?.minhasEquipes || [];
  const equipeExibida: string[] =
    equipeDoDia.length > 0 ? equipeDoDia : minhasEquipes;
  const plantoesHoje: PlantaoHojeMeuDia[] = (meuDiaResp?.data as { plantoesHoje?: PlantaoHojeMeuDia[] } | undefined)
    ?.plantoesHoje ?? [];
  const plantoesHojeNaEscala = selectedEscalaId
    ? plantoesHoje.filter((p) => p.escalaId === selectedEscalaId)
    : [];
  const plantaoHojeExibir =
    selectedEscalaId &&
    selectedEscalaId !== PONTO_SEM_ESCALA_ESCALA_ID &&
    plantoesHojeNaEscala.length > 0
      ? escolherPlantaoMaisRelevante(plantoesHojeNaEscala, agora)
      : null;
  const configHorario: { horarioEntrada?: string | null; horarioSaida?: string | null } = meuDiaResp?.data?.configHorario || {};
  const exigeGeolocalizacao = !!meuDiaResp?.data?.exigeGeolocalizacao;

  const canCheckIn = !!canCheckInResp?.data?.allowed;
  const canCheckInReason: string | null = canCheckInResp?.data?.reason ?? null;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ponto', 'painel-inicial'] });
    await queryClient.invalidateQueries({ queryKey: ['ponto', 'meu-dia'] });
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

  const closeCheckinModal = () => {
    setVideoPronto(false);
    setMotivoSemFoto('');
    setShowSemFotoSection(false);
    setStreamAttachKey(0);
    setCheckinModalOpen(false);
  };

  const openCheckinModal = () => {
    if (listaEscalas.length > 0 && !selectedEscalaId) {
      setError('Selecione uma escala para realizar o check-in.');
      return;
    }
    if (!registroAberto && selectedEscalaId && canCheckInResp?.data?.allowed === false) {
      setError(null);
      return;
    }
    setError(null);
    setCameraErro(false);
    setVideoPronto(false);
    setMotivoSemFoto('');
    setShowSemFotoSection(false);
    setStreamAttachKey(0);
    setCheckinModalOpen(true);
    // Mesmo gesto do clique: necessário para Safari/iOS aceitar getUserMedia.
    void iniciarCamera();
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

  const handleCheckIn = async () => {
    setLoadingAction(true);
    setError(null);
    try {
      const foto = await capturarQuadroAtualComoArquivo();
      if (!foto) {
        setError(
          'Não foi possível capturar a imagem da câmera. Aguarde o vídeo carregar e posicione-se em frente à câmera antes de confirmar.'
        );
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
      await pontoService.checkIn({
        ...(selectedEscalaId && { escalaId: selectedEscalaId }),
        observacao,
        ...(pos && { latitude: pos.latitude, longitude: pos.longitude }),
        foto,
      });
      setObservacao('');
      closeCheckinModal();
      await refresh();
    } catch (err: any) {
      tratarErroCheckin(err);
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
    try {
      const pos = await obterPosicao();
      if (exigeGeolocalizacao && !pos) {
        setError(
          'Não foi possível obter sua localização. Verifique se o acesso à localização está permitido para este site no navegador e tente novamente. Se o GPS estiver buscando sinal, aguarde alguns segundos.'
        );
        setLoadingAction(false);
        return;
      }
      await pontoService.checkInSemFoto({
        ...(selectedEscalaId && { escalaId: selectedEscalaId }),
        observacao,
        motivoSemFoto: m,
        ...(pos && { latitude: pos.latitude, longitude: pos.longitude }),
      });
      setObservacao('');
      closeCheckinModal();
      await refresh();
    } catch (err: any) {
      tratarErroCheckin(err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCheckOut = async () => {
    setLoadingAction(true);
    setError(null);
    try {
      const pos = await obterPosicao();
      if (exigeGeolocalizacao && !pos) {
        setError(
          'Não foi possível obter sua localização. Verifique se o acesso à localização está permitido para este site no navegador e tente novamente. Se o GPS estiver buscando sinal, aguarde alguns segundos.'
        );
        setLoadingAction(false);
        return;
      }
      await pontoService.checkOut({
        observacao,
        ...(pos && { latitude: pos.latitude, longitude: pos.longitude }),
      });
      setObservacao('');
      await refresh();
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.error;
      if (status === 403) {
        setError('Você não tem permissão para registrar ponto. Verifique o acesso ao módulo Ponto Eletrônico com o administrador.');
      } else if (status === 404 || msg?.toLowerCase().includes('check-in em aberto')) {
        setError('Seu ponto foi fechado.');
      } else {
        setError(msg || 'Não foi possível registrar checkout.');
      }
    } finally {
      setLoadingAction(false);
    }
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
          <div className="w-full max-w-sm mx-auto mb-4 text-left">
            <label className="block text-xs font-semibold text-viva-800 mb-1 font-display">
              Onde está registrando o ponto
            </label>
            <select
              className="input w-full text-sm"
              value={selectedEscalaId}
              onChange={(e) => setSelectedEscalaId(e.target.value)}
            >
              {listaEscalas.map((e: { id: string; nome: string }) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col items-center gap-3 text-center mb-6">
          <p className="text-sm text-viva-800 font-medium font-serif">
            {equipeExibida.length > 0 ? equipeExibida.join(', ') : '—'}
          </p>
          {selectedEscalaId === PONTO_SEM_ESCALA_ESCALA_ID ? (
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
          ) : selectedEscalaId ? (
            <p className="text-xs text-viva-600 font-serif">Sem plantão seu nesta escala para hoje.</p>
          ) : null}
          {(configHorario.horarioEntrada || configHorario.horarioSaida) && (
            <p className="text-xs text-viva-600">
              Entrada: {configHorario.horarioEntrada ?? '—'} · Saída: {configHorario.horarioSaida ?? '—'}
            </p>
          )}
        </div>

        {error && !checkinModalOpen && (
          <p className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">
            {error}
          </p>
        )}

        <div className="flex justify-center">
          {!registroAberto ? (
            canCheckIn ? (
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
                {canCheckInReason ? canCheckInReason : 'Sem plantão disponível para registrar ponto.'}
              </p>
            )
          ) : (
            <button
              className="btn btn-primary px-8 py-3"
              onClick={handleCheckOut}
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
                      <p className="font-semibold text-viva-900 font-display text-xs">{nomeEscala}</p>
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
              Foto do rosto — check-in
            </h2>

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
                  </div>
                  {videoPronto && (
                    <p className="text-[11px] text-viva-600 font-serif text-center">
                      Quando estiver pronto, confirme — a captura ocorre no momento do clique.
                    </p>
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

            {showSemFotoSection && (
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
              <button
                type="button"
                className="btn text-sm border border-viva-300 bg-white text-viva-800"
                onClick={() => {
                  if (!showSemFotoSection) {
                    setShowSemFotoSection(true);
                    return;
                  }
                  void handleCheckInSemFoto();
                }}
                disabled={loadingAction || (showSemFotoSection && motivoSemFoto.trim().length < 15)}
              >
                {showSemFotoSection ? (loadingAction ? 'Registrando...' : 'Confirmar sem foto') : 'Registrar sem foto'}
              </button>
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={handleCheckIn}
                disabled={loadingAction || cameraErro || !videoPronto}
              >
                {loadingAction ? 'Registrando...' : 'Confirmar entrada (com foto)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PontoEletronico;
