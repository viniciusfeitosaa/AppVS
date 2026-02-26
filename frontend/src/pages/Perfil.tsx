import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { medicoService } from '../services/medico.service';
import { adminService, AcessoModuloItem } from '../services/admin.service';
import { fixMojibake, formatCRM } from '../utils/validation.util';
import {
  DOCUMENTO_LABEL_BY_FIELD,
  DOCUMENTOS_PERFIL_FIELDS,
  DOCUMENTO_TIPO_BY_FIELD,
  DocumentoPerfilField,
} from '../constants/documentosPerfil';
import { MODULO_LABEL, ModuloSistema } from '../constants/modulos';
import { ESPECIALIDADES_MEDICAS } from '../constants/profissoesEspecialidades';

type TabPerfil = 'pessoais' | 'bancarios' | 'documentos';

const Perfil = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.role === 'MASTER';
  const [activeTab, setActiveTab] = useState<TabPerfil>('pessoais');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [documentosSelecionados, setDocumentosSelecionados] = useState<
    Partial<Record<DocumentoPerfilField, File>>
  >({});
  const [savingAcessos, setSavingAcessos] = useState(false);
  const [acessosDraft, setAcessosDraft] = useState<AcessoModuloItem[]>([]);
  const [form, setForm] = useState<{
    especialidades: string[];
    telefone: string;
    estadoCivil: string;
    enderecoResidencial: string;
    dadosBancarios: string;
    chavePix: string;
  }>({
    especialidades: [],
    telefone: '',
    estadoCivil: '',
    enderecoResidencial: '',
    dadosBancarios: '',
    chavePix: '',
  });
  const [buscaEspecialidade, setBuscaEspecialidade] = useState('');

  const { data: perfilMedico, isLoading } = useQuery({
    queryKey: ['medico', 'perfil', 'pagina-perfil', user?.id],
    queryFn: async () => {
      const response = await medicoService.getPerfil();
      return response.data;
    },
    enabled: !!user && !isMaster,
  });

  const { data: acessosResp, isLoading: loadingAcessos } = useQuery({
    queryKey: ['admin', 'acessos-modulos', user?.id],
    queryFn: () => adminService.getMatrizAcessosModulos(),
    enabled: !!user && isMaster,
  });

  useEffect(() => {
    if (!acessosResp?.data) return;
    setAcessosDraft([...(acessosResp.data.master || []), ...(acessosResp.data.medico || [])]);
  }, [acessosResp]);

  useEffect(() => {
    if (!perfilMedico) return;
    setForm((prev) => ({
      ...prev,
      especialidades: perfilMedico.especialidades ?? [],
      telefone: perfilMedico.telefone ?? '',
      estadoCivil: perfilMedico.estadoCivil ?? '',
      enderecoResidencial: perfilMedico.enderecoResidencial ?? '',
      dadosBancarios: perfilMedico.dadosBancarios ?? '',
      chavePix: perfilMedico.chavePix ?? '',
    }));
  }, [perfilMedico]);

  const perfil = isMaster ? user : perfilMedico || user;
  const perfilMedicoAtual = !isMaster ? perfilMedico : null;
  const telefone = !isMaster && perfil && 'telefone' in perfil ? perfil.telefone : null;

  const handleChange = (field: keyof typeof form, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEspecialidade = (nome: string) => {
    setForm((prev) => ({
      ...prev,
      especialidades: prev.especialidades.includes(nome)
        ? prev.especialidades.filter((x) => x !== nome)
        : [...prev.especialidades, nome],
    }));
  };

  const handleSalvar = async () => {
    if (isMaster || !perfilMedico) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await medicoService.updatePerfil({
        especialidades:
          form.especialidades.length > 0
            ? form.especialidades
            : (perfilMedico.especialidades ?? []),
        telefone: form.telefone || perfilMedico.telefone || '',
        estadoCivil: form.estadoCivil || perfilMedico.estadoCivil || '',
        enderecoResidencial: form.enderecoResidencial || perfilMedico.enderecoResidencial || '',
        dadosBancarios: form.dadosBancarios || perfilMedico.dadosBancarios || '',
        chavePix: form.chavePix || perfilMedico.chavePix || '',
        documentos: documentosSelecionados,
      });
      await queryClient.invalidateQueries({ queryKey: ['medico', 'perfil'] });
      setSuccess('Perfil atualizado com sucesso.');
      setDocumentosSelecionados({});
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível atualizar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const matrizPorModulo = useMemo(() => {
    const map = new Map<ModuloSistema, { master: boolean; medico: boolean }>();
    for (const modulo of Object.keys(MODULO_LABEL) as ModuloSistema[]) {
      map.set(modulo, { master: true, medico: false });
    }
    for (const item of acessosDraft) {
      const row = map.get(item.modulo);
      if (!row) continue;
      if (item.perfil === 'MASTER') row.master = item.permitido;
      if (item.perfil === 'MEDICO') row.medico = item.permitido;
    }
    return map;
  }, [acessosDraft]);

  const updateAcessoItem = (perfil: 'MASTER' | 'MEDICO', modulo: ModuloSistema, permitido: boolean) => {
    setAcessosDraft((prev) => {
      const idx = prev.findIndex((p) => p.perfil === perfil && p.modulo === modulo);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], permitido };
        return copy;
      }
      return [...prev, { perfil, modulo, permitido }];
    });
  };

  const salvarAcessos = async () => {
    setSavingAcessos(true);
    setError(null);
    setSuccess(null);
    try {
      await adminService.salvarMatrizAcessosModulos(acessosDraft);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'acessos-modulos'] });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'modulos-acesso'] });
      setSuccess('Permissões de módulos atualizadas com sucesso.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível atualizar permissões de módulos.');
    } finally {
      setSavingAcessos(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <p className="text-sm text-gray-600">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card border-l-4 border-viva-500">
        <h2 className="text-2xl font-bold text-viva-900 mb-1">Minha Conta</h2>
        <p className="text-gray-600">
          Informações do seu perfil de acesso na plataforma.
        </p>
      </div>

      {!!error && (
        <div className="card border-l-4 border-red-400">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {!!success && (
        <div className="card border-l-4 border-green-400">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="flex gap-1 border-b border-viva-200">
        {(['pessoais', 'bancarios', 'documentos'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition ${
              activeTab === tab
                ? 'bg-viva-100 text-viva-900 border border-viva-200 border-b-0 -mb-px'
                : 'text-viva-600 hover:bg-viva-50 hover:text-viva-800'
            }`}
          >
            {tab === 'pessoais' && 'Dados Pessoais'}
            {tab === 'bancarios' && 'Dados Bancários'}
            {tab === 'documentos' && 'Documentos'}
          </button>
        ))}
      </div>

      {activeTab === 'pessoais' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-bold text-viva-900 mb-4">Dados Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-viva-50 rounded-lg p-3">
                <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Nome completo</p>
                <p className="text-base font-semibold text-viva-900 mt-1">
                  {fixMojibake(perfil?.nomeCompleto || '-')}
                </p>
              </div>
              <div className="bg-viva-50 rounded-lg p-3">
                <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">E-mail</p>
                <p className="text-base font-semibold text-viva-900 mt-1">
                  {perfil?.email ? fixMojibake(perfil.email) : '-'}
                </p>
              </div>
              {!isMaster && (
                <div className="bg-viva-50 rounded-lg p-3 md:col-span-2 border-2 border-viva-200">
                  <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">
                    Identificação profissional
                  </p>
                  <p className="text-sm text-viva-800 mt-1">
                    <span className="font-semibold">Profissão:</span>{' '}
                    {perfil && 'profissao' in perfil ? fixMojibake(perfil.profissao) : 'Médico'}
                  </p>
                  {(perfil && 'especialidades' in perfil && (perfil.especialidades?.length ?? 0) > 0) && (
                    <p className="text-sm text-viva-800 mt-0.5">
                      <span className="font-semibold">Especialidades:</span>{' '}
                      {fixMojibake((perfil.especialidades ?? []).join(', '))}
                    </p>
                  )}
                </div>
              )}
              {!isMaster && (
                <div className="bg-viva-50 rounded-lg p-3">
                  <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">CRM</p>
                  <p className="text-base font-semibold text-viva-900 mt-1">
                    {formatCRM(perfil?.crm || '') || '-'}
                  </p>
                </div>
              )}
              {!isMaster && (
                <div className="bg-viva-50 rounded-lg p-3 md:col-span-2">
                  <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">
                    Atualizar especialidades (várias permitidas)
                  </p>
                  <input
                    type="text"
                    placeholder="Buscar especialidade..."
                    className="input mt-2"
                    value={buscaEspecialidade}
                    onChange={(e) => setBuscaEspecialidade(e.target.value)}
                  />
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 mt-2 space-y-1">
                    {ESPECIALIDADES_MEDICAS.filter((e) =>
                      e.toLowerCase().includes(buscaEspecialidade.toLowerCase())
                    ).map((esp) => (
                      <label
                        key={esp}
                        className="flex items-center gap-2 cursor-pointer hover:bg-viva-50 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={form.especialidades.includes(esp)}
                          onChange={() => toggleEspecialidade(esp)}
                          className="rounded border-viva-600 text-viva-600"
                        />
                        <span className="text-sm text-viva-900">{esp}</span>
                      </label>
                    ))}
                  </div>
                  {form.especialidades.length > 0 && (
                    <p className="mt-1 text-xs text-gray-600">
                      Selecionadas: {form.especialidades.join(', ')}
                    </p>
                  )}
                </div>
              )}
              {!isMaster && (
                <div className="bg-viva-50 rounded-lg p-3">
                  <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Telefone</p>
                  <input
                    className="input mt-2"
                    value={form.telefone || telefone || ''}
                    onChange={(e) => handleChange('telefone', e.target.value)}
                  />
                </div>
              )}
              {!isMaster && (
                <div className="bg-viva-50 rounded-lg p-3">
                  <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Vínculo</p>
                  <p className="text-base font-semibold text-viva-900 mt-1">
                    {perfil?.vinculo ? fixMojibake(perfil.vinculo) : 'Associado'}
                  </p>
                </div>
              )}
              {!isMaster && (
                <div className="bg-viva-50 rounded-lg p-3">
                  <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Estado civil</p>
                  <input
                    className="input mt-2"
                    value={form.estadoCivil || perfilMedicoAtual?.estadoCivil || ''}
                    onChange={(e) => handleChange('estadoCivil', e.target.value)}
                  />
                </div>
              )}
              {!isMaster && (
                <div className="bg-viva-50 rounded-lg p-3 md:col-span-2">
                  <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Endereço residencial</p>
                  <textarea
                    className="input mt-2 min-h-[84px]"
                    value={form.enderecoResidencial || perfilMedicoAtual?.enderecoResidencial || ''}
                    onChange={(e) => handleChange('enderecoResidencial', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-bold text-viva-900 mb-4">Acesso</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-viva-200 px-3 py-2">
                <span className="text-sm text-gray-600">Perfil</span>
                <span className="text-sm font-semibold text-viva-900">
                  {isMaster ? 'Master' : 'Profissional'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-viva-200 px-3 py-2">
                <span className="text-sm text-gray-600">Status</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                  Ativo
                </span>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-viva-50 p-3">
              <p className="text-xs text-viva-700">
                {isMaster
                  ? 'Como usuário Master, você pode gerenciar médicos, contratos, escalas e relatórios.'
                  : 'Se precisar atualizar dados cadastrais, solicite ao administrador Master.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bancarios' && (
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-4">Dados Bancários</h3>
          {isMaster ? (
            <p className="text-sm text-gray-600">Disponível apenas para perfil profissional.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div className="bg-viva-50 rounded-lg p-3 md:col-span-2">
                <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Dados bancários</p>
                <textarea
                  className="input mt-2 min-h-[84px]"
                  value={form.dadosBancarios || perfilMedicoAtual?.dadosBancarios || ''}
                  onChange={(e) => handleChange('dadosBancarios', e.target.value)}
                />
              </div>
              <div className="bg-viva-50 rounded-lg p-3 md:col-span-2">
                <p className="text-xs text-viva-600 font-bold uppercase tracking-wider">Chave PIX</p>
                <input
                  className="input mt-2"
                  value={form.chavePix || perfilMedicoAtual?.chavePix || ''}
                  onChange={(e) => handleChange('chavePix', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documentos' && (
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-4">Documentos</h3>
          {isMaster ? (
            <p className="text-sm text-gray-600">Disponível apenas para perfil profissional.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DOCUMENTOS_PERFIL_FIELDS.map((field) => {
                const existing = perfilMedicoAtual?.documentos?.find((doc) => {
                  return doc.tipo === DOCUMENTO_TIPO_BY_FIELD[field];
                });
                return (
                  <div key={field} className="rounded-lg border border-viva-200 p-3">
                    <p className="text-sm font-semibold text-viva-900">{DOCUMENTO_LABEL_BY_FIELD[field]}</p>
                    <p className="text-xs text-gray-600 mt-1 mb-2">
                      {existing?.nomeArquivo ? `Atual: ${existing.nomeArquivo}` : 'Ainda não anexado'}
                    </p>
                    {existing?.url && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        <a
                          href={existing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary text-sm inline-flex items-center gap-1.5"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                          Abrir
                        </a>
                        <a
                          href={existing.url}
                          download={existing.nomeArquivo || undefined}
                          className="btn btn-secondary text-sm inline-flex items-center gap-1.5"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          Baixar
                        </a>
                      </div>
                    )}
                    <input
                      type="file"
                      className="input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setDocumentosSelecionados((prev) => ({ ...prev, [field]: file }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isMaster && (
        <div className="flex justify-end">
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={handleSalvar}
            type="button"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      )}

      {isMaster && (
        <div className="card">
          <h3 className="text-lg font-bold text-viva-900 mb-2">Administração de Acesso por Módulo</h3>
          <p className="text-sm text-gray-600 mb-4">
            Defina quais perfis têm acesso a cada módulo do sistema.
          </p>

          {loadingAcessos ? (
            <p className="text-sm text-gray-600">Carregando permissões...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-viva-700 border-b">
                    <th className="py-2 pr-4">Módulo</th>
                    <th className="py-2 pr-4">Master</th>
                    <th className="py-2 pr-4">Médico</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(MODULO_LABEL) as ModuloSistema[]).map((modulo) => {
                    const row = matrizPorModulo.get(modulo);
                    const masterChecked = row?.master ?? true;
                    const medicoChecked = row?.medico ?? false;
                    const masterLocked =
                      modulo === 'DASHBOARD' || modulo === 'CONFIGURACOES' || modulo === 'PERFIL';
                    return (
                      <tr key={modulo} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-medium text-viva-900">{MODULO_LABEL[modulo]}</td>
                        <td className="py-2 pr-4">
                          <input
                            type="checkbox"
                            checked={masterChecked}
                            disabled={masterLocked}
                            onChange={(e) => updateAcessoItem('MASTER', modulo, e.target.checked)}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="checkbox"
                            checked={medicoChecked}
                            onChange={(e) => updateAcessoItem('MEDICO', modulo, e.target.checked)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button className="btn btn-primary" disabled={savingAcessos} type="button" onClick={salvarAcessos}>
              {savingAcessos ? 'Salvando...' : 'Salvar permissões'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Perfil;
