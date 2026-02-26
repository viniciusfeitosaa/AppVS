import { useState, useMemo } from 'react';
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

const ValoresPonto = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const [contratoId, setContratoId] = useState<string>('');
  const [subgrupoId, setSubgrupoId] = useState<string>('');
  const [mes, setMes] = useState<number>(() => new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(() => new Date().getFullYear());
  const [draftHoras, setDraftHoras] = useState<string>('');
  const [draftValor, setDraftValor] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: opcoesResp, isLoading: loadingOpcoes } = useQuery({
    queryKey: ['admin', 'config-ponto', 'opcoes'],
    queryFn: () => adminService.getConfigPontoOpcoes(),
    enabled: !!user && isMaster,
  });

  const opcoes = opcoesResp?.data;
  const contratos = opcoes?.contratos ?? [];
  const subgrupos = opcoes?.subgrupos ?? [];
  const temContratoESubgrupo = !!contratoId && !!subgrupoId;

  const { data: configResp, isLoading: loadingConfig } = useQuery({
    queryKey: ['admin', 'config-ponto', contratoId, subgrupoId],
    queryFn: () => adminService.getConfigPonto(contratoId, subgrupoId),
    enabled: !!user && isMaster && temContratoESubgrupo,
  });

  const config: ConfigPontoEletronico | null = configResp?.data ?? null;

  const horasPrevistasDisplay = draftHoras !== '' ? draftHoras : (config?.horasPrevistasMes != null ? String(config.horasPrevistasMes) : '');
  const valorHoraDisplay = draftValor !== '' ? draftValor : (config?.valorHora != null ? formatValor(config.valorHora) : '');

  const diasUteis = useMemo(() => getDiasUteis(ano, mes), [ano, mes]);

  const onContratoChange = (id: string) => {
    setContratoId(id);
    setSubgrupoId((prev) => (id ? prev : ''));
    setDraftHoras('');
    setDraftValor('');
  };

  const onSubgrupoChange = (id: string) => {
    setSubgrupoId(id);
    setDraftHoras('');
    setDraftValor('');
  };

  const handleSave = async () => {
    if (!contratoId || !subgrupoId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const horas = draftHoras !== '' ? parseInt(draftHoras, 10) : (config?.horasPrevistasMes ?? null);
      const valor = draftValor !== '' ? parseValorInput(draftValor) : (config?.valorHora != null ? parseFloat(String(config.valorHora)) : null);
      if (horas !== null && (Number.isNaN(horas) || horas < 0)) {
        throw new Error('Horas previstas deve ser um número válido.');
      }
      await adminService.setConfigPonto(contratoId, subgrupoId, horas ?? null, valor);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'config-ponto', contratoId, subgrupoId] });
      setDraftHoras('');
      setDraftValor('');
      setSuccess('Configuração salva com sucesso.');
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
          Por contrato e subgrupo (ex.: Enfermeiro), defina as <strong>horas previstas no mês</strong> e o <strong>valor da hora</strong> para os profissionais. Use a seção &quot;Dias úteis do mês&quot; para consultar quantos dias úteis tem cada mês (ex.: fevereiro/2026).
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
                {contratos.map((c) => (
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
                <option value="">Selecione o subgrupo</option>
                {subgrupos.filter((s) => s.ativo !== false).map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
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
          <h3 className="text-lg font-bold text-viva-900 mb-4">Horas previstas e valor da hora</h3>
          {loadingConfig ? (
            <p className="text-sm text-gray-600">Carregando configuração...</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-viva-200 bg-viva-50/30">
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
                <div className="min-w-[200px]">
                  <label className="block text-sm font-semibold text-viva-800 mb-1">Valor da hora (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input w-full max-w-[180px]"
                    placeholder="Ex: 85,00"
                    value={valorHoraDisplay}
                    onChange={(e) => setDraftValor(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-viva-600 mt-4">
            Estas informações podem ser usadas em relatórios e cálculos de produtividade por subgrupo (ex.: Enfermeiros).
          </p>
        </div>
      )}
    </div>
  );
};

export default ValoresPonto;
