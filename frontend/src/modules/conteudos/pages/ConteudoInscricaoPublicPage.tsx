import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BrandLogo } from '../../../components/brand/BrandLogo';
import { conteudoPublicService, type ConteudoEvento } from '../api/conteudo.service';
import { maskCpf } from '../../../features/cadastro-coop/utils/masks';
import { formatPalestranteNome } from '../utils/titulo-medico';

type PerfilInscricao = 'MEDICO' | 'ESTUDANTE';

function formatEventoQuando(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const data = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataFmt = data.charAt(0).toUpperCase() + data.slice(1);
  return `${dataFmt} às ${hora}`;
}

const ConteudoInscricaoPublicPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [evento, setEvento] = useState<ConteudoEvento | null>(null);
  const [form, setForm] = useState({
    perfil: '' as '' | PerfilInscricao,
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    crm: '',
    especialidade: '',
    cidade: '',
    faculdade: '',
    semestre: '',
    participaLiga: false,
    ligaNome: '',
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
    if (!form.perfil) {
      setError('Selecione se você é médico(a) ou estudante.');
      return;
    }
    setError(null);
    try {
      await conteudoPublicService.submitInscricao(token, {
        perfil: form.perfil,
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        cpf: form.cpf,
        cidade: form.cidade || undefined,
        interesseCorpoClinico: form.interesseCorpoClinico,
        consentimentoLgpd: form.consentimentoLgpd,
        ...(form.perfil === 'MEDICO'
          ? {
              crm: form.crm || undefined,
              especialidade: form.especialidade || undefined,
            }
          : {
              faculdade: form.faculdade,
              semestre: form.semestre,
              participaLiga: form.participaLiga,
              ligaNome: form.participaLiga ? form.ligaNome : undefined,
            }),
      });
      setSuccess(true);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error || 'Não foi possível concluir o pré-cadastro');
    }
  };

  const capaSrc = token ? conteudoPublicService.capaUrl(token) : null;
  const isMedico = form.perfil === 'MEDICO';
  const isEstudante = form.perfil === 'ESTUDANTE';

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4">
      <div className="max-w-lg w-full space-y-6 bg-white p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <BrandLogo className="h-20 w-auto mb-4" linkToSite />
          <h1 className="text-xl font-semibold text-viva-900">Inscrição</h1>
          {evento && <p className="text-sm text-viva-600 mt-1 text-center">{evento.titulo}</p>}
        </div>

        {evento?.capaUrl && capaSrc && (
          <img src={capaSrc} alt="" className="w-full h-40 object-cover rounded-xl" />
        )}

        {evento && (
          <div className="text-center space-y-0.5">
            {evento.palestrante?.nome ? (
              <p className="text-sm font-medium text-viva-900">
                {formatPalestranteNome(evento.palestrante.nome)}
              </p>
            ) : null}
            <p className="text-xs text-viva-600">{formatEventoQuando(evento.iniciaEm)}</p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-center text-viva-600">Carregando…</p>
        ) : success ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm">
            Inscrição confirmada. Em breve nossa equipe poderá entrar em contato.
          </div>
        ) : !evento ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error || 'Link de inscrição inválido'}
          </div>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-viva-800">Você é *</legend>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    isMedico
                      ? 'border-viva-700 bg-viva-50 text-viva-950 ring-2 ring-viva-600/30'
                      : 'border-viva-200 text-viva-700 hover:bg-viva-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="perfil"
                    className="sr-only"
                    checked={isMedico}
                    onChange={() => setForm((f) => ({ ...f, perfil: 'MEDICO' }))}
                  />
                  Médico(a)
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    isEstudante
                      ? 'border-viva-700 bg-viva-50 text-viva-950 ring-2 ring-viva-600/30'
                      : 'border-viva-200 text-viva-700 hover:bg-viva-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="perfil"
                    className="sr-only"
                    checked={isEstudante}
                    onChange={() => setForm((f) => ({ ...f, perfil: 'ESTUDANTE' }))}
                  />
                  Estudante
                </label>
              </div>
            </fieldset>

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
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">CPF *</span>
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                className="w-full rounded-lg border border-viva-200 px-3 py-2"
                value={form.cpf}
                onChange={(e) => setForm((f) => ({ ...f, cpf: maskCpf(e.target.value) }))}
                placeholder="000.000.000-00"
              />
            </label>

            {isMedico && (
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
            )}

            {isEstudante && (
              <>
                <label className="block text-sm space-y-1">
                  <span className="text-viva-700">Faculdade *</span>
                  <input
                    required
                    className="w-full rounded-lg border border-viva-200 px-3 py-2"
                    value={form.faculdade}
                    onChange={(e) => setForm((f) => ({ ...f, faculdade: e.target.value }))}
                    placeholder="Nome da instituição"
                  />
                </label>
                <label className="block text-sm space-y-1">
                  <span className="text-viva-700">Semestre *</span>
                  <input
                    required
                    className="w-full rounded-lg border border-viva-200 px-3 py-2"
                    value={form.semestre}
                    onChange={(e) => setForm((f) => ({ ...f, semestre: e.target.value }))}
                    placeholder="Ex.: 6º"
                  />
                </label>
                <label className="flex items-start gap-2 text-sm text-viva-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.participaLiga}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        participaLiga: e.target.checked,
                        ligaNome: e.target.checked ? f.ligaNome : '',
                      }))
                    }
                  />
                  <span>Participo de alguma liga acadêmica</span>
                </label>
                {form.participaLiga && (
                  <label className="block text-sm space-y-1">
                    <span className="text-viva-700">Qual liga? *</span>
                    <input
                      required
                      className="w-full rounded-lg border border-viva-200 px-3 py-2"
                      value={form.ligaNome}
                      onChange={(e) => setForm((f) => ({ ...f, ligaNome: e.target.value }))}
                    />
                  </label>
                )}
              </>
            )}

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
              disabled={!form.perfil}
              className="w-full rounded-lg bg-viva-800 text-white py-2.5 text-sm font-medium disabled:opacity-50"
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
