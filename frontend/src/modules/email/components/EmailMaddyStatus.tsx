import { useState } from 'react';
import { emailModuleService } from '../api/email.service';
import type { SmtpProviderInfo, SmtpTesteResultado } from '../types';

type Props = {
  smtp?: SmtpProviderInfo;
  loading?: boolean;
};

const providerLabel: Record<SmtpProviderInfo['provedor'], string> = {
  maddy: 'Maddy (servidor próprio)',
  smtp: 'SMTP externo',
  resend: 'Resend (API)',
  nenhum: 'Não configurado',
};

const EmailMaddyStatus = ({ smtp, loading }: Props) => {
  const [testing, setTesting] = useState(false);
  const [teste, setTeste] = useState<SmtpTesteResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleTestar = async () => {
    setTesting(true);
    setErro(null);
    try {
      const resp = await emailModuleService.testarSmtp();
      setTeste(resp.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha ao testar conexão';
      setErro(msg);
      setTeste(null);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="card text-sm text-gray-600">Carregando servidor de e-mail...</div>;
  }

  const info = smtp;
  const conexao = teste?.conexao;

  return (
    <div className="card border-l-4 border-sky-500 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-viva-900">Servidor Maddy</h2>
          <p className="text-sm text-gray-600 mt-1">
            Todos os e-mails do AppVS (painel, esqueci-senha, cadastros) passam por este SMTP.
          </p>
        </div>
        {info?.provedor === 'maddy' && (
          <button
            type="button"
            className="btn btn-secondary text-sm py-1.5 px-3"
            onClick={() => void handleTestar()}
            disabled={testing}
          >
            {testing ? 'Testando...' : 'Testar conexão'}
          </button>
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-gray-500">Provedor</dt>
          <dd className="font-medium text-viva-900">
            {info ? providerLabel[info.provedor] : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Remetente padrão</dt>
          <dd className="font-medium text-viva-900">{info?.remetente || '—'}</dd>
        </div>
        {info?.host && (
          <div>
            <dt className="text-gray-500">Host / porta</dt>
            <dd className="font-medium text-viva-900">
              {info.host}:{info.porta ?? 587}
            </dd>
          </div>
        )}
        {info?.tlsServername && (
          <div>
            <dt className="text-gray-500">TLS (SNI)</dt>
            <dd className="font-medium text-viva-900">{info.tlsServername}</dd>
          </div>
        )}
      </dl>

      {conexao && (
        <p
          className={`text-sm rounded-lg px-3 py-2 ${
            conexao.ok
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {conexao.ok ? '✓' : '✗'} {conexao.mensagem}
          {conexao.latenciaMs != null && conexao.ok && ` (${conexao.latenciaMs} ms)`}
        </p>
      )}

      {erro && (
        <p className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-800 border border-red-200">
          {erro}
        </p>
      )}

      {!info?.configurado && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Configure SMTP_HOST, SMTP_USER e SMTP_PASS no servidor (Maddy na rede Docker).
        </p>
      )}
    </div>
  );
};

export default EmailMaddyStatus;
