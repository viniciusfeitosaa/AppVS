/**
 * Reenvia e-mails que falharam por certificado TLS expirado (28/08/2026).
 * Uso: node scripts/reenviar-emails-falhos.mjs
 * (executar dentro do container backend com dist compilado)
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const TENANT_ID = 'b7c43aba-fb5f-4b85-9ded-ba72ba96ec2b';

const CADASTRO_APROVADO = [
  { to: 'isadoracarvmarques19@hotmail.com', nomeCompleto: 'Isadora Carvalho Marques', nomeInstituicao: 'Seja Viva Saúde' },
  { to: 'juliarachelfm@hotmail.com', nomeCompleto: 'Júlia Rachel Ferreira Meneses', nomeInstituicao: 'Seja Viva Saúde' },
  { to: 'sofiabragavp@gmail.com', nomeCompleto: 'Sofia Braga da Veiga Pessoa', nomeInstituicao: 'Seja Viva Saúde' },
  { to: 'esterprs043@gmail.com', nomeCompleto: 'ESTER ALMEIDA DE SOUSA', nomeInstituicao: 'Seja Viva Saúde' },
  { to: 'rubiamarinho@yahoo.com.br', nomeCompleto: 'RUBIA CARVALHO', nomeInstituicao: 'Seja Viva Saúde' },
  { to: 'waltermoura96@gmail.com', nomeCompleto: 'Walter Antônio Moura Fé Filho', nomeInstituicao: 'Seja Viva Saúde' },
];

async function main() {
  const { enviarEmailCadastroAprovado } = require('../dist/services/cadastro-publico-email.service');
  const { esqueciSenhaService } = require('../dist/services/auth.service');
  const { enviarEmailMensagemService } = require('../dist/modules/email/email.service');
  const { prisma } = require('../dist/config/database');

  const results = [];

  for (const p of CADASTRO_APROVADO) {
    try {
      await enviarEmailCadastroAprovado(p);
      results.push({ tipo: 'cadastro-aprovado', to: p.to, ok: true });
      console.log('[ok] cadastro-aprovado →', p.to);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ tipo: 'cadastro-aprovado', to: p.to, ok: false, erro: msg });
      console.error('[erro] cadastro-aprovado →', p.to, msg);
    }
  }

  try {
    const r = await esqueciSenhaService('isadoracarvmarques19@hotmail.com');
    results.push({ tipo: 'reset-password', to: 'isadoracarvmarques19@hotmail.com', ok: r.ok });
    console.log('[ok] reset-password (novo link) → isadoracarvmarques19@hotmail.com');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ tipo: 'reset-password', to: 'isadoracarvmarques19@hotmail.com', ok: false, erro: msg });
    console.error('[erro] reset-password →', msg);
  }

  const falhas = await prisma.emailMensagem.findMany({
    where: { tenantId: TENANT_ID, status: 'FALHA' },
    select: { id: true, assunto: true, destinatarios: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const row of falhas) {
    if (/demonstrativo/i.test(row.assunto)) {
      results.push({
        tipo: 'painel-email',
        id: row.id,
        assunto: row.assunto,
        ok: false,
        skip: true,
        erro: 'Demonstrativo com PDF — reenviar manualmente pelo Relatório de procedimentos',
      });
      console.log('[skip] demonstrativo (PDF não guardado) →', row.assunto);
      continue;
    }
    try {
      await enviarEmailMensagemService(TENANT_ID, row.id);
      const dest = Array.isArray(row.destinatarios) ? row.destinatarios.join(', ') : '';
      results.push({ tipo: 'painel-email', id: row.id, assunto: row.assunto, ok: true });
      console.log('[ok] painel →', row.assunto, '→', dest, '(sem PDF — reenviar anexo manualmente se necessário)');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ tipo: 'painel-email', id: row.id, assunto: row.assunto, ok: false, erro: msg });
      console.error('[erro] painel →', row.assunto, msg);
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log('\n--- Resumo ---');
  console.log(`Enviados: ${ok} | Falhas: ${fail} | Total: ${results.length}`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
