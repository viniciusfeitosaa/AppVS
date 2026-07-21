import { Request, Response } from 'express';
import {
  createEmailMensagemService,
  deleteEmailMensagemService,
  enviarEmailMensagemService,
  getEmailMensagemService,
  getEmailPainelResumoService,
  listEmailMensagensService,
  testarConexaoSmtpService,
} from './email.service';

export async function getEmailPainelResumoController(req: Request, res: Response) {
  try {
    const data = await getEmailPainelResumoService(req.user!.tenantId);
    return res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar resumo';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function listEmailMensagensController(req: Request, res: Response) {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const data = await listEmailMensagensService(req.user!.tenantId, limit);
    return res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao listar mensagens';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function getEmailMensagemController(req: Request, res: Response) {
  try {
    const data = await getEmailMensagemService(req.user!.tenantId, req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada' });
    }
    return res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar mensagem';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function createEmailMensagemController(req: Request, res: Response) {
  try {
    const { assunto, corpoHtml, corpoTexto, destinatarios } = req.body as {
      assunto?: string;
      corpoHtml?: string;
      corpoTexto?: string;
      destinatarios?: string[];
    };

    const data = await createEmailMensagemService(
      req.user!.tenantId,
      req.user!.role === 'MASTER' ? req.user!.id : null,
      {
      assunto: assunto || '',
      corpoHtml,
      corpoTexto,
      destinatarios: Array.isArray(destinatarios) ? destinatarios : [],
    });

    return res.status(201).json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar mensagem';
    return res.status(400).json({ success: false, error: message });
  }
}

export async function enviarEmailMensagemController(req: Request, res: Response) {
  try {
    const data = await enviarEmailMensagemService(req.user!.tenantId, req.params.id);
    return res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
    return res.status(400).json({ success: false, error: message });
  }
}

export async function testarConexaoSmtpController(_req: Request, res: Response) {
  try {
    const data = await testarConexaoSmtpService();
    return res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao testar SMTP';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function deleteEmailMensagemController(req: Request, res: Response) {
  try {
    await deleteEmailMensagemService(req.user!.tenantId, req.params.id);
    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir mensagem';
    return res.status(400).json({ success: false, error: message });
  }
}
