import { prisma } from '../config/database';
import type { PushPlatform } from '../jobs/push.types';

export async function registerDevicePushToken(input: {
  tenantId: string;
  medicoId: string;
  token: string;
  platform: PushPlatform;
}) {
  const token = input.token.trim();
  if (!token || token.length < 20) {
    throw { statusCode: 400, message: 'Token de push inválido' };
  }
  const platform = input.platform === 'ios' ? 'ios' : 'android';

  // Se o token já existir em outro médico, transferir (reinstalação / troca de conta)
  await prisma.devicePushToken.upsert({
    where: { token },
    create: {
      tenantId: input.tenantId,
      medicoId: input.medicoId,
      token,
      platform,
    },
    update: {
      tenantId: input.tenantId,
      medicoId: input.medicoId,
      platform,
    },
  });

  return { success: true };
}

export async function unregisterDevicePushToken(input: {
  tenantId: string;
  medicoId: string;
  token?: string;
}) {
  if (input.token?.trim()) {
    await prisma.devicePushToken.deleteMany({
      where: {
        tenantId: input.tenantId,
        medicoId: input.medicoId,
        token: input.token.trim(),
      },
    });
  } else {
    await prisma.devicePushToken.deleteMany({
      where: { tenantId: input.tenantId, medicoId: input.medicoId },
    });
  }
  return { success: true };
}
