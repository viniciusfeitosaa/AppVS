import { useState } from 'react';
import { adminService } from '../services/admin.service';

const EnviarAvisoPush = () => {
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await adminService.broadcastPush({ titulo, corpo });
      setSuccess(res.message || `Enviado para ${res.data?.enviados ?? 0} profissional(is).`);
      setTitulo('');
      setCorpo('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Não foi possível enviar o aviso.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card dashboard-hero col-span-full stagger-1 py-8 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600 mb-2 font-display">
          Comunicação
        </p>
        <h1 className="text-xl md:text-2xl font-bold text-viva-900 font-display leading-tight mb-2">
          Enviar aviso push
        </h1>
        <p className="text-viva-700 font-serif text-base">
          Envia notificação in-app e push (celular) para todos os profissionais ativos.
        </p>
      </div>

      {error && (
        <div className="card border-l-4 border-red-400 bg-red-50/50 p-4">
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="card border-l-4 border-emerald-500 bg-emerald-50/50 p-4">
          <p className="text-xs text-emerald-800 font-medium">{success}</p>
        </div>
      )}

      <form className="card space-y-4 max-w-xl" onSubmit={handleSubmit}>
        <div>
          <label className="block text-xs font-semibold text-viva-800 mb-1">Título</label>
          <input
            className="w-full rounded-xl border border-viva-200 bg-white px-3 py-2 text-sm"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
            required
            placeholder="Ex.: Manutenção do sistema"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-viva-800 mb-1">Mensagem</label>
          <textarea
            className="w-full rounded-xl border border-viva-200 bg-white px-3 py-2 text-sm min-h-[120px]"
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            maxLength={4000}
            required
            placeholder="Texto do aviso que os associados verão no celular e no sino do app."
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar aviso'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EnviarAvisoPush;
