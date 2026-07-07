import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PAGAMENTO_LABEL, STATUS_INTERESSE_LABEL } from '../../constants/vagas';
import { notify } from '../../lib/notificationEmitter';
import { medicoService, type VagaPublicadaItem } from '../../services/medico.service';

type Props = {
  v: VagaPublicadaItem;
  formatCentavosBRL: (c: number | null) => string;
  formatDataHora: (iso: string) => string;
  onGerenciarCandidatos: () => void;
};

const VagaCardDisponivel = ({ v, formatCentavosBRL, formatDataHora, onGerenciarCandidatos }: Props) => {
  const queryClient = useQueryClient();
  const sou = v.souPublicador === true;
  const total = v.totalInteresses ?? 0;
  const interesse = v.meuInteresse;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['medico', 'vagas'] });
    queryClient.invalidateQueries({ queryKey: ['medico', 'vagas-publicadas'] });
  };

  const postMut = useMutation({
    mutationFn: () => medicoService.postInteresseVaga(v.id),
    onSuccess: () => {
      invalidate();
      notify({ kind: 'success', message: 'Interesse registrado.' });
    },
    onError: (err: unknown) => {
      let msg = 'Não foi possível registrar o interesse.';
      if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const d = err.response.data as { error?: string };
        if (typeof d.error === 'string') msg = d.error;
      }
      notify({ kind: 'error', message: msg });
    },
  });

  const delIntMut = useMutation({
    mutationFn: () => medicoService.deleteInteresseVaga(v.id),
    onSuccess: () => {
      invalidate();
      notify({ kind: 'success', message: 'Interesse removido.' });
    },
    onError: (err: unknown) => {
      let msg = 'Não foi possível remover.';
      if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const d = err.response.data as { error?: string };
        if (typeof d.error === 'string') msg = d.error;
      }
      notify({ kind: 'error', message: msg });
    },
  });

  const delVagaMut = useMutation({
    mutationFn: () => medicoService.deleteVaga(v.id),
    onSuccess: () => {
      invalidate();
      notify({ kind: 'success', message: 'Vaga excluída.' });
    },
    onError: (err: unknown) => {
      let msg = 'Não foi possível excluir.';
      if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
        const d = err.response.data as { error?: string };
        if (typeof d.error === 'string') msg = d.error;
      }
      notify({ kind: 'error', message: msg });
    },
  });

  const excluir = () => {
    if (!window.confirm('Excluir esta vaga? Esta ação não pode ser desfeita.')) return;
    delVagaMut.mutate();
  };

  return (
    <li className="rounded-2xl border border-viva-100 bg-gradient-to-br from-white to-viva-50/30 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-viva-950 font-display">{v.tipoAtendimento}</p>
          <p className="text-sm text-viva-700 font-serif">
            {v.setor} · {v.quantidadeVagas} vaga(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {sou && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
              Sua publicação
            </span>
          )}
          <span className="rounded-full bg-viva-100 px-3 py-1 text-xs font-semibold text-viva-800">
            Até {formatDataHora(v.expiresAt)}
          </span>
        </div>
      </div>
      <dl className="mt-3 grid gap-1 text-sm text-viva-800 font-serif">
        <div>
          <span className="text-viva-600">Valor: </span>
          {v.valorACombinar ? (
            'A combinar'
          ) : (
            <>
              {formatCentavosBRL(v.valorCentavos)} ({v.valorLiquidoBruto === 'LIQUIDO' ? 'Líquido' : 'Bruto'})
            </>
          )}
        </div>
        <div>
          <span className="text-viva-600">Pagamento: </span>
          {PAGAMENTO_LABEL[v.pagamento] ?? v.pagamento}
        </div>
        <div>
          <span className="text-viva-600">Dias: </span>
          {v.diasVaga.join(', ')}
        </div>
        <div>
          <span className="text-viva-600">Publicado por: </span>
          {v.publicador.nomeCompleto}
          {v.publicador.crm ? ` · CRM ${v.publicador.crm}` : ''}
        </div>
      </dl>
      <p className="mt-3 text-sm text-viva-900 font-serif whitespace-pre-wrap border-t border-viva-100 pt-3">{v.descricao}</p>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-viva-100 pt-3">
        {sou ? (
          <>
            <button
              type="button"
              onClick={onGerenciarCandidatos}
              className="rounded-xl bg-viva-900 px-4 py-2 text-xs font-semibold text-white hover:bg-viva-800"
            >
              Candidatos ({total})
            </button>
            <button
              type="button"
              onClick={excluir}
              disabled={delVagaMut.isPending}
              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              Excluir vaga
            </button>
          </>
        ) : (
          <>
            {!interesse && (
              <button
                type="button"
                onClick={() => postMut.mutate()}
                disabled={postMut.isPending}
                className="rounded-xl bg-viva-900 px-4 py-2 text-xs font-semibold text-white hover:bg-viva-800 disabled:opacity-50"
              >
                {postMut.isPending ? 'Enviando…' : 'Demonstrar interesse'}
              </button>
            )}
            {interesse && (
              <span className="rounded-full bg-viva-100 px-3 py-1.5 text-xs font-semibold text-viva-900">
                Seu interesse: {STATUS_INTERESSE_LABEL[interesse.status] ?? interesse.status}
              </span>
            )}
            {interesse?.status === 'PENDENTE' && (
              <button
                type="button"
                onClick={() => delIntMut.mutate()}
                disabled={delIntMut.isPending}
                className="rounded-xl border border-viva-200 px-4 py-2 text-xs font-semibold text-viva-800 hover:bg-viva-50"
              >
                Retirar interesse
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
};

export default VagaCardDisponivel;
