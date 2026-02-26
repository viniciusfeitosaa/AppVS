import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { adminService, ValorPlantaoConfig } from '../services/admin.service';

const GRADES = [
  { id: 'mt', label: 'MT', desc: 'Plantão diurno (07h–19h)' },
  { id: 'sn', label: 'SN', desc: 'Plantão noturno (19h–07h)' },
];

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

  const { data: opcoesResp, isLoading: loadingOpcoes } = useQuery({
    queryKey: ['admin', 'valores-plantao', 'opcoes'],
    queryFn: () => adminService.getValoresPlantaoOpcoes(),
    enabled: !!user && isMaster,
  });

  const opcoes = opcoesResp?.data;
  const contratos = opcoes?.contratos ?? [];
  const subgrupos = opcoes?.subgrupos ?? [];
  const temContratoESubgrupo = !!contratoId && !!subgrupoId;

  const { data: resp, isLoading: loadingValores } = useQuery({
    queryKey: ['admin', 'valores-plantao', contratoId, subgrupoId],
    queryFn: () => adminService.getValoresPlantao(contratoId, subgrupoId),
    enabled: !!user && isMaster && temContratoESubgrupo,
  });

  const valores = resp?.data ?? [];

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
      setSuccess(`Valor do plantão ${GRADES.find((g) => g.id === gradeId)?.label ?? gradeId} atualizado.`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao salvar valor');
    } finally {
      setSaving(null);
    }
  };

  const onContratoChange = (id: string) => {
    setContratoId(id);
    setSubgrupoId((prev) => (id ? prev : ''));
    setDraft({});
  };

  const onSubgrupoChange = (id: string) => {
    setSubgrupoId(id);
    setDraft({});
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
          Selecione o contrato e o subgrupo. Cada escala (contrato + subgrupo) pode ter valores diferentes para MT e SN. Estes valores serão usados na área de Escalas ao atribuir ou replicar médicos.
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
                <option value="">Selecione o subgrupo</option>
                {subgrupos.filter((s) => s.ativo !== false).map((s) => (
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
          <h3 className="text-lg font-bold text-viva-900 mb-4">Valor por tipo de plantão</h3>
          {loadingValores ? (
            <p className="text-sm text-gray-600">Carregando valores...</p>
          ) : (
            <div className="space-y-6">
              {GRADES.map((grade) => (
                <div
                  key={grade.id}
                  className="flex flex-wrap items-end gap-4 p-4 rounded-xl border border-viva-200 bg-viva-50/30"
                >
                  <div className="min-w-[200px]">
                    <label className="block text-sm font-semibold text-viva-800 mb-1">
                      {grade.label} – {grade.desc}
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
          <p className="text-xs text-viva-600 mt-4">
            Na tela de Escalas, ao abrir um plantão na grade, o valor exibido virá da configuração do contrato e subgrupo daquela escala. Ao replicar médico para a semana, o valor configurado aqui será aplicado.
          </p>
        </div>
      )}
    </div>
  );
};

export default ValoresPlantao;
