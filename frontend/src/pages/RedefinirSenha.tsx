import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../services/auth.service';

const schema = z
  .object({
    novaSenha: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
    confirmarSenha: z.string(),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  });

type FormData = z.infer<typeof schema>;

const RedefinirSenha = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!token) {
      setError('Link inválido. Solicite uma nova redefinição de senha.');
    }
  }, [token]);

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      await authService.redefinirSenha(token, data.novaSenha);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erro ao redefinir senha.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-2xl shadow-2xl text-center">
          <img src="/assets/logo.avif" alt="Logo" className="h-20 w-auto mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Link to="/esqueci-senha" className="font-semibold text-viva-800 hover:text-viva-600">
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <img
            src="/assets/logo.avif"
            alt="Logo Viva Saúde"
            className="h-24 w-auto mb-6"
          />
          <h1 className="text-xl font-bold text-viva-900">Nova senha</h1>
          <p className="text-sm text-gray-600 mt-1 text-center">
            Digite e confirme sua nova senha.
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
              Senha alterada com sucesso. Faça login com a nova senha.
            </div>
            <Link
              to="/login"
              className="btn btn-primary w-full py-4 text-center rounded-xl block"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="novaSenha" className="block text-sm font-semibold text-viva-800 mb-1">
                Nova senha
              </label>
              <input
                id="novaSenha"
                type="password"
                {...register('novaSenha')}
                className="input"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              {errors.novaSenha && (
                <p className="mt-1 text-sm text-red-600">{errors.novaSenha.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmarSenha" className="block text-sm font-semibold text-viva-800 mb-1">
                Confirmar senha
              </label>
              <input
                id="confirmarSenha"
                type="password"
                {...register('confirmarSenha')}
                className="input"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
              {errors.confirmarSenha && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmarSenha.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-4 text-lg rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-600">
          <Link to="/login" className="font-semibold text-viva-800 hover:text-viva-600">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RedefinirSenha;
