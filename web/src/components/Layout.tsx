import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../data';
import { useAuth } from '../lib/auth';
import Icon from './Icon';
import Logo from './Logo';

const NAV = [
  { to: '/', label: 'Преглед', icon: 'overview', end: true },
  { to: '/posts', label: 'Публикации', icon: 'posts', end: false },
  { to: '/compare', label: 'Сравнение', icon: 'compare', end: false },
  { to: '/sync', label: 'Синхронизация', icon: 'sync', end: false },
];

export function DemoBadge() {
  if (!api.demo) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-yellow/15 px-2.5 py-0.5 text-xs font-semibold text-brand-yellow ring-1 ring-brand-yellow/40">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow" /> Демо данни
    </span>
  );
}

export default function Layout() {
  const { email, signOut } = useAuth();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-cream/10 bg-ink-900/70 p-6 lg:flex">
        <div>
          <Logo />
          <p className="eyebrow mt-1">Social Hub</p>
          <nav className="mt-10 flex flex-col gap-1" aria-label="Основна навигация">
            {NAV.map((n) => (
              <NavLink
                key={n.to} to={n.to} end={n.end}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-brand-yellow text-ink' : 'text-cream-dim hover:bg-cream/5 hover:text-cream'
                  }`}
              >
                <Icon name={n.icon} />
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="space-y-3 text-xs text-cream-dim">
          <DemoBadge />
          {email && <p className="break-all">{email}</p>}
          {!api.demo && (
            <button onClick={signOut} className="inline-flex items-center gap-2 text-cream-dim hover:text-brand-yellow">
              <Icon name="logout" className="h-4 w-4" /> Изход
            </button>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cream/10 bg-ink/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
          <div className="flex items-center gap-3">
            <DemoBadge />
            {!api.demo && (
              <button onClick={signOut} aria-label="Изход" className="text-cream-dim hover:text-brand-yellow">
                <Icon name="logout" />
              </button>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-cream/10 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Основна навигация"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to} to={n.to} end={n.end}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                isActive ? 'text-brand-yellow' : 'text-cream-dim'
              }`}
          >
            <Icon name={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
