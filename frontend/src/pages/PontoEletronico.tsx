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
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Somente médicos podem registrar ponto eletrônico.</p>
      </div>
    );
  }

  const registroAberto = meuDiaResp?.data?.registroAberto;
  const registrosHoje = meuDiaResp?.data?.registrosHoje || [];
  const totalMinutosHoje = meuDiaResp?.data?.totalMinutosHoje || 0;
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
      setError(err.response?.data?.error || 'Não foi possível registrar check-in.');
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
      setError(err.response?.data?.error || 'Não foi possível registrar checkout.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">Ponto Eletrônico</h2>
        <p className="text-gray-600">Registre seu check-in e checkout atual.</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-center gap-4 mb-6 py-4 bg-viva-50 rounded-xl">
          <span className="text-4xl font-mono font-bold text-viva-900 tabular-nums" aria-live="polite">
            {formatClock(agora)}
          </span>
        </div>

        <h3 className="text-lg font-bold text-viva-900 mb-4">Registrar ponto</h3>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-viva-800 font-medium">
            Equipe {equipeExibida.length > 0 ? equipeExibida.join(', ') : '—'}
          </p>
          {(configHorario.horarioEntrada || configHorario.horarioSaida) && (
            <p className="text-sm text-viva-700">
              Entrada: {configHorario.horarioEntrada ?? '—'} | Saída: {configHorario.horarioSaida ?? '—'}
            </p>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}

        <div className="mt-4 flex justify-center">
          {!registroAberto ? (
            <button
              className="btn btn-primary text-lg px-8 py-3"
              onClick={handleCheckIn}
              disabled={loadingAction}
            >
              {loadingAction ? 'Registrando...' : 'Bater ponto (entrada)'}
            </button>
          ) : (
            <button
              className="btn btn-primary text-lg px-8 py-3"
              onClick={handleCheckOut}
              disabled={loadingAction}
            >
              {loadingAction ? 'Registrando...' : 'Bater ponto (saída)'}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-2">Status de hoje</h3>
        {isLoading ? (
          <p className="text-sm text-gray-600">Carregando status...</p>
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-2">
              Ponto atual:{' '}
              <span className="font-semibold text-viva-900">
                {registroAberto ? `Em aberto desde ${new Date(registroAberto.checkInAt).toLocaleTimeString()}` : 'Fechado'}
              </span>
            </p>
            <p className="text-sm text-gray-700 mb-4">
              Total de horas hoje: <span className="font-semibold text-viva-900">{formatDuration(totalMinutosHoje)}</span>
            </p>

            {registrosHoje.length === 0 ? (
              <p className="text-sm text-gray-600">Sem registros hoje.</p>
            ) : (
              <div className="space-y-2">
                {registrosHoje.map((r: any) => (
                  <div key={r.id} className="border border-viva-200 rounded-lg px-3 py-2">
                    <p className="font-medium text-viva-900">{r.escala?.nome ?? 'Sem escala'}</p>
                    <p className="text-xs text-gray-600">
                      Início: {new Date(r.checkInAt).toLocaleTimeString()} | Fim:{' '}
                      {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : 'Em aberto'} | Duração:{' '}
                      {r.duracaoMinutos ? formatDuration(r.duracaoMinutos) : '-'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PontoEletronico;
