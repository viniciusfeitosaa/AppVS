import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/admin.service';
import { fixMojibake } from '../utils/validation.util';

type RegistroPontoAdmin = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  duracaoMinutos: number | null;
  medico: {
    id: string;
    nomeCompleto: string;
    crm: string;
    email: string | null;
  } | null;
  escala: {
    id: string;
    nome: string;
    dataInicio: string;
    dataFim: string;
  } | null;
};

type AgrupamentoHoras = {
  key: string;
  medicoId: string;
  medicoNome: string;
  escalaId: string;
  escalaNome: string;
  totalMinutos: number;
  totalRegistros: number;
};

const formatDuration = (minutes: number) => {
  const safe = Math.max(0, minutes || 0);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
};

const formatDateInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const escapeCsvCell = (value: string | number): string => {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const exportHorasCsv = (agrupado: AgrupamentoHoras[], dataInicio: string, dataFim: string) => {
  const header = ['Médico', 'Escala', 'Registros', 'Total (min)', 'Total (horas)'];
  const rows = agrupado.map((item) => [
    escapeCsvCell(item.medicoNome),
    escapeCsvCell(item.escalaNome),
    escapeCsvCell(item.totalRegistros),
    escapeCsvCell(item.totalMinutos),
    escapeCsvCell(formatDuration(item.totalMinutos)),
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-horas_${dataInicio}_${dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const Relatorios = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const now = new Date();
  const [dataInicio, setDataInicio] = useState(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dataFim, setDataFim] = useState(formatDateInput(now));
  const [medicoId, setMedicoId] = useState('');
  const [escalaId, setEscalaId] = useState('');

  const { data: medicosResp } = useQuery({
    queryKey: ['admin', 'medicos', 'relatorio-filtros'],
    queryFn: () => adminService.listMedicos({ page: 1, limit: 200 }),
    enabled: isMaster,
  });

  const { data: escalasResp } = useQuery({
    queryKey: ['admin', 'escalas', 'relatorio-filtros'],
    queryFn: () => adminService.listEscalas({ page: 1, limit: 200 }),
    enabled: isMaster,
  });

  const { data: registrosResp, isLoading } = useQuery({
    queryKey: ['admin', 'registros-ponto', { medicoId, escalaId, dataInicio, dataFim }],
    queryFn: () =>
      adminService.listRegistrosPonto({
        medicoId: medicoId || undefined,
        escalaId: escalaId || undefined,
        dataInicio: `${dataInicio}T00:00:00.000`,
        dataFim: `${dataFim}T23:59:59.999`,
      }),
    enabled: isMaster && Boolean(dataInicio && dataFim),
  });

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Esta área de relatórios é exclusiva para o perfil Master.</p>
      </div>
    );
  }

  const medicos = medicosResp?.data || [];
  const escalas = escalasResp?.data || [];
  const registros: RegistroPontoAdmin[] = registrosResp?.data || [];

  const { agrupado, totalMinutos, totalRegistros } = useMemo(() => {
    const map = new Map<string, AgrupamentoHoras>();
    let somaMinutos = 0;

    for (const item of registros) {
      const minutos = item.duracaoMinutos || 0;
      const medId = item.medico?.id || 'sem-medico';
      const escId = item.escala?.id || 'sem-escala';
      const medNome = fixMojibake(item.medico?.nomeCompleto || 'Médico não identificado');
      const escNome = fixMojibake(item.escala?.nome || 'Escala não identificada');
      const key = `${medId}::${escId}`;

      const prev = map.get(key);
      if (prev) {
        prev.totalMinutos += minutos;
        prev.totalRegistros += 1;
      } else {
        map.set(key, {
          key,
          medicoId: medId,
          medicoNome: medNome,
          escalaId: escId,
          escalaNome: escNome,
          totalMinutos: minutos,
          totalRegistros: 1,
        });
      }

      somaMinutos += minutos;
    }

    const rows = Array.from(map.values()).sort((a, b) => b.totalMinutos - a.totalMinutos);
    return {
      agrupado: rows,
      totalMinutos: somaMinutos,
      totalRegistros: registros.length,
    };
  }, [registros]);

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">Relatório de Horas</h2>
        <p className="text-gray-600">Consolidação por médico e escala, com filtros de período.</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label htmlFor="dataInicio" className="block text-sm font-semibold text-viva-800 mb-1">
              Data início
            </label>
            <input
              id="dataInicio"
              type="date"
              className="input"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="dataFim" className="block text-sm font-semibold text-viva-800 mb-1">
              Data fim
            </label>
            <input
              id="dataFim"
              type="date"
              className="input"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="medicoId" className="block text-sm font-semibold text-viva-800 mb-1">
              Médico
            </label>
            <select
              id="medicoId"
              className="input"
              value={medicoId}
              onChange={(e) => setMedicoId(e.target.value)}
            >
              <option value="">Todos</option>
              {medicos.map((medico: any) => (
                <option key={medico.id} value={medico.id}>
                  {fixMojibake(medico.nomeCompleto)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="escalaId" className="block text-sm font-semibold text-viva-800 mb-1">
              Escala
            </label>
            <select
              id="escalaId"
              className="input"
              value={escalaId}
              onChange={(e) => setEscalaId(e.target.value)}
            >
              <option value="">Todas</option>
              {escalas.map((escala: any) => (
                <option key={escala.id} value={escala.id}>
                  {fixMojibake(escala.nome)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-viva-600">Total de horas</p>
          <p className="text-2xl font-bold text-viva-900 mt-1">{formatDuration(totalMinutos)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-viva-600">Total de registros</p>
          <p className="text-2xl font-bold text-viva-900 mt-1">{totalRegistros}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-viva-600">Agrupamentos</p>
          <p className="text-2xl font-bold text-viva-900 mt-1">{agrupado.length}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-viva-900">Horas por médico e escala</h3>
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            disabled={isLoading || agrupado.length === 0}
            onClick={() => exportHorasCsv(agrupado, dataInicio, dataFim)}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            Exportar CSV
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-gray-600">Carregando relatório...</p>
        ) : agrupado.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhum registro encontrado para os filtros informados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-viva-700 border-b">
                  <th className="py-2 pr-4">Médico</th>
                  <th className="py-2 pr-4">Escala</th>
                  <th className="py-2 pr-4">Registros</th>
                  <th className="py-2 pr-4">Total de horas</th>
                </tr>
              </thead>
              <tbody>
                {agrupado.map((item) => (
                  <tr key={item.key} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium text-viva-900">{item.medicoNome}</td>
                    <td className="py-2 pr-4 text-gray-700">{item.escalaNome}</td>
                    <td className="py-2 pr-4 text-gray-700">{item.totalRegistros}</td>
                    <td className="py-2 pr-4 font-semibold text-viva-900">{formatDuration(item.totalMinutos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Relatorios;
