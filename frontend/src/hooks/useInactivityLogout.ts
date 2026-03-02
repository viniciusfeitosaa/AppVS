import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const INACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

/**
 * Faz logout e redireciona para o login após `timeoutMs` sem nenhuma ação do usuário.
 * Reinicia o timer a cada interação (clique, tecla, scroll, toque).
 * Deve ser usado apenas dentro da área autenticada (ex.: AppShell).
 */
export function useInactivityLogout(timeoutMs: number) {
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = setTimeout(() => {
      logout();
      navigate('/login', { replace: true });
    }, timeoutMs);
  }, [logout, navigate, timeoutMs]);

  useEffect(() => {
    if (!isAuthenticated) return;

    resetTimer();

    const handleActivity = () => resetTimer();

    INACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handleActivity));

    return () => {
      INACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isAuthenticated, resetTimer]);
}
