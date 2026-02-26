import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { PROFISSOES_SAUDE, ESPECIALIDADES_MEDICAS } from '../constants/profissoesEspecialidades';

const cadastroSchema = z
  .object({
    nomeCompleto: z.string().min(3, 'Informe seu nome completo'),
    email: z.string().email('E-mail inválido'),
    cpf: z.string().min(11, 'CPF inválido'),
    telefone: z.string().min(8, 'Telefone é obrigatório'),
    profissao: z.string().min(2, 'Selecione a profissão'),
    crm: z.string().optional(),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirme a senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      if (data.profissao !== 'Médico') return true;
      return (data.crm || '').trim().length >= 6;
    },
    { message: 'CRM inválido (mín. 6 caracteres)', path: ['crm'] }
  );

type CadastroFormData = z.infer<typeof cadastroSchema>;

const Cadastro = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [especialidadesSelecionadas, setEspecialidadesSelecionadas] = useState<string[]>([]);
  const [buscaEspecialidade, setBuscaEspecialidade] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CadastroFormData>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: { profissao: '' },
  });

  const profissao = watch('profissao');
  const isMedico = profissao === 'Médico';

  const especialidadesFiltradas = ESPECIALIDADES_MEDICAS.filter((e) =>
    e.toLowerCase().includes(buscaEspecialidade.toLowerCase())
  );

  const toggleEspecialidade = (nome: string) => {
    setEspecialidadesSelecionadas((prev) =>
      prev.includes(nome) ? prev.filter((x) => x !== nome) : [...prev, nome]
    );
  };

  const onSubmit = async (data: CadastroFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Parameters<typeof authService.register>[0] = {
        nomeCompleto: data.nomeCompleto.trim(),
        email: data.email.trim().toLowerCase(),
        cpf: data.cpf,
        profissao: data.profissao.trim(),
        telefone: data.telefone.trim(),
        password: data.password,
        confirmPassword: data.confirmPassword,
      };
      if (isMedico) {
        payload.crm = (data.crm || '').trim();
        payload.especialidades =
          especialidadesSelecionadas.length > 0 ? [...especialidadesSelecionadas] : undefined;
      }

      const response = await authService.register(payload);

      setSuccess(response?.data?.message || 'Cadastro enviado com sucesso!');
      window.setTimeout(() => navigate('/login'), 1400);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível concluir o cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <img src="/assets/logo.avif" alt="Logo Viva Saúde" className="h-20 w-auto mb-4" />
          <h1 className="text-2xl font-bold text-viva-900">Cadastro de Associado</h1>
          <p className="text-sm text-gray-600 mt-1 text-center">
            Preencha seus dados para criar seu acesso na plataforma.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">{success}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="nomeCompleto" className="block text-sm font-semibold text-viva-800 mb-1">
                Nome completo
              </label>
              <input id="nomeCompleto" {...register('nomeCompleto')} className="input" required />
              {errors.nomeCompleto && <p className="mt-1 text-sm text-red-600">{errors.nomeCompleto.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-viva-800 mb-1">
                E-mail
              </label>
              <input id="email" type="email" {...register('email')} className="input" required />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="telefone" className="block text-sm font-semibold text-viva-800 mb-1">
                Telefone
              </label>
              <input id="telefone" {...register('telefone')} className="input" required />
              {errors.telefone && <p className="mt-1 text-sm text-red-600">{errors.telefone.message}</p>}
            </div>

            <div>
              <label htmlFor="cpf" className="block text-sm font-semibold text-viva-800 mb-1">
                CPF
              </label>
              <input id="cpf" {...register('cpf')} className="input" placeholder="000.000.000-00" required />
              {errors.cpf && <p className="mt-1 text-sm text-red-600">{errors.cpf.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="profissao" className="block text-sm font-semibold text-viva-800 mb-1">
                Profissão
              </label>
              <select id="profissao" {...register('profissao')} className="input" required>
                <option value="">Selecione sua profissão</option>
                {PROFISSOES_SAUDE.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {errors.profissao && <p className="mt-1 text-sm text-red-600">{errors.profissao.message}</p>}
            </div>

            {isMedico && (
              <>
                <div>
                  <label htmlFor="crm" className="block text-sm font-semibold text-viva-800 mb-1">
                    CRM
                  </label>
                  <input
                    id="crm"
                    {...register('crm')}
                    className="input"
                    placeholder="12345-CE"
                  />
                  {errors.crm && <p className="mt-1 text-sm text-red-600">{errors.crm.message}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-viva-800 mb-1">
                    Especialidades (pode marcar várias; se não marcar, será registrado como Clínica Médica)
                  </label>
                  <input
                    type="text"
                    placeholder="Buscar especialidade..."
                    className="input mb-2"
                    value={buscaEspecialidade}
                    onChange={(e) => setBuscaEspecialidade(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {especialidadesFiltradas.map((esp) => (
                      <label key={esp} className="flex items-center gap-2 cursor-pointer hover:bg-viva-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={especialidadesSelecionadas.includes(esp)}
                          onChange={() => toggleEspecialidade(esp)}
                          className="rounded border-viva-600 text-viva-600"
                        />
                        <span className="text-sm text-viva-900">{esp}</span>
                      </label>
                    ))}
                  </div>
                  {especialidadesSelecionadas.length > 0 && (
                    <p className="mt-1 text-xs text-gray-600">
                      Selecionadas: {especialidadesSelecionadas.join(', ')}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label htmlFor="password" className="block text-sm font-semibold text-viva-800 mb-1">
                Senha
              </label>
              <input id="password" type="password" {...register('password')} className="input" required />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-viva-800 mb-1">
                Confirmar senha
              </label>
              <input id="confirmPassword" type="password" {...register('confirmPassword')} className="input" required />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-3 text-base rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Cadastrando...' : 'Criar cadastro'}
          </button>
        </form>

        <p className="text-sm text-center text-gray-600">
          Já possui conta?{' '}
          <Link to="/login" className="font-semibold text-viva-800 hover:text-viva-600">
            Acessar login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Cadastro;
