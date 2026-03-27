import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  /** Valor/h (R$) usado no cálculo quando aplicável */
  valorHora?: number;
  valorCalculado?: number;
  /** Contrato só ponto: total repasse (valor hora repasse × horas) */
  valorRepasse?: number;
  /** Contrato só ponto: total cobrança (valor hora cobrança × horas) */
  valorCobranca?: number;
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

const formatValor = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const round2 = (n: number) => Math.round(n * 100) / 100;

const inferGradeIdFromCheckIn = (checkInAtIso: string): 'mt' | 'sn' => {
  const d = new Date(checkInAtIso);
  const h = d.getHours();
  // MT: 07:00–18:59, SN: 19:00–06:59
  return h >= 7 && h < 19 ? 'mt' : 'sn';
};

const exportHorasCsv = (
  agrupado: AgrupamentoHoras[],
  dataInicio: string,
  dataFim: string,
  apenasPonto: boolean
) => {
  const header = apenasPonto
    ? ['Médico', 'Escala', 'Registros', 'Total (min)', 'Total (horas)', 'Repasse (R$)', 'Cobrança (R$)']
    : ['Médico', 'Escala', 'Registros', 'Total (min)', 'Total (horas)', 'Valor (R$)'];
  const rows = agrupado.map((item) =>
    apenasPonto
      ? [
          escapeCsvCell(item.medicoNome),
          escapeCsvCell(item.escalaNome),
          escapeCsvCell(item.totalRegistros),
          escapeCsvCell(item.totalMinutos),
          escapeCsvCell(formatDuration(item.totalMinutos)),
          escapeCsvCell(item.valorRepasse != null ? formatValor(item.valorRepasse) : ''),
          escapeCsvCell(item.valorCobranca != null ? formatValor(item.valorCobranca) : ''),
        ]
      : [
          escapeCsvCell(item.medicoNome),
          escapeCsvCell(item.escalaNome),
          escapeCsvCell(item.totalRegistros),
          escapeCsvCell(item.totalMinutos),
          escapeCsvCell(formatDuration(item.totalMinutos)),
          escapeCsvCell(item.valorCalculado != null ? formatValor(item.valorCalculado) : ''),
        ]
  );
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-horas_${dataInicio}_${dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportHorasPdf = (
  agrupado: AgrupamentoHoras[],
  dataInicio: string,
  dataFim: string,
  apenasPonto: boolean
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text('Relatório de Horas por médico e escala', 14, 12);
  doc.setFontSize(10);
  doc.text(`Período: ${dataInicio} a ${dataFim}`, 14, 18);
  autoTable(doc, {
    startY: 24,
    head: [
      apenasPonto
        ? [['Médico', 'Escala', 'Registros', 'Total (horas)', 'Repasse (R$)', 'Cobrança (R$)']]
        : [['Médico', 'Escala', 'Registros', 'Total (horas)', 'Valor (R$)']],
    ],
    body: agrupado.map((item) =>
      apenasPonto
        ? [
            item.medicoNome,
            item.escalaNome,
            String(item.totalRegistros),
            formatDuration(item.totalMinutos),
            item.valorRepasse != null ? formatValor(item.valorRepasse) : '—',
            item.valorCobranca != null ? formatValor(item.valorCobranca) : '—',
          ]
        : [
            item.medicoNome,
            item.escalaNome,
            String(item.totalRegistros),
            formatDuration(item.totalMinutos),
            item.valorCalculado != null ? formatValor(item.valorCalculado) : '—',
          ]
    ),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [22, 163, 74] },
  });
  doc.save(`relatorio-horas_${dataInicio}_${dataFim}.pdf`);
};

const Relatorios = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const now = new Date();
  const [dataInicio, setDataInicio] = useState(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dataFim, setDataFim] = useState(formatDateInput(now));
  const [contratoId, setContratoId] = useState('');
  const [subgrupoId, setSubgrupoId] = useState('');
  const [equipeId, setEquipeId] = useState('');

  const { data: contratosResp } = useQuery({
    queryKey: ['admin', 'contratos-ativos', 'relatorio-filtros'],
    queryFn: () => adminService.listContratosAtivos({ page: 1, limit: 200 }),
    enabled: isMaster,
  });

  const { data: subgruposResp } = useQuery({
    queryKey: ['admin', 'contrato-subgrupos', contratoId],
    queryFn: () => adminService.listContratoSubgrupos(contratoId),
    enabled: isMaster && Boolean(contratoId),
  });

  const { data: equipesResp } = useQuery({
    queryKey: ['admin', 'contrato-equipes', contratoId],
    queryFn: () => adminService.listContratoEquipes(contratoId),
    enabled: isMaster && Boolean(contratoId),
  });

  const { data: equipesPorSubgrupoResp } = useQuery({
    queryKey: ['admin', 'equipes', subgrupoId],
    queryFn: () => adminService.listEquipes(subgrupoId ? { subgrupoId } : undefined),
    enabled: isMaster && Boolean(subgrupoId),
  });

  const contratos = contratosResp?.data ?? [];
  const subgruposList = subgruposResp?.data ?? [];
  const equipesList = equipesResp?.data ?? [];
  const equipesDoSubgrupo = equipesPorSubgrupoResp?.data ?? [];
  const equipesFiltradas =
    subgrupoId && equipesDoSubgrupo.length > 0
      ? equipesDoSubgrupo
      : subgrupoId && equipesList.length > 0
        ? equipesList.filter((e: any) => e.equipe?.subgrupo?.id === subgrupoId || e.equipe?.subgrupoId === subgrupoId)
        : equipesList;

  const { data: registrosResp, isLoading } = useQuery({
    queryKey: ['admin', 'registros-ponto', { contratoId, subgrupoId, equipeId, dataInicio, dataFim }],
    queryFn: () =>
      adminService.listRegistrosPonto({
        contratoAtivoId: contratoId || undefined,
        subgrupoId: subgrupoId || undefined,
        equipeId: equipeId || undefined,
        dataInicio: `${dataInicio}T00:00:00.000`,
        dataFim: `${dataFim}T23:59:59.999`,
      }),
    enabled: isMaster && Boolean(dataInicio && dataFim),
  });

  const contratoSelecionado = useMemo(
    () => (contratoId ? contratos.find((c: any) => c.id === contratoId) : null),
    [contratoId, contratos]
  );
  const usaEscalaEPonto = Boolean(contratoSelecionado?.usaEscala && contratoSelecionado?.usaPonto);
  const apenasPonto = Boolean(contratoSelecionado?.usaPonto && !contratoSelecionado?.usaEscala);

  const { data: valoresPlantaoResp } = useQuery({
    queryKey: ['admin', 'valores-plantao', contratoId, subgrupoId, 'relatorio'],
    queryFn: () => adminService.getValoresPlantao(contratoId, subgrupoId),
    enabled: isMaster && usaEscalaEPonto && Boolean(contratoId && subgrupoId),
  });

  /**
   * Valor total do plantão (12h) por grade, igual ao cadastro em Valores de plantão.
   * O valor/hora usado no relatório é (este valor ÷ 12), uma única vez — ver cálculo por registro.
   */
  const valorPlantao12hPorGrade = useMemo(() => {
    const map = new Map<string, number>();
    const rows = valoresPlantaoResp?.data ?? [];
    for (const v of rows as any[]) {
      const gradeId = String(v.gradeId ?? '').trim().toLowerCase();
      if (!gradeId) continue;
      const n = v.valorHora != null && v.valorHora !== '' ? Number(v.valorHora) : NaN;
      if (!Number.isFinite(n) || n <= 0) continue;
      map.set(gradeId, round2(n));
    }
    return map;
  }, [valoresPlantaoResp?.data]);

  if (!isMaster) {
    return (
      <div className="card border-l-4 border-red-400">
        <h2 className="text-xl font-bold text-viva-900 mb-2">Acesso restrito</h2>
        <p className="text-gray-600">Esta área de relatórios é exclusiva para o perfil Master.</p>
      </div>
    );
  }

  const raw = registrosResp?.data;
  const registros: RegistroPontoAdmin[] = Array.isArray(raw) ? raw : raw?.data ?? [];
  const valorHoraPorMedico: Record<string, number> = !Array.isArray(raw) && raw?.valorHoraPorMedico ? raw.valorHoraPorMedico : {};
  const valorHoraCobrancaPorMedico: Record<string, number> =
    !Array.isArray(raw) && raw?.valorHoraCobrancaPorMedico ? raw.valorHoraCobrancaPorMedico : {};
  const valorHoraPorMedicoEscala: Record<string, number> = !Array.isArray(raw) && raw?.valorHoraPorMedicoEscala ? raw.valorHoraPorMedicoEscala : {};
  const plantoesValorHoraPorEscalaDataGrade: Record<string, number> =
    !Array.isArray(raw) && raw?.plantoesValorHoraPorEscalaDataGrade ? raw.plantoesValorHoraPorEscalaDataGrade : {};

  const { agrupado, totalMinutos, totalRegistros } = useMemo(() => {
    const map = new Map<string, AgrupamentoHoras>();
    let somaMinutos = 0;

    for (const item of registros) {
      const minutos = item.duracaoMinutos || 0;
      const medId = item.medico?.id || 'sem-medico';
      const escId = item.escala?.id ?? (item as any).escalaId ?? 'sem-escala';
      const medNome = fixMojibake(item.medico?.nomeCompleto || 'Médico não identificado');
      const escNome = fixMojibake(item.escala?.nome || 'Escala não identificada');
      const key = `${medId}::${escId}`;
      const gradeIdInferido = inferGradeIdFromCheckIn(item.checkInAt);
      const dateStr = String(item.checkInAt ?? '').slice(0, 10);
      const valorPlantaoGravado =
        escId !== 'sem-escala' && dateStr
          ? plantoesValorHoraPorEscalaDataGrade[`${escId}::${dateStr}::${gradeIdInferido}`] ?? null
          : null;

      const total12h =
        valorPlantaoGravado != null && Number(valorPlantaoGravado) > 0
          ? Number(valorPlantaoGravado)
          : valorPlantao12hPorGrade.get(gradeIdInferido) ?? null;

      const valorHoraDerivado =
        usaEscalaEPonto && contratoId && subgrupoId && total12h != null && total12h > 0
          ? round2(total12h / 12)
          : null;
      const valorRegistro =
        valorHoraDerivado != null && valorHoraDerivado > 0 ? (minutos / 60) * valorHoraDerivado : null;

      const prev = map.get(key);
      if (prev) {
        prev.totalMinutos += minutos;
        prev.totalRegistros += 1;
        if (valorRegistro != null) {
          prev.valorCalculado = round2((prev.valorCalculado ?? 0) + valorRegistro);
        }
        if (escNome && escNome !== 'Escala não identificada' && prev.escalaNome === 'Escala não identificada') {
          prev.escalaNome = escNome;
        }
      } else {
        map.set(key, {
          key,
          medicoId: medId,
          medicoNome: medNome,
          escalaId: escId,
          escalaNome: escNome,
          totalMinutos: minutos,
          totalRegistros: 1,
          valorCalculado: valorRegistro != null ? round2(valorRegistro) : undefined,
        });
      }

      somaMinutos += minutos;
    }

    const rows = Array.from(map.values()).sort((a, b) => b.totalMinutos - a.totalMinutos);

    const temValorPlantaoGravadoNoPeriodo = Object.keys(plantoesValorHoraPorEscalaDataGrade).length > 0;
    const temValorBaseGrade = valorPlantao12hPorGrade.size > 0;
    // Fallback antigo: só quando não dá para usar nem valores-plantao nem valor gravado por plantão/dia
    if (
      !usaEscalaEPonto ||
      !contratoId ||
      !subgrupoId ||
      (!temValorBaseGrade && !temValorPlantaoGravadoNoPeriodo)
    ) {
      for (const row of rows) {
        const keyMedEsc = `${row.medicoId}::${row.escalaId}`;
        if (row.escalaId !== 'sem-escala') {
          const vh = valorHoraPorMedicoEscala[keyMedEsc];
          if (vh != null && vh > 0) {
            row.valorHora = vh;
            row.valorCalculado = (row.totalMinutos / 60) * vh;
          }
        } else if (row.medicoId !== 'sem-medico') {
          const vh = valorHoraPorMedico[row.medicoId];
          const vhCob = valorHoraCobrancaPorMedico[row.medicoId];
          if (apenasPonto) {
            if (vh != null && vh > 0) {
              row.valorRepasse = round2((row.totalMinutos / 60) * vh);
            }
            if (vhCob != null && vhCob > 0) {
              row.valorCobranca = round2((row.totalMinutos / 60) * vhCob);
            }
          } else if (vh != null && vh > 0) {
            row.valorHora = vh;
            row.valorCalculado = (row.totalMinutos / 60) * vh;
          }
        }
      }
    }

    return {
      agrupado: rows,
      totalMinutos: somaMinutos,
      totalRegistros: registros.length,
    };
  }, [
    contratoId,
    fixMojibake,
    registros,
    subgrupoId,
    usaEscalaEPonto,
    valorPlantao12hPorGrade,
    valorHoraPorMedico,
    valorHoraCobrancaPorMedico,
    valorHoraPorMedicoEscala,
    plantoesValorHoraPorEscalaDataGrade,
    apenasPonto,
  ]);

  const totaisRepasseCobranca = useMemo(() => {
    if (!apenasPonto) return { repasse: null as number | null, cobranca: null as number | null };
    let rep = 0;
    let cob = 0;
    let temRep = false;
    let temCob = false;
    for (const r of agrupado) {
      if (r.valorRepasse != null) {
        rep += r.valorRepasse;
        temRep = true;
      }
      if (r.valorCobranca != null) {
        cob += r.valorCobranca;
        temCob = true;
      }
    }
    return {
      repasse: temRep ? round2(rep) : null,
      cobranca: temCob ? round2(cob) : null,
    };
  }, [agrupado, apenasPonto]);

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">Relatório de Horas</h2>
        <p className="text-gray-600">Consolidação por médico e escala, com filtros de período.</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-viva-900 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
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
            <label htmlFor="contratoId" className="block text-sm font-semibold text-viva-800 mb-1">
              Contrato
            </label>
            <select
              id="contratoId"
              className="input"
              value={contratoId}
              onChange={(e) => {
                setContratoId(e.target.value);
                setSubgrupoId('');
                setEquipeId('');
              }}
            >
              <option value="">Todos</option>
              {contratos.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {fixMojibake(c.nome ?? c.id)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="subgrupoId" className="block text-sm font-semibold text-viva-800 mb-1">
              Subgrupo
            </label>
            <select
              id="subgrupoId"
              className="input"
              value={subgrupoId}
              onChange={(e) => {
                setSubgrupoId(e.target.value);
                setEquipeId('');
              }}
              disabled={!contratoId}
            >
              <option value="">Todos</option>
              {subgruposList.map((item: any) => (
                <option key={item.subgrupo?.id} value={item.subgrupo?.id ?? ''}>
                  {fixMojibake(item.subgrupo?.nome ?? '')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="equipeId" className="block text-sm font-semibold text-viva-800 mb-1">
              Equipe
            </label>
            <select
              id="equipeId"
              className="input"
              value={equipeId}
              onChange={(e) => setEquipeId(e.target.value)}
              disabled={!subgrupoId}
            >
              <option value="">Todas as equipes</option>
              {equipesFiltradas.map((item: any) => {
                const id = item.equipe?.id ?? item.id ?? '';
                const nome = item.equipe?.nome ?? item.nome ?? '';
                return (
                  <option key={id} value={id}>
                    {fixMojibake(nome)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${apenasPonto ? 'md:grid-cols-2 xl:grid-cols-5' : 'md:grid-cols-3'}`}>
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
        {apenasPonto && (
          <>
            <div className="card border-l-4 border-viva-500">
              <p className="text-xs uppercase tracking-wide text-viva-600">Total repasse</p>
              <p className="text-2xl font-bold text-viva-900 mt-1">
                {totaisRepasseCobranca.repasse != null ? formatValor(totaisRepasseCobranca.repasse) : '—'}
              </p>
            </div>
            <div className="card border-l-4 border-viva-600">
              <p className="text-xs uppercase tracking-wide text-viva-600">Total cobrança</p>
              <p className="text-2xl font-bold text-viva-900 mt-1">
                {totaisRepasseCobranca.cobranca != null ? formatValor(totaisRepasseCobranca.cobranca) : '—'}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-viva-900">Horas por médico e escala</h3>
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            disabled={isLoading || agrupado.length === 0}
            onClick={() => exportHorasCsv(agrupado, dataInicio, dataFim, apenasPonto)}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            Exportar CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary inline-flex items-center gap-2"
            disabled={isLoading || agrupado.length === 0}
            onClick={() => exportHorasPdf(agrupado, dataInicio, dataFim, apenasPonto)}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
            Exportar PDF
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
                  {apenasPonto ? (
                    <>
                      <th className="py-2 pr-4">Repasse (R$)</th>
                      <th className="py-2 pr-4">Cobrança (R$)</th>
                    </>
                  ) : (
                    <th className="py-2 pr-4">Valor (R$)</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {agrupado.map((item) => (
                  <tr key={item.key} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium text-viva-900">{item.medicoNome}</td>
                    <td className="py-2 pr-4 text-gray-700">{item.escalaNome}</td>
                    <td className="py-2 pr-4 text-gray-700">{item.totalRegistros}</td>
                    <td className="py-2 pr-4 font-semibold text-viva-900">{formatDuration(item.totalMinutos)}</td>
                    {apenasPonto ? (
                      <>
                        <td className="py-2 pr-4 text-gray-700">
                          {item.valorRepasse != null ? formatValor(item.valorRepasse) : '—'}
                        </td>
                        <td className="py-2 pr-4 text-gray-700">
                          {item.valorCobranca != null ? formatValor(item.valorCobranca) : '—'}
                        </td>
                      </>
                    ) : (
                      <td className="py-2 pr-4 text-gray-700">
                        {item.valorCalculado != null ? formatValor(item.valorCalculado) : '—'}
                      </td>
                    )}
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
