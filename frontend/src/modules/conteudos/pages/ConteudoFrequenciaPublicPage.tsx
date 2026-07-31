import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BrandLogo } from '../../../components/brand/BrandLogo';
import { conteudoPublicService } from '../api/conteudo.service';

const ConteudoFrequenciaPublicPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [evento, setEvento] = useState<{
    titulo: string;
    iniciaEm: string;
    frequenciaAberta: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await conteudoPublicService.getFrequencia(token);
        setEvento(res.data.data.evento);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        setError(err.response?.data?.error || 'Link de frequência inválido');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await conteudoPublicService.submitFrequencia(token, email);
      setSuccess(true);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error || 'Não foi possível confirmar a presença');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4">
      <div className="max-w-lg w-full space-y-6 bg-white p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <BrandLogo className="h-20 w-auto mb-4" linkToSite />
          <h1 className="text-xl font-semibold text-viva-900">Frequência</h1>
          {evento && <p className="text-sm text-viva-600 mt-1 text-center">{evento.titulo}</p>}
        </div>

        {evento && (
          <p className="text-xs text-center text-viva-600">
            {new Date(evento.iniciaEm).toLocaleString('pt-BR')}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-center text-viva-600">Carregando…</p>
        ) : success ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm space-y-1">
            <p className="font-medium">
              Se o e-mail estiver na lista de inscritos, a presença foi registrada.
            </p>
            <p className="text-xs text-emerald-700/80">
              A equipe confere a lista de presença no painel. Em caso de dúvida, fale com quem está
              conduzindo a aula.
            </p>
          </div>
        ) : !evento ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error || 'Link inválido'}
          </div>
        ) : !evento.frequenciaAberta ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded text-sm">
            A frequência ainda não está aberta. Aguarde a equipe liberar durante a aula.
          </div>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <p className="text-sm text-viva-700">
              Informe o mesmo e-mail usado na inscrição. Por privacidade, a confirmação não revela se o
              e-mail está ou não na lista.
            </p>
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">E-mail da inscrição *</span>
              <input
                required
                type="email"
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-viva-800 text-white py-2.5 text-sm font-medium hover:bg-viva-900 disabled:opacity-60"
            >
              {submitting ? 'Confirmando…' : 'Confirmar presença'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ConteudoFrequenciaPublicPage;
