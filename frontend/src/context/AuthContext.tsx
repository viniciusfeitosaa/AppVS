import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, LoginCredentials } from '../services/auth.service';

interface User {
  id: string;
  role: 'MASTER' | 'MEDICO';
  tenantId: string;
  nomeCompleto: string;
  crm?: string;
  email: string | null;
  especialidade?: string | null;
  vinculo?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  introPlayed: boolean;
  setIntroPlayed: (played: boolean) => void;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const fallbackAuthContext: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  introPlayed: false,
  setIntroPlayed: () => undefined,
  login: async () => {
    throw new Error('AuthProvider indisponível no momento');
  },
  logout: () => undefined,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [introPlayed, setIntroPlayed] = useState(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          setUser(parsed);
        }
      }
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);
      
      if (response.success && response.data) {
        const userData = response.data.medico || response.data.user;
        if (!userData) {
          throw new Error('Resposta de login sem dados de usuário');
        }

        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    authService.logout();
    setUser(null);
    setIntroPlayed(false); // Reseta a intro ao sair
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        introPlayed,
        setIntroPlayed,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    if (import.meta.env.DEV) {
      // Em hot reload, evita quebrar toda a árvore por inconsistência temporária de contexto.
      console.warn('AuthContext temporariamente indisponível durante hot reload.');
      return fallbackAuthContext;
    }
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
