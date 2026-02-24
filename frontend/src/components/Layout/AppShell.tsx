import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AppShell = () => {
  const { user, logout } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const commonItems = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/perfil', label: 'Minha Conta' },
  ];

  const masterItems = [
    { to: '/medicos', label: 'Médicos' },
    { to: '/convites', label: 'Convites' },
    { to: '/relatorios', label: 'Relatórios' },
    { to: '/configuracoes', label: 'Configurações' },
  ];

  const medicoItems = [
    { to: '/agenda', label: 'Agenda' },
    { to: '/atendimentos', label: 'Atendimentos' },
    { to: '/relatorios', label: 'Relatórios' },
  ];

  const navItems = [...commonItems, ...(isMaster ? masterItems : medicoItems)];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2.5 rounded-xl text-sm font-semibold transition border ${
      isActive
        ? 'bg-viva-900 text-white border-viva-800 shadow-sm'
        : 'bg-white text-viva-900 border-viva-200 hover:bg-viva-50'
    }`;

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-viva-50 md:flex">
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-72 bg-white border-r border-viva-200 shadow-sm">
        <div className="flex h-full w-full flex-col p-5">
          <div className="rounded-2xl bg-viva-950 border border-viva-900 px-4 py-4">
            <img src="/assets/logo-horizontal.png" alt="Logo Viva Saúde" className="h-9 w-auto" />
            <p className="mt-2 text-xs font-semibold tracking-wide text-viva-100">
              {isMaster ? 'Painel Master' : 'Painel Profissional'}
            </p>
          </div>

          <nav className="mt-5 flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-4">
            <button
              onClick={logout}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-viva-900 hover:bg-viva-800 border border-viva-900 transition"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:ml-72">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-viva-200 px-4 py-3 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/assets/logo-horizontal.png" alt="Logo Viva Saúde" className="h-7 w-auto md:hidden" />
              <span className="text-sm font-semibold tracking-wide text-viva-900">
                {isMaster ? 'Painel Master' : 'Painel Profissional'}
              </span>
            </div>
            <button
              onClick={logout}
              className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-viva-900 border border-viva-900 hover:bg-viva-800"
            >
              Sair
            </button>
            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="md:hidden px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-viva-900 border border-viva-900"
            >
              Menu
            </button>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>

      {isMobileMenuOpen && (
        <>
          <button
            className="md:hidden fixed inset-0 z-30 bg-black/35"
            aria-label="Fechar menu"
            onClick={closeMobileMenu}
          />
          <aside className="md:hidden fixed left-0 top-0 bottom-0 z-40 w-72 max-w-[85vw] bg-white border-r border-viva-200 shadow-2xl">
            <div className="flex h-full flex-col p-4">
              <div className="rounded-2xl bg-viva-950 border border-viva-900 px-4 py-4">
                <img src="/assets/logo-horizontal.png" alt="Logo Viva Saúde" className="h-9 w-auto" />
                <p className="mt-2 text-xs font-semibold tracking-wide text-viva-100">
                  {isMaster ? 'Painel Master' : 'Painel Profissional'}
                </p>
              </div>

              <nav className="mt-5 flex flex-col gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={linkClass}
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-auto pt-4">
                <button
                  onClick={logout}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-viva-900 hover:bg-viva-800 border border-viva-900 transition"
                >
                  Sair
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default AppShell;
