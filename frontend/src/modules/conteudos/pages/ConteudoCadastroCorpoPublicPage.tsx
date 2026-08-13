import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BrandLogo } from '../../../components/brand/BrandLogo';
import { TERMOS_CADASTRO_TITULO, TERMOS_CADASTRO_VERSAO } from '../../../constants/termosCadastro';
import {
  labelRegistroConselho,
  profissaoExigeRegistroConselho,
} from '../../../constants/profissaoConselho';
import { PROFISSOES_SAUDE } from '../../../constants/profissoesEspecialidades';
import { maskCpf } from '../../../features/cadastro-coop/utils/masks';
import { conteudoPublicService } from '../api/conteudo.service';

const ConteudoCadastroCorpoPublicPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [camposFaltantes, setCamposFaltantes] = useState<string[]>([]);
  const [eventoTitulo, setEventoTitulo] = useState('');
  const [form, setForm] = useState({
    nomeCompleto: '',
    email: '',
    telefone: '',
    cpf: '',
    crm: '',
    profissao: 'Médico',
    especialidade: '',
    password: '',
    confirmPassword: '',
    aceitouTermos: false,
  });

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await conteudoPublicService.getCadastroCorpo(token);
        const d = res.data.data;
        setEventoTitulo(d.evento.titulo);
        setCamposFaltantes(d.camposFaltantes || []);
        setForm((f) => ({
          ...f,
          nomeCompleto: d.nome || '',
          email: d.email || '',
          telefone: d.telefone || '',
          cpf: d.cpf ? maskCpf(d.cpf) : '',
          crm: d.crm || '',
          especialidade: d.especialidade || '',
          profissao: d.perfil === 'ESTUDANTE' ? '' : 'Médico',
        }));
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        setError(err.response?.data?.error || 'Link inválido ou expirado');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (!form.aceitouTermos) {
      setError('Aceite os termos de cadastro');
      return;
    }
    try {
      const res = await conteudoPublicService.submitCadastroCorpo(token, {
        nomeCompleto: form.nomeCompleto,
        email: form.email,
        telefone: form.telefone,
        cpf: form.cpf,
        password: form.password,
        confirmPassword: form.confirmPassword,
        profissao: form.profissao,
        crm: form.crm || undefined,
        especialidades: form.especialidade ? [form.especialidade] : undefined,
        aceitouTermos: true,
      });
      setSuccess(
        res.data.message ||
          res.data.data?.message ||
          'Cadastro concluído. Você já pode entrar no app.'
      );
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error || 'Não foi possível concluir o cadastro');
    }
  };

  const exigeCrm = profissaoExigeRegistroConselho(form.profissao);

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4">
      <div className="max-w-lg w-full space-y-6 bg-white p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <BrandLogo className="h-20 w-auto mb-4" linkToSite />
          <h1 className="text-xl font-semibold text-viva-900 text-center">
            Completar cadastro — corpo clínico
          </h1>
          {eventoTitulo && (
            <p className="text-sm text-viva-600 mt-1 text-center">
              Via pré-cadastro: {eventoTitulo}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-center text-viva-600">Carregando…</p>
        ) : success ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm">
              {success}
            </div>
            <p className="text-sm text-viva-700 text-center">
              Acesso liberado na hora — sem passar pela área de Avaliação.
            </p>
            <Link
              to="/login"
              className="block w-full text-center rounded-lg bg-viva-800 text-white py-2.5 text-sm font-medium"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            {camposFaltantes.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                <p className="font-semibold mb-1">Pendências / o que completar:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {camposFaltantes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <label className="block text-sm space-y-1">
              <span className="text-viva-700">Nome completo</span>
              <input
                required
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.nomeCompleto}
                onChange={(e) => setForm((f) => ({ ...f, nomeCompleto: e.target.value }))}
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">E-mail</span>
              <input
                required
                type="email"
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">Telefone</span>
              <input
                required
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">CPF</span>
              <input
                required
                inputMode="numeric"
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.cpf}
                onChange={(e) => setForm((f) => ({ ...f, cpf: maskCpf(e.target.value) }))}
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">Profissão</span>
              <select
                required
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.profissao}
                onChange={(e) => setForm((f) => ({ ...f, profissao: e.target.value }))}
              >
                <option value="">Selecione</option>
                {PROFISSOES_SAUDE.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {exigeCrm && (
              <label className="block text-sm space-y-1">
                <span className="text-viva-700">{labelRegistroConselho(form.profissao)}</span>
                <input
                  required
                  className="w-full rounded-lg border border-viva-200 px-3 py-2"
                  value={form.crm}
                  onChange={(e) => setForm((f) => ({ ...f, crm: e.target.value }))}
                />
              </label>
            )}
            {form.profissao === 'Médico' && (
              <label className="block text-sm space-y-1">
                <span className="text-viva-700">Especialidade (opcional)</span>
                <input
                  className="w-full rounded-lg border border-viva-200 px-3 py-2"
                  value={form.especialidade}
                  onChange={(e) => setForm((f) => ({ ...f, especialidade: e.target.value }))}
                />
              </label>
            )}
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">Senha</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">Confirmar senha</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-viva-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.aceitouTermos}
                onChange={(e) => setForm((f) => ({ ...f, aceitouTermos: e.target.checked }))}
              />
              <span>
                Li e aceito a {TERMOS_CADASTRO_TITULO} (versão {TERMOS_CADASTRO_VERSAO}). Ao concluir, meu
                acesso ao corpo clínico será liberado imediatamente.
              </span>
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-viva-800 text-white py-2.5 text-sm font-medium"
            >
              Concluir cadastro e liberar acesso
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ConteudoCadastroCorpoPublicPage;
