import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BrandLogo } from '../../../components/brand/BrandLogo';
import { conteudoPublicService, type ConteudoEvento } from '../api/conteudo.service';

const ConteudoInscricaoPublicPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [evento, setEvento] = useState<ConteudoEvento | null>(null);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    crm: '',
    especialidade: '',
    cidade: '',
    interesseCorpoClinico: true,
    consentimentoLgpd: false,
  });

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await conteudoPublicService.getInscricao(token);
        setEvento(res.data.data.evento);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        setError(err.response?.data?.error || 'Link de inscrição inválido');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await conteudoPublicService.submitInscricao(token, {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        crm: form.crm || undefined,
        especialidade: form.especialidade || undefined,
        cidade: form.cidade || undefined,
        interesseCorpoClinico: form.interesseCorpoClinico,
        consentimentoLgpd: form.consentimentoLgpd,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error || 'Não foi possível concluir o precadastro');
    }
  };

  const capaSrc = token ? conteudoPublicService.capaUrl(token) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4">
      <div className="max-w-lg w-full space-y-6 bg-white p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <BrandLogo className="h-20 w-auto mb-4" linkToSite />
          <h1 className="text-xl font-semibold text-viva-900">Inscrição e precadastro</h1>
          {evento && <p className="text-sm text-viva-600 mt-1 text-center">{evento.titulo}</p>}
        </div>

        {evento?.capaUrl && capaSrc && (
          <img src={capaSrc} alt="" className="w-full h-40 object-cover rounded-xl" />
        )}

        {evento && (
          <p className="text-xs text-center text-viva-600">
            {new Date(evento.iniciaEm).toLocaleString('pt-BR')}
            {evento.palestrante ? ` · ${evento.palestrante.nome}` : ''}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-center text-viva-600">Carregando…</p>
        ) : success ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm">
            Precadastro e inscrição confirmados. Em breve nossa equipe poderá entrar em contato.
          </div>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">Nome completo *</span>
              <input
                required
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">E-mail *</span>
              <input
                required
                type="email"
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">Telefone / WhatsApp *</span>
              <input
                required
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm space-y-1">
                <span className="text-viva-700">CRM / registro</span>
                <input
                  className="w-full rounded-lg border border-viva-200 px-3 py-2"
                  value={form.crm}
                  onChange={(e) => setForm((f) => ({ ...f, crm: e.target.value }))}
                />
              </label>
              <label className="block text-sm space-y-1">
                <span className="text-viva-700">Especialidade</span>
                <input
                  className="w-full rounded-lg border border-viva-200 px-3 py-2"
                  value={form.especialidade}
                  onChange={(e) => setForm((f) => ({ ...f, especialidade: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">Cidade</span>
              <input
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.cidade}
                onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-viva-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.interesseCorpoClinico}
                onChange={(e) => setForm((f) => ({ ...f, interesseCorpoClinico: e.target.checked }))}
              />
              <span>Tenho interesse em integrar o corpo clínico da Viva Saúde no futuro.</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-viva-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.consentimentoLgpd}
                onChange={(e) => setForm((f) => ({ ...f, consentimentoLgpd: e.target.checked }))}
              />
              <span>
                Autorizo o tratamento dos meus dados para esta inscrição e contato da plataforma (LGPD).
              </span>
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-viva-800 text-white py-2.5 text-sm font-medium"
            >
              Confirmar inscrição
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ConteudoInscricaoPublicPage;
