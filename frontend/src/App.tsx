import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import AppShell from './components/Layout/AppShell';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AcceptInvite from './pages/AcceptInvite';
import Medicos from './pages/Medicos';
import FeaturePlaceholder from './pages/FeaturePlaceholder';

// Componente para garantir que a intro seja vista antes do login
const LoginGuard = ({ children }: { children: React.ReactNode }) => {
  const { introPlayed, isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!introPlayed) {
    return <Navigate to="/" replace />;
  }

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
      <Route path="/" element={<Home />} />
      <Route 
        path="/login" 
        element={
          <LoginGuard>
            <Login />
          </LoginGuard>
        } 
      />
      <Route path="/ativar-conta/:token" element={<AcceptInvite />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/medicos" element={<Medicos />} />
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
          path="/agenda"
          element={
            <FeaturePlaceholder
              title="Agenda"
              description="Visualize seus horários e compromissos clínicos."
            />
          }
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
          element={
            <FeaturePlaceholder
              title="Relatórios"
              description="Acompanhe indicadores e resultados da operação em tempo real."
            />
          }
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
          path="/perfil"
          element={
            <FeaturePlaceholder
              title="Minha Conta"
              description="Gerencie seus dados cadastrais e informações de acesso."
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
