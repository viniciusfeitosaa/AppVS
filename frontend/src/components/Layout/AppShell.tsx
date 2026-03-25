import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { ModuloSistema } from '../../constants/modulos';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';
import NotificationBell from './NotificationBell';

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
    case 'Documentos':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
    case 'Ponto Eletrônico':
      return getMobileIcon('Ponto');
    case 'Minha Conta':
    case 'Perfil':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
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

/** Tempo sem atividade (em ms) antes do logout automático. 40 min. */
const INACTIVITY_LOGOUT_MS = 40 * 60 * 1000;

const AppShell = () => {
  const { user, logout } = useAuth();
  useInactivityLogout(INACTIVITY_LOGOUT_MS);
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
          title: 'Conta',
          items: [
            { to: '/documentos', label: 'Documentos' },
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
    '/documentos': 'PERFIL',
    '/ponto-eletronico': 'PONTO_ELETRONICO',
    '/atendimentos': 'ATENDIMENTOS',
  };

  const menuGroups: MenuGroup[] = menuGroupsBase
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAccess(moduloByRoute[item.to])),
    }))
    .filter((group) => group.items.length > 0);

  /** No mobile: só Dashboard, Ponto (ou Escalas no master) e o menu "Mais" com o resto. */
  const mobileTabsBase: MenuItem[] = isMaster
    ? [dashboardItem, { to: '/escalas', label: 'Escalas' }]
    : [dashboardItem, { to: '/ponto-eletronico', label: 'Ponto' }];
  const mobileTabs = mobileTabsBase.filter((item) => hasAccess(moduloByRoute[item.to]));

  return (
    <div className="app-shell min-h-screen">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[var(--app-border)]">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={`${import.meta.env.BASE_URL}assets/logo-horizontal.png`} alt="Logo Viva Saúde" className="h-12 w-auto" />
            </div>

            <nav className="hidden lg:flex items-center gap-1.5">
              <NavLink
                to={dashboardItem.to}
                onClick={() => setOpenDesktopGroup(null)}
                className={({ isActive }) =>
                  `nav-pill font-display ${isActive ? 'nav-pill-active' : 'nav-pill-inactive'}`
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
                    className="nav-pill nav-pill-inactive font-display flex items-center gap-1.5"
                  >
                    {group.title}
                    <svg className="w-3.5 h-3.5 text-viva-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {openDesktopGroup === group.title && (
                    <div className="absolute left-0 top-full mt-2 min-w-56 bg-white/95 backdrop-blur-md border border-[var(--app-border)] rounded-2xl shadow-lg p-2">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setOpenDesktopGroup(null)}
                          className={({ isActive }) =>
                            `block px-3 py-2.5 rounded-xl text-sm font-medium transition font-display ${
                              isActive
                                ? 'bg-viva-900 text-white'
                                : 'text-viva-800 hover:bg-viva-50'
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
              <NotificationBell />
              <button
                onClick={logout}
                className="hidden md:inline-flex px-4 py-2 rounded-xl text-sm font-semibold text-white bg-viva-900 hover:bg-viva-800 transition shadow-sm font-display"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-10">
        <Outlet />
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-md border-t border-[var(--app-border)] rounded-t-2xl shadow-[0_-8px_30px_rgba(8,50,20,0.08)]">
        <div
          className="grid gap-0 px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length + 1}, minmax(0, 1fr))` }}
        >
          {mobileTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `min-h-[52px] px-1 py-1 text-[11px] font-semibold text-center transition flex flex-col items-center justify-center gap-1 rounded-xl font-display ${
                  isActive
                    ? 'text-viva-900 bg-viva-100/90'
                    : 'text-viva-700 hover:bg-viva-50/60'
                }`
              }
            >
              <span className="text-lg leading-none">{getMobileIcon(tab.label)}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setIsMoreMenuOpen(true)}
            className="min-h-[52px] px-1 py-1 text-[11px] font-semibold text-viva-700 hover:bg-viva-50/60 transition flex flex-col items-center justify-center gap-1 rounded-xl font-display"
          >
            <span className="text-lg leading-none">⋯</span>
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {isMoreMenuOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fade-in"
            aria-label="Fechar menu"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-80 max-w-[90vw] bg-white/98 backdrop-blur-xl border-l border-[var(--app-border)] shadow-2xl rounded-l-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex-none border-b border-viva-200/60 bg-gradient-to-b from-viva-50/50 to-transparent px-5 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-viva-700 font-display">Menu</h3>
                <button
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-viva-100 text-viva-700 hover:bg-viva-200 transition"
                  aria-label="Fechar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="rounded-2xl border border-viva-200/60 bg-gradient-to-br from-viva-50/80 to-viva-100/40 px-4 py-3">
                <p className="text-sm font-semibold text-viva-900 truncate font-display">{user?.nomeCompleto || 'Usuário'}</p>
                <p className="text-xs text-viva-600 mt-0.5 font-serif">
                  {isMaster ? 'Perfil Master' : 'Perfil Profissional'}
                </p>
              </div>

              <nav className="mt-6 space-y-5">
                <NavLink
                  to={dashboardItem.to}
                  onClick={() => setIsMoreMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                      isActive ? 'bg-viva-900 text-white shadow-sm' : 'bg-viva-100/60 text-viva-900 hover:bg-viva-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                          isActive ? 'bg-white/20 text-white' : 'bg-viva-200/50 text-viva-700'
                        }`}
                      >
                        {getMobileIcon(dashboardItem.label)}
                      </span>
                      {dashboardItem.label}
                    </>
                  )}
                </NavLink>

                {menuGroups.map((group) => (
                  <div key={group.title}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-viva-600 mb-2 px-1 font-display">{group.title}</p>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMoreMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                              isActive ? 'bg-viva-900 text-white shadow-sm' : 'bg-viva-100/60 text-viva-900 hover:bg-viva-100'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isActive ? 'bg-white/20 text-white' : 'bg-viva-200/50 text-viva-700'
                                }`}
                              >
                                {getMobileIcon(item.label)}
                              </span>
                              {item.label}
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            <div className="flex-none p-5 border-t border-viva-200/60 bg-viva-50/30">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-viva-900 hover:bg-viva-800 transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default AppShell;
