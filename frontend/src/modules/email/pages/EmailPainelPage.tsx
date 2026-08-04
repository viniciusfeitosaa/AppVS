import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/auth.service';
import { emailModuleService } from '../api/email.service';
import EmailStatsCards from '../components/EmailStatsCards';
import EmailMaddyStatus from '../components/EmailMaddyStatus';
import EmailComposeForm from '../components/EmailComposeForm';
import EmailHistoryTable from '../components/EmailHistoryTable';
import type {
  CreateEmailMensagemPayload,
  EmailPainelTab,
  EnviarAgoraEmailPayload,
} from '../types';

const tabs: { id: EmailPainelTab; label: string }[] = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'novo', label: 'Novo e-mail' },
  { id: 'historico', label: 'Histórico' },
];

const EmailPainelPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<EmailPainelTab>('visao-geral');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: modulosResp } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });

  const hasAccess = modulosResp?.data?.map?.ENVIO_EMAIL !== false;

  const { data: resumoResp, isLoading: loadingResumo } = useQuery({
    queryKey: ['email', 'resumo'],
    queryFn: () => emailModuleService.getResumo(),
    enabled: !!user && hasAccess,
  });

  const { data: mensagensResp, isLoading: loadingMensagens } = useQuery({
    queryKey: ['email', 'mensagens'],
    queryFn: () => emailModuleService.listMensagens(),
    enabled: !!user && hasAccess,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['email'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateEmailMensagemPayload) => emailModuleService.createMensagem(payload),
    onSuccess: invalidate,
  });

  const enviarMutation = useMutation({
    mutationFn: (id: string) => emailModuleService.enviarMensagem(id),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailModuleService.deleteMensagem(id),
    onSuccess: invalidate,
  });

  if (modulosResp && !hasAccess) {
    return <Navigate to="/acesso-negado" replace />;
  }

  const resumo = resumoResp?.data;
  const mensagens = mensagensResp?.data ?? [];

  const handleEnviarRascunho = async (id: string) => {
    setBusyId(id);
    try {
      await enviarMutation.mutateAsync(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Excluir este rascunho?')) return;
    setBusyId(id);
    try {
      await deleteMutation.mutateAsync(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleSendNow = async (payload: EnviarAgoraEmailPayload) => {
    // enviar-agora aceita anexos (PDF de demonstrativo); create + enviar não.
    await emailModuleService.enviarAgora(payload);
    invalidate();
    setTab('historico');
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-viva-600">Comunicação</p>
        <h1 className="text-2xl md:text-3xl font-bold text-viva-900 font-display">Painel de E-mail</h1>
        <p className="text-gray-600 text-sm md:text-base">
          Interface central para rascunhos, envios e histórico de comunicações da Viva Saúde.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-viva-100 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-viva-600 text-white'
                : 'text-viva-800 hover:bg-viva-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'visao-geral' && (
        <div className="space-y-4">
          <EmailMaddyStatus smtp={resumo?.smtp} loading={loadingResumo} />
          <EmailStatsCards resumo={resumo} loading={loadingResumo} />
          <div className="card border-l-4 border-viva-500">
            <h2 className="font-semibold text-viva-900 mb-2">Como usar este módulo</h2>
            <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
              <li><strong>Novo e-mail</strong> — compose, salve rascunho ou envie na hora.</li>
              <li><strong>Histórico</strong> — acompanhe status (rascunho, enviado, falha).</li>
              <li>Envio via <strong>Maddy</strong> — mesmo servidor usado em esqueci-senha e e-mails de cadastro.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'novo' && (
        <EmailComposeForm
          smtpConfigurado={resumo?.smtpConfigurado}
          onSubmit={async (payload) => {
            await createMutation.mutateAsync(payload);
            setTab('historico');
          }}
          onSendNow={handleSendNow}
          onSubmitMany={async (payloads) => {
            for (const payload of payloads) {
              await createMutation.mutateAsync(payload);
            }
            setTab('historico');
          }}
          onSendMany={async (payloads: EnviarAgoraEmailPayload[]) => {
            for (const payload of payloads) {
              await emailModuleService.enviarAgora(payload);
            }
            invalidate();
            setTab('historico');
          }}
          disabled={createMutation.isPending || enviarMutation.isPending}
        />
      )}

      {tab === 'historico' && (
        <EmailHistoryTable
          mensagens={mensagens}
          loading={loadingMensagens}
          onEnviar={handleEnviarRascunho}
          onExcluir={handleExcluir}
          busyId={busyId}
        />
      )}
    </div>
  );
};

export default EmailPainelPage;
