import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await login({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      navigate('/dashboard');
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Erro ao fazer login. Verifique suas credenciais.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <img 
            src="/assets/logo.avif" 
            alt="Logo Viva Saúde" 
            className="h-24 w-auto mb-6"
          />
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-viva-800 mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className="input"
                placeholder="seuemail@dominio.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-viva-800 mb-1">
                Senha
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className="input"
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-4 text-lg rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform transition active:scale-95"
            >
              {isLoading ? 'Validando...' : 'Acessar'}
            </button>
          </div>
        </form>
        <p className="text-sm text-center text-gray-600">
          Ainda não possui cadastro?{' '}
          <Link to="/cadastro" className="font-semibold text-viva-800 hover:text-viva-600">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
