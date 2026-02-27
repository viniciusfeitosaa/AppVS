import { Link, Outlet } from 'react-router-dom';

export default function LandingLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-50 border-b border-viva-100 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/assets/logo.avif" alt="Logo" className="h-10 w-auto" />
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/sobre"
              className="text-viva-800 hover:text-viva-600 font-medium transition"
            >
              Sobre
            </Link>
            <Link
              to="/contato"
              className="text-viva-800 hover:text-viva-600 font-medium transition"
            >
              Contato
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-viva-600 text-white font-semibold hover:bg-viva-700 transition shadow-md"
            >
              Área do associado
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-viva-100 py-8 text-center text-sm text-viva-700">
        <div className="max-w-6xl mx-auto px-4">
          © {new Date().getFullYear()} Viva Saúde. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
