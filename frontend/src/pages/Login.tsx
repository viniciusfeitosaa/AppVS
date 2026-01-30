import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { formatCPF, formatCRM } from '../utils/validation.util';

const loginSchema = z.object({
  cpf: z
    .string()
    .min(11, 'CPF deve ter 11 dígitos')
    .max(14, 'CPF inválido'),
  crm: z
    .string()
    .min(6, 'CRM inválido')
    .max(20, 'CRM inválido'),
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
      // Remove formatação do CPF para enviar apenas números
      const cpfClean = data.cpf.replace(/\D/g, '');
      
      await login({
        cpf: cpfClean,
        crm: data.crm.toUpperCase().trim(),
      });

      navigate('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.error || 'Erro ao fazer login. Verifique suas credenciais.'
      );
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
              <label htmlFor="cpf" className="block text-sm font-semibold text-viva-800 mb-1">
                CPF
              </label>
              <input
                id="cpf"
                type="text"
                {...register('cpf')}
                className="input"
                placeholder="000.000.000-00"
                maxLength={14}
              />
              {errors.cpf && (
                <p className="mt-1 text-sm text-red-600">{errors.cpf.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="crm" className="block text-sm font-semibold text-viva-800 mb-1">
                CRM
              </label>
              <input
                id="crm"
                type="text"
                {...register('crm')}
                className="input"
                placeholder="12345-CE"
                style={{ textTransform: 'uppercase' }}
              />
              {errors.crm && (
                <p className="mt-1 text-sm text-red-600">{errors.crm.message}</p>
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
      </div>
    </div>
  );
};

export default Login;
