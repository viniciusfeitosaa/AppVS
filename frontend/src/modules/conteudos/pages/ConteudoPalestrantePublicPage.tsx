import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BrandLogo } from '../../../components/brand/BrandLogo';
import { conteudoPublicService } from '../api/conteudo.service';

const ConteudoPalestrantePublicPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [eventoTitulo, setEventoTitulo] = useState('');
  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    bio: '',
    crm: '',
    especialidade: '',
    fotoUrl: '',
  });

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await conteudoPublicService.getPalestrante(token);
        const { evento, palestrante } = res.data.data;
        setEventoTitulo(evento.titulo);
        if (palestrante) {
          setForm({
            nome: palestrante.nome || '',
            email: palestrante.email || '',
            telefone: palestrante.telefone || '',
            bio: palestrante.bio || '',
            crm: palestrante.crm || '',
            especialidade: palestrante.especialidade || '',
            fotoUrl: palestrante.fotoUrl || '',
          });
        }
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        setError(err.response?.data?.error || 'Convite inválido');
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
      await conteudoPublicService.submitPalestrante(token, {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone || undefined,
        bio: form.bio || undefined,
        crm: form.crm || undefined,
        especialidade: form.especialidade || undefined,
        fotoUrl: form.fotoUrl || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error || 'Não foi possível salvar');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-viva-950 py-12 px-4">
      <div className="max-w-lg w-full space-y-6 bg-white p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <BrandLogo className="h-20 w-auto mb-4" linkToSite />
          <h1 className="text-xl font-semibold text-viva-900">Cadastro do palestrante</h1>
          {eventoTitulo && <p className="text-sm text-viva-600 mt-1 text-center">{eventoTitulo}</p>}
        </div>

        {loading ? (
          <p className="text-sm text-center text-viva-600">Carregando…</p>
        ) : success ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm">
            Dados salvos. Obrigado!
          </div>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            {(
              [
                ['nome', 'Nome completo', true],
                ['email', 'E-mail', true],
                ['telefone', 'Telefone', false],
                ['crm', 'CRM / registro', false],
                ['especialidade', 'Especialidade', false],
                ['fotoUrl', 'URL da foto', false],
              ] as const
            ).map(([key, label, required]) => (
              <label key={key} className="block text-sm space-y-1">
                <span className="text-viva-700">{label}</span>
                <input
                  required={required}
                  type={key === 'email' ? 'email' : 'text'}
                  className="w-full rounded-lg border border-viva-200 px-3 py-2"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="block text-sm space-y-1">
              <span className="text-viva-700">Bio</span>
              <textarea
                className="w-full rounded-lg border border-viva-200 px-3 py-2 min-h-[90px]"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-viva-800 text-white py-2.5 text-sm font-medium"
            >
              Enviar dados
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ConteudoPalestrantePublicPage;
