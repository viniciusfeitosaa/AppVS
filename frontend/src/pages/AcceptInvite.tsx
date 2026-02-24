import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../services/auth.service';

const acceptInviteSchema = z
  .object({
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirmação de senha é obrigatória'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>;

const AcceptInvite = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
  });

  const onSubmit = async (data: AcceptInviteFormData) => {
    if (!token) {
      setError('Token de convite inválido.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.acceptInvite({
        token,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Não foi possível ativar sua conta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <img src="/assets/logo.avif" alt="Logo Viva Saúde" className="h-24 w-auto mb-6" />
          <h1 className="text-xl font-semibold text-viva-900">Ativar conta</h1>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Conta ativada com sucesso! Redirecionando para o login...
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-viva-800 mb-1">
              Nova senha
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="input"
              placeholder="Digite sua nova senha"
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-semibold text-viva-800 mb-1"
            >
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              className="input"
              placeholder="Repita sua nova senha"
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className="btn btn-primary w-full py-4 text-lg rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Ativando...' : 'Ativar conta'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AcceptInvite;
