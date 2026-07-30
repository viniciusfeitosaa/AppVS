import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { conteudoMedicoService } from '../api/conteudo.service';

const ConteudoMedicoDetalhePage = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (user?.role === 'MASTER') {
    return <Navigate to="/conteudos" replace />;
  }

  const detailQuery = useQuery({
    queryKey: ['medico', 'conteudos', id],
    queryFn: async () => {
      if (!id) return null;
      return (await conteudoMedicoService.get(id)).data.data;
    },
    enabled: !!id,
  });

  const inscMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('id');
      return conteudoMedicoService.inscrever(id);
    },
    onSuccess: async () => {
      setMsg('Inscrição confirmada');
      setErr(null);
      await queryClient.invalidateQueries({ queryKey: ['medico', 'conteudos'] });
    },
    onError: (e: unknown) => {
      const error = e as { response?: { data?: { error?: string } } };
      setErr(error.response?.data?.error || 'Não foi possível inscrever');
    },
  });

  const ev = detailQuery.data;

  if (detailQuery.isLoading) {
    return <div className="p-6 text-sm text-viva-600">Carregando…</div>;
  }

  if (!ev) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-viva-800">Conteúdo não encontrado.</p>
        <Link to="/conteudos" className="text-sm text-viva-700 underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <Link to="/conteudos" className="text-sm text-viva-700 underline">
        ← Voltar aos conteúdos
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-display font-semibold text-viva-950">{ev.titulo}</h1>
        <p className="text-sm text-viva-700">
          {new Date(ev.iniciaEm).toLocaleString('pt-BR')}
          {ev.palestrante ? ` · ${ev.palestrante.nome}` : ''}
        </p>
      </header>

      {ev.descricao && <p className="text-sm text-viva-800 whitespace-pre-wrap">{ev.descricao}</p>}

      {ev.palestrante?.bio && (
        <div className="rounded-xl bg-viva-50 border border-viva-100 p-4 text-sm text-viva-800">
          <p className="font-medium mb-1">Sobre o palestrante</p>
          <p className="whitespace-pre-wrap">{ev.palestrante.bio}</p>
        </div>
      )}

      {ev.youtubeEmbedUrl ? (
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-viva-200 bg-black">
          <iframe
            title={ev.titulo}
            src={ev.youtubeEmbedUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <p className="text-sm text-viva-600 rounded-xl border border-dashed border-viva-200 p-4">
          Vídeo ainda não disponível para este conteúdo.
        </p>
      )}

      {(msg || err) && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            err ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {err || msg}
        </div>
      )}

      {ev.status === 'PUBLICADO' && (
        <button
          type="button"
          disabled={ev.jaInscrito || inscMutation.isPending}
          onClick={() => inscMutation.mutate()}
          className="rounded-lg bg-viva-800 text-white px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {ev.jaInscrito ? 'Você já está inscrito' : inscMutation.isPending ? 'Inscrevendo…' : 'Participar'}
        </button>
      )}
    </div>
  );
};

export default ConteudoMedicoDetalhePage;
