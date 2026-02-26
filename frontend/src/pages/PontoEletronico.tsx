import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { pontoService } from '../services/ponto.service';

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
};

const PontoEletronico = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEscalaId, setSelectedEscalaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const escalas = escalasResp?.data || [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ponto', 'meu-dia'] });
  };

  const handleCheckIn = async () => {
    if (!selectedEscalaId) {
      setError('Selecione uma escala para realizar o check-in.');
      return;
    }

    setLoadingAction(true);
    setError(null);
    try {
      await pontoService.checkIn({ escalaId: selectedEscalaId, observacao });
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
      await pontoService.checkOut({ observacao });
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
        <p className="text-gray-600">Registre seu check-in e checkout no plantão atual.</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-4">Registrar ponto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            className="input"
            value={selectedEscalaId}
            onChange={(e) => setSelectedEscalaId(e.target.value)}
            disabled={!!registroAberto}
          >
            <option value="">Selecione a escala</option>
            {escalas.map((escala: any) => (
              <option key={escala.id} value={escala.id}>
                {escala.nome} ({escala.dataInicio?.slice(0, 10)} - {escala.dataFim?.slice(0, 10)})
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          {!registroAberto ? (
            <button className="btn btn-primary" onClick={handleCheckIn} disabled={loadingAction}>
              {loadingAction ? 'Registrando...' : 'Check-in'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCheckOut} disabled={loadingAction}>
              {loadingAction ? 'Registrando...' : 'Checkout'}
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
                    <p className="font-medium text-viva-900">{r.escala?.nome || 'Escala'}</p>
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
