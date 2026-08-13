import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { conteudoMedicoService } from '../api/conteudo.service';
import {
  AvaliacaoPerguntasForm,
  type AvaliacaoFormulario,
  type AvaliacaoRespostasMap,
} from '../components/AvaliacaoPerguntasForm';

const ConteudoMedicoDetalhePage = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<AvaliacaoRespostasMap>({});

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

  const presencaMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('id');
      const form =
        detailQuery.data?.avaliacaoAtiva && detailQuery.data.avaliacao
          ? (detailQuery.data.avaliacao as AvaliacaoFormulario)
          : null;
      if (form) {
        for (const p of form.perguntas) {
          if (p.obrigatoria === false) continue;
          if (!(respostas[p.id] || '').trim()) {
            throw new Error(`Responda: ${p.texto}`);
          }
        }
      }
      return conteudoMedicoService.confirmarPresenca(id, form ? respostas : undefined);
    },
    onSuccess: async (res) => {
      setMsg(
        res.data.data.jaRegistrado
          ? 'Presença já estava registrada'
          : 'Presença confirmada'
      );
      setErr(null);
      await queryClient.invalidateQueries({ queryKey: ['medico', 'conteudos'] });
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message.startsWith('Responda:')) {
        setErr(e.message);
        return;
      }
      const error = e as { response?: { data?: { error?: string } } };
      setErr(error.response?.data?.error || 'Não foi possível confirmar presença');
    },
  });

  const ev = detailQuery.data;
  const formAvaliacao =
    ev?.avaliacaoAtiva && ev.avaliacao ? (ev.avaliacao as AvaliacaoFormulario) : null;
  const mostrarAvaliacao =
    !!ev?.jaInscrito &&
    !!ev?.frequenciaAberta &&
    !!formAvaliacao &&
    !ev.avaliadoEm;

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
          Aula ao vivo ainda sem link — você já pode se inscrever; o vídeo entra perto do horário.
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

      {mostrarAvaliacao && formAvaliacao && (
        <div className="rounded-2xl border border-viva-200 bg-white p-4 sm:p-5 space-y-4">
          <AvaliacaoPerguntasForm
            form={formAvaliacao}
            value={respostas}
            onChange={setRespostas}
            disabled={presencaMutation.isPending}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
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

        {ev.jaInscrito &&
          ev.frequenciaAberta &&
          (!ev.presenteEm || (formAvaliacao && !ev.avaliadoEm)) && (
            <button
              type="button"
              disabled={presencaMutation.isPending}
              onClick={() => presencaMutation.mutate()}
              className="rounded-lg bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {presencaMutation.isPending
                ? 'Confirmando…'
                : formAvaliacao && !ev.presenteEm
                  ? 'Confirmar presença e avaliação'
                  : formAvaliacao && !ev.avaliadoEm
                    ? 'Enviar avaliação'
                    : 'Confirmar presença'}
            </button>
          )}
      </div>

      {ev.jaInscrito && ev.presenteEm && (
        <p className="text-sm text-emerald-800 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
          Presença registrada às {new Date(ev.presenteEm).toLocaleString('pt-BR')}
          {ev.avaliadoEm ? ' · Avaliação enviada' : ''}
        </p>
      )}

      {ev.jaInscrito && !ev.frequenciaAberta && !ev.presenteEm && (
        <p className="text-xs text-viva-600">
          A frequência será liberada pela equipe durante a aula.
        </p>
      )}
    </div>
  );
};

export default ConteudoMedicoDetalhePage;
