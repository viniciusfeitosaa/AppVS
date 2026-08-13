import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startPushNotifications, stopPushNotifications } from '../lib/pushNotifications';

/**
 * Inicializa push nativo (Capacitor) após login de associado.
 * No browser web não faz nada.
 */
export function PushBootstrap() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'MEDICO') {
      void stopPushNotifications();
      return;
    }
    void startPushNotifications((path) => navigate(path));
  }, [isAuthenticated, user?.role, navigate]);

  useEffect(() => {
    return () => {
      // não remove listeners no unmount de remount; stop só no logout
    };
  }, []);

  return null;
}
