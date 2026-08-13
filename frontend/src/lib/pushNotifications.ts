import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { pathForPushTipo } from './pushDeepLink';
import { medicoService } from '../services/medico.service';

type NavigateFn = (path: string) => void;

let started = false;
let lastToken: string | null = null;

function platform(): 'ios' | 'android' {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
}

export async function startPushNotifications(navigate: NavigateFn): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (started) return;

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    console.warn('[push] permissão negada');
    return;
  }

  started = true;

  await PushNotifications.register();

  // Canal padrão Android 8+ (idempotente)
  if (Capacitor.getPlatform() === 'android') {
    try {
      await PushNotifications.createChannel({
        id: 'viva_default',
        name: 'Avisos Viva Saúde',
        description: 'Notificações operacionais e avisos',
        importance: 5,
        visibility: 1,
        sound: 'default',
      });
    } catch (err) {
      console.warn('[push] createChannel:', err);
    }
  }

  PushNotifications.addListener('registration', (token) => {
    lastToken = token.value;
    void medicoService
      .registerPushToken({ token: token.value, platform: platform() })
      .catch((err) => console.error('[push] register API:', err));
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[push] registrationError:', err);
  });

  PushNotifications.addListener('pushNotificationReceived', () => {
    // App em foreground — o sino in-app já cobre; opcional refetch
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = (action.notification?.data || {}) as Record<string, string>;
    const path = data.path || pathForPushTipo(data.tipo);
    if (path) navigate(path);
  });
}

export async function stopPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (lastToken) {
      await medicoService.unregisterPushToken({ token: lastToken }).catch(() => undefined);
    } else {
      await medicoService.unregisterPushToken({}).catch(() => undefined);
    }
  } finally {
    lastToken = null;
    started = false;
    try {
      await PushNotifications.removeAllListeners();
    } catch {
      /* ignore */
    }
  }
}
