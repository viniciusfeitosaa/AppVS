import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BrandLogo } from '../../../components/brand/BrandLogo';
import { conteudoPublicService } from '../api/conteudo.service';
import {
  AvaliacaoPerguntasForm,
  type AvaliacaoFormulario,
  type AvaliacaoRespostasMap,
} from '../components/AvaliacaoPerguntasForm';

const ConteudoFrequenciaPublicPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successDetail, setSuccessDetail] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [respostas, setRespostas] = useState<AvaliacaoRespostasMap>({});
  const [evento, setEvento] = useState<{
    titulo: string;
    iniciaEm: string;
    frequenciaAberta: boolean;
    avaliacaoAtiva?: boolean;
    avaliacao?: AvaliacaoFormulario | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await conteudoPublicService.getFrequencia(token);
        const e = res.data.data.evento;
        setEvento({
          titulo: e.titulo,
          iniciaEm: e.iniciaEm,
          frequenciaAberta: e.frequenciaAberta,
          avaliacaoAtiva: e.avaliacaoAtiva,
          avaliacao: e.avaliacao as AvaliacaoFormulario | null,
        });
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
      const form = evento?.avaliacaoAtiva && evento.avaliacao ? evento.avaliacao : null;
      if (form) {
        for (const p of form.perguntas) {
          if (p.obrigatoria === false) continue;
          const v = (respostas[p.id] || '').trim();
          if (!v) {
            setError(`Responda: ${p.texto}`);
            setSubmitting(false);
            return;
          }
        }
      }
      const res = await conteudoPublicService.submitFrequencia(
        token,
        email,
        form ? respostas : undefined
      );
      const data = res.data.data;
      // registrado === true só quando o e-mail está inscrito e a gravação ocorreu
      if (!data.registrado) {
        setError(
          'Não encontramos inscrição com este e-mail para este conteúdo. Use o mesmo e-mail da inscrição (verifique espaços e digitação).'
        );
        return;
      }
      setSuccess(true);
      if (form && data.avaliadoEm) {
        setSuccessDetail('Presença e avaliação registradas com sucesso.');
      } else if (form && !data.avaliadoEm) {
        setSuccessDetail(
          'Presença registrada, mas a avaliação não foi salva. Tente enviar de novo com todas as respostas obrigatórias.'
        );
      } else {
        setSuccessDetail('Presença registrada com sucesso.');
      }
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error || 'Não foi possível confirmar a presença');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4">
      <div className="max-w-xl w-full space-y-6 bg-white p-8 rounded-2xl shadow-2xl">
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
            <p className="font-medium">{successDetail || 'Registro concluído.'}</p>
            <p className="text-xs text-emerald-700/80">
              A equipe confere a lista e os resultados da avaliação no painel Master.
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
          <form className="space-y-5" onSubmit={onSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <p className="text-sm text-viva-700">
              Informe o <strong>mesmo e-mail da inscrição</strong>. Se o e-mail não estiver na lista,
              não registramos presença nem avaliação.
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

            {evento.avaliacaoAtiva && evento.avaliacao && (
              <div className="rounded-xl border border-viva-100 bg-viva-50/40 p-4">
                <AvaliacaoPerguntasForm
                  form={evento.avaliacao}
                  value={respostas}
                  onChange={setRespostas}
                  disabled={submitting}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-viva-800 text-white py-2.5 text-sm font-medium hover:bg-viva-900 disabled:opacity-60"
            >
              {submitting
                ? 'Enviando…'
                : evento.avaliacaoAtiva
                  ? 'Confirmar presença e avaliação'
                  : 'Confirmar presença'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ConteudoFrequenciaPublicPage;
