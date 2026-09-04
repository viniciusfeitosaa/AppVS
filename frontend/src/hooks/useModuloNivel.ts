import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import type { ModuloSistema, NivelAcessoModulo } from '../constants/modulos';
import {
  authService,
  canEdit as canEditPerm,
  hasAccess as hasAccessPerm,
  isAdminPleno as isAdminPlenoPerm,
  nivelDeModulo,
} from '../services/auth.service';

/**
 * Nível de acesso ao módulo (`OFF` | `VER` | `EDITAR`), reutilizando a query
 * `['auth', 'modulos-acesso', userId]` do AppShell.
 * Enquanto carrega, assume OFF / sem acesso (evita chamar APIs proibidas e redirect 403).
 */
export function useModuloNivel(modulo: ModuloSistema) {
  const { user } = useAuth();
  const { data: modulosAcessoResp, isLoading } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });

  const perms = modulosAcessoResp?.data;
  const loaded = !!modulosAcessoResp;
  const nivel: NivelAcessoModulo = !loaded ? 'OFF' : nivelDeModulo(perms, modulo);

  return {
    nivel,
    canEdit: loaded && canEditPerm(perms, modulo),
    hasAccess: loaded && hasAccessPerm(perms, modulo),
    isAdminPleno: loaded && isAdminPlenoPerm(perms),
    isLoading,
    loaded,
  };
}
