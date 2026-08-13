import { Request, Response } from 'express';
import { registerDevicePushToken, unregisterDevicePushToken } from '../services/push-token.service';
import { broadcastAvisoAdminService } from '../services/notificacao-medico.service';
import type { PushPlatform } from '../jobs/push.types';

export const registerPushTokenController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { token, platform } = req.body as { token?: string; platform?: string };
    if (!token || !platform) {
      return res.status(400).json({ success: false, error: 'token e platform são obrigatórios' });
    }
    const plat: PushPlatform = platform === 'ios' ? 'ios' : 'android';
    await registerDevicePushToken({ tenantId, medicoId, token, platform: plat });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao registrar push token',
    });
  }
};

export const unregisterPushTokenController = async (req: Request, res: Response) => {
  try {
    const medicoId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!medicoId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { token } = req.body as { token?: string };
    await unregisterDevicePushToken({ tenantId, medicoId, token });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao remover push token',
    });
  }
};

export const broadcastPushController = async (req: Request, res: Response) => {
  try {
    const masterId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!masterId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Não autenticado' });
    }
    const { titulo, corpo } = req.body as { titulo?: string; corpo?: string };
    const result = await broadcastAvisoAdminService(tenantId, {
      titulo: titulo || '',
      corpo: corpo || '',
      masterId,
    });
    return res.status(200).json({
      success: true,
      data: result,
      message: `Aviso enfileirado para ${result.enviados} profissional(is).`,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Erro ao enviar aviso',
    });
  }
};
