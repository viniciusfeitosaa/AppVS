import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { pontoService } from '../services/ponto.service';

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

const PontoEletronico = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEscalaId, setSelectedEscalaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  const isMedico = user?.role === 'MEDICO';

  const { data: escalasResp } = useQuery({
    queryKey: ['ponto', 'minhas-escalas'],
    queryFn: () => pontoService.listMinhasEscalas(),
    enabled: isMedico,
  });

  const { data: meuDiaResp, isLoading } = useQuery({
    queryKey: ['ponto', 'meu-dia'],
    queryFn: () => pontoService.getMeuDia(),
    enabled: isMedico,
  });

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const listaEscalas = escalasResp?.data || [];
  useEffect(() => {
    if (listaEscalas.length > 0 && !selectedEscalaId) {
      setSelectedEscalaId(listaEscalas[0].id);
    }
  }, [listaEscalas.length, selectedEscalaId]);

  if (!isMedico) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-base font-bold text-viva-900 mb-2 font-display">Acesso restrito</h2>
        <p className="text-sm text-viva-700 font-serif">Somente médicos podem registrar ponto eletrônico.</p>
      </div>
    );
  }

  const registroAberto = meuDiaResp?.data?.registroAberto;
  const registrosHoje = meuDiaResp?.data?.registrosHoje || [];
  const totalMinutosHoje = meuDiaResp?.data?.totalMinutosHoje || 0;
  const ultimoRegistroPonto = meuDiaResp?.data?.ultimoRegistroPonto;
  const equipeDoDia: string[] = meuDiaResp?.data?.equipeDoDia || [];
  const minhasEquipes: string[] = meuDiaResp?.data?.minhasEquipes || [];
  const equipeExibida: string[] =
    equipeDoDia.length > 0 ? equipeDoDia : minhasEquipes;
  const configHorario: { horarioEntrada?: string | null; horarioSaida?: string | null } = meuDiaResp?.data?.configHorario || {};
  const exigeGeolocalizacao = !!meuDiaResp?.data?.exigeGeolocalizacao;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ponto', 'meu-dia'] });
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
    if (listaEscalas.length > 0 && !selectedEscalaId) {
      setError('Selecione uma escala para realizar o check-in.');
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
      await pontoService.checkIn({
        ...(selectedEscalaId && { escalaId: selectedEscalaId }),
        observacao,
        ...(pos && { latitude: pos.latitude, longitude: pos.longitude }),
      });
      setObservacao('');
      await refresh();
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        setError('Você não tem permissão para registrar ponto. Verifique o acesso ao módulo Ponto Eletrônico com o administrador.');
      } else {
        setError(err.response?.data?.error || 'Não foi possível registrar check-in.');
      }
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
          <span
            className="text-3xl md:text-4xl font-mono font-bold text-viva-900 tabular-nums tracking-tight"
            aria-live="polite"
          >
            {formatClock(agora)}
          </span>
        </div>

        <h3 className="text-xs font-semibold uppercase tracking-wider text-viva-600 mb-4 font-display">
          Registrar ponto
        </h3>
        <div className="flex flex-col items-center gap-3 text-center mb-6">
          <p className="text-sm text-viva-800 font-medium font-serif">
            {equipeExibida.length > 0 ? equipeExibida.join(', ') : '—'}
          </p>
          {(configHorario.horarioEntrada || configHorario.horarioSaida) && (
            <p className="text-xs text-viva-600">
              Entrada: {configHorario.horarioEntrada ?? '—'} · Saída: {configHorario.horarioSaida ?? '—'}
            </p>
          )}
        </div>

        {error && (
          <p className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">
            {error}
          </p>
        )}

        <div className="flex justify-center">
          {!registroAberto ? (
            <button
              className="btn btn-primary px-8 py-3"
              onClick={handleCheckIn}
              disabled={loadingAction}
            >
              {loadingAction ? 'Registrando...' : 'Bater ponto (entrada)'}
            </button>
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
        {isLoading ? (
          <p className="text-xs text-viva-600 font-serif">Carregando status...</p>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-viva-50/60 border border-viva-200/50">
                <p className="text-xs font-medium text-viva-700">Ponto atual</p>
                <span className="text-xs font-bold text-viva-900">
                  {registroAberto
                    ? `Em aberto desde ${new Date(registroAberto.checkInAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
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
            </div>

            {registrosHoje.length === 0 ? (
              <p className="text-xs text-viva-600 font-serif">Sem registros hoje.</p>
            ) : (
              <div className="space-y-2">
                {registrosHoje.map((r: any) => {
                  const nomeEscala =
                    r.escala?.nome ??
                    (r.escalaId && listaEscalas.find((e: { id?: string; nome?: string }) => e.id === r.escalaId)?.nome) ??
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
    </div>
  );
};

export default PontoEletronico;
