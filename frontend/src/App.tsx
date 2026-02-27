import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import AppShell from './components/Layout/AppShell';
import LandingLayout from './components/Layout/LandingLayout';
import Landing from './pages/Landing';
import Sobre from './pages/Sobre';
import Contato from './pages/Contato';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Dashboard from './pages/Dashboard';
import AcceptInvite from './pages/AcceptInvite';
import Medicos from './pages/Medicos';
import FeaturePlaceholder from './pages/FeaturePlaceholder';
import ContratosAtivos from './pages/ContratosAtivos';
import Escalas from './pages/Escalas';
import SubgruposEquipes from './pages/SubgruposEquipes';
import ValoresPlantao from './pages/ValoresPlantao';
import ValoresPonto from './pages/ValoresPonto';
import PontoEletronico from './pages/PontoEletronico';
import Relatorios from './pages/Relatorios';
import Perfil from './pages/Perfil';
import EnvioDocumentos from './pages/EnvioDocumentos';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import AcessoNegado from './pages/AcessoNegado';

// Redireciona para o dashboard se já estiver autenticado (evita ver login/cadastro)
const LoginGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Só redireciona se estiver autenticado (ex.: redefinir-senha vindo do e-mail)
const AuthOnlyRedirect = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function AppRoutes() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-viva-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-viva-600 mx-auto" />
          <p className="mt-4 text-viva-800">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/sobre" element={<Sobre />} />
        <Route path="/contato" element={<Contato />} />
      </Route>
      <Route 
        path="/login" 
        element={
          <LoginGuard>
            <Login />
          </LoginGuard>
        } 
      />
      <Route
        path="/cadastro"
        element={
          <LoginGuard>
            <Cadastro />
          </LoginGuard>
        }
      />
      <Route path="/ativar-conta/:token" element={<AcceptInvite />} />
      <Route path="/esqueci-senha" element={<LoginGuard><EsqueciSenha /></LoginGuard>} />
      <Route path="/redefinir-senha" element={<AuthOnlyRedirect><RedefinirSenha /></AuthOnlyRedirect>} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/acesso-negado" element={<AcessoNegado />} />
        <Route path="/medicos" element={<Medicos />} />
        <Route path="/escalas" element={<Escalas />} />
        <Route path="/subgrupos-equipes" element={<SubgruposEquipes />} />
        <Route
          path="/convites"
          element={
            <FeaturePlaceholder
              title="Convites"
              description="Gerencie os convites de ativação e acompanhe o status de envio/aceite."
            />
          }
        />
        <Route
          path="/ponto-eletronico"
          element={<PontoEletronico />}
        />
        <Route
          path="/atendimentos"
          element={
            <FeaturePlaceholder
              title="Atendimentos"
              description="Área dedicada ao acompanhamento de atendimentos e histórico clínico."
            />
          }
        />
        <Route
          path="/relatorios"
          element={<Relatorios />}
        />
        <Route
          path="/configuracoes"
          element={
            <FeaturePlaceholder
              title="Configurações"
              description="Parametrize regras de negócio e preferências do tenant."
            />
          }
        />
        <Route
          path="/contratos-ativos"
          element={<ContratosAtivos />}
        />
        <Route
          path="/valores-plantao"
          element={<ValoresPlantao />}
        />
        <Route
          path="/valores-ponto"
          element={<ValoresPonto />}
        />
        <Route
          path="/envio-documentos"
          element={<EnvioDocumentos />}
        />
        <Route
          path="/perfil"
          element={<Perfil />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.PROD ? '/app' : '/'} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
