import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { ModuloSistema } from '../../constants/modulos';

type MenuItem = { to: string; label: string };
type MenuGroup = { title: string; items: MenuItem[] };

const getMobileIcon = (label: string) => {
  switch (label) {
    case 'Dashboard':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M10 21v-6h4v6" />
        </svg>
      );
    case 'Médicos':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'Relatórios':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16v16H4z" />
          <path d="M8 15V9M12 15V6M16 15v-4" />
        </svg>
      );
    case 'Agenda':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case 'Escalas':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M7 2v4M17 2v4M3 10h18M8 14h8M8 18h5" />
        </svg>
      );
    case 'Ponto':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l3 2M9 3h6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
  }
};

const AppShell = () => {
  const { user, logout } = useAuth();
  const isMaster = user?.role === 'MASTER';
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [openDesktopGroup, setOpenDesktopGroup] = useState<string | null>(null);
  const { data: modulosAcessoResp } = useQuery({
    queryKey: ['auth', 'modulos-acesso', user?.id],
    queryFn: () => authService.getModulosAcesso(),
    enabled: !!user,
  });

  const modulosMap = modulosAcessoResp?.data?.map || ({} as Record<ModuloSistema, boolean>);
  const hasAccess = (modulo: ModuloSistema) => modulosMap[modulo] ?? true;

  const dashboardItem: MenuItem = { to: '/dashboard', label: 'Dashboard' };
  const menuGroupsBase: MenuGroup[] = isMaster
    ? [
        { title: 'Escalas', items: [{ to: '/escalas', label: 'Escalas' }, { to: '/subgrupos-equipes', label: 'Subgrupos e Equipes' }, { to: '/convites', label: 'Convites' }] },
        { title: 'Corpo Clínico', items: [{ to: '/medicos', label: 'Médicos' }] },
        { title: 'Relatórios', items: [{ to: '/relatorios', label: 'Relatórios' }] },
        {
          title: 'Administração',
          items: [
            { to: '/contratos-ativos', label: 'Contratos Ativos' },
            { to: '/valores-plantao', label: 'Valores Hora/Plantão' },
            { to: '/valores-ponto', label: 'Horas/Valor Ponto Eletrônico' },
            { to: '/envio-documentos', label: 'Envio de Documentos' },
            { to: '/configuracoes', label: 'Configurações' },
            { to: '/perfil', label: 'Minha Conta' },
          ],
        },
      ]
    : [
        { title: 'Ponto', items: [{ to: '/ponto-eletronico', label: 'Ponto Eletrônico' }] },
        { title: 'Produtividade', items: [{ to: '/atendimentos', label: 'Atendimentos' }] },
        {
          title: 'Relatórios',
          items: [
            { to: '/relatorios', label: 'Relatórios' },
            { to: '/perfil', label: 'Minha Conta' },
          ],
        },
      ];

  const moduloByRoute: Record<string, ModuloSistema> = {
    '/dashboard': 'DASHBOARD',
    '/escalas': 'ESCALAS',
    '/subgrupos-equipes': 'ESCALAS',
    '/convites': 'CONVITES',
    '/medicos': 'MEDICOS',
    '/relatorios': 'RELATORIOS',
    '/contratos-ativos': 'CONTRATOS_ATIVOS',
    '/valores-plantao': 'VALORES_PLANTAO',
    '/valores-ponto': 'PONTO_ELETRONICO',
    '/envio-documentos': 'ENVIO_DOCUMENTOS',
    '/configuracoes': 'CONFIGURACOES',
    '/perfil': 'PERFIL',
    '/ponto-eletronico': 'PONTO_ELETRONICO',
    '/atendimentos': 'ATENDIMENTOS',
  };

  const menuGroups: MenuGroup[] = menuGroupsBase
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAccess(moduloByRoute[item.to])),
    }))
    .filter((group) => group.items.length > 0);

  const mobileTabsBase: MenuItem[] = isMaster
    ? [
        dashboardItem,
        { to: '/escalas', label: 'Escalas' },
        { to: '/medicos', label: 'Médicos' },
        { to: '/relatorios', label: 'Relatórios' },
      ]
    : [
        dashboardItem,
        { to: '/ponto-eletronico', label: 'Ponto' },
        { to: '/relatorios', label: 'Relatórios' },
      ];
  const mobileTabs = mobileTabsBase.filter((item) => hasAccess(moduloByRoute[item.to]));

  return (
    <div className="min-h-screen bg-viva-50">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-viva-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/assets/logo-horizontal.png" alt="Logo Viva Saúde" className="h-8 w-auto" />
              <span className="hidden md:inline text-sm font-semibold text-viva-900">
                {isMaster ? 'Painel Master' : 'Painel Profissional'}
              </span>
            </div>

            <nav className="hidden lg:flex items-center gap-2">
              <NavLink
                to={dashboardItem.to}
                onClick={() => setOpenDesktopGroup(null)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    isActive ? 'bg-viva-900 text-white' : 'text-viva-900 hover:bg-viva-100'
                  }`
                }
              >
                {dashboardItem.label}
              </NavLink>

              {menuGroups.map((group) => (
                <div key={group.title} className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDesktopGroup((current) => (current === group.title ? null : group.title))
                    }
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-viva-900 hover:bg-viva-100 cursor-pointer flex items-center gap-2"
                  >
                    {group.title}
                    <span className="text-xs text-viva-600">▼</span>
                  </button>

                  {openDesktopGroup === group.title && (
                    <div className="absolute left-0 top-full mt-2 min-w-56 bg-white border border-viva-200 rounded-xl shadow-xl p-2">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setOpenDesktopGroup(null)}
                          className={({ isActive }) =>
                            `block px-3 py-2 rounded-lg text-sm transition ${
                              isActive
                                ? 'bg-viva-900 text-white font-semibold'
                                : 'text-viva-900 hover:bg-viva-50'
                            }`
                          }
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center rounded-full border border-viva-200 bg-viva-50 px-3 py-1.5">
                <span className="text-xs font-medium text-viva-800">
                  {user?.nomeCompleto || 'Usuário'}
                </span>
              </div>
              <button
                onClick={logout}
                className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-viva-900 border border-viva-900 hover:bg-viva-800"
              >
                Sair
              </button>
              <button
                onClick={() => setIsMoreMenuOpen(true)}
                className="lg:hidden px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-viva-900 border border-viva-900"
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <Outlet />
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-viva-200 shadow-[0_-6px_24px_rgba(8,50,20,0.12)]">
        <div
          className="grid gap-1 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length + 1}, minmax(0, 1fr))` }}
        >
          {mobileTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `min-h-[46px] px-1 py-1 text-[11px] leading-tight font-semibold text-center transition flex flex-col items-center justify-center gap-0.5 border-t-2 ${
                  isActive
                    ? 'text-viva-900 border-viva-900'
                    : 'text-viva-700 border-transparent hover:text-viva-900'
                }`
              }
            >
              <span className="text-base leading-none">{getMobileIcon(tab.label)}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setIsMoreMenuOpen(true)}
            className="min-h-[46px] px-1 py-1 text-[11px] leading-tight font-semibold text-viva-700 hover:text-viva-900 transition flex flex-col items-center justify-center gap-0.5 border-t-2 border-transparent"
          >
            <span className="text-base leading-none">⋯</span>
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {isMoreMenuOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/35"
            aria-label="Fechar menu"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-80 max-w-[90vw] bg-white border-l border-viva-200 shadow-2xl">
            <div className="h-full flex flex-col p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-viva-900">Menu</h3>
                <button
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="px-2 py-1 text-xs font-semibold rounded-md bg-viva-100 text-viva-900"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-viva-200 bg-viva-50 px-3 py-2">
                <p className="text-xs font-medium text-viva-700">{user?.nomeCompleto || 'Usuário'}</p>
                <p className="text-[11px] text-viva-600">
                  {isMaster ? 'Perfil Master' : 'Perfil Profissional'}
                </p>
              </div>

              <nav className="mt-4 space-y-4 overflow-y-auto">
                <NavLink
                  to={dashboardItem.to}
                  onClick={() => setIsMoreMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm font-semibold transition ${
                      isActive ? 'bg-viva-900 text-white' : 'bg-viva-100/60 text-viva-900'
                    }`
                  }
                >
                  {dashboardItem.label}
                </NavLink>

                {menuGroups.map((group) => (
                  <div key={group.title}>
                    <p className="text-[11px] uppercase tracking-wide text-viva-600 mb-2">{group.title}</p>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMoreMenuOpen(false)}
                          className={({ isActive }) =>
                            `block px-3 py-2 rounded-lg text-sm transition ${
                              isActive
                                ? 'bg-viva-900 text-white font-semibold'
                                : 'bg-viva-100/60 text-viva-900'
                            }`
                          }
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
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
