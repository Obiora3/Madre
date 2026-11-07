import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider.jsx";
import { useTheme } from "../lib/theme.js";
import { Avatar, Logo } from "../components/ui.jsx";
import {
  BriefcaseIcon, CloseIcon, FolderIcon, HomeIcon, LogOutIcon, MenuIcon, MoonIcon, SettingsIcon, SunIcon,
} from "../components/icons.jsx";

const nav = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/projects", label: "Projects", icon: FolderIcon },
  { to: "/clients", label: "Clients", icon: BriefcaseIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function Sidebar({ onNavigate }) {
  const { me, workspace, signOut } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-4">
        <Link to="/" onClick={onNavigate}><Logo /></Link>
        <p className="mt-1 truncate pl-9 text-xs text-muted">{workspace?.name}</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {nav.map(({ to, label, icon: NavIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition ${
                isActive ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`
            }
          >
            <NavIcon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2">
          <Link to="/settings/profile" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 hover:bg-surface-2">
            <Avatar name={me?.name} src={me?.avatar_url} size={30} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{me?.name}</span>
              <span className="block truncate text-xs text-muted">{me?.job_title || me?.email}</span>
            </span>
          </Link>
          <button onClick={toggle} title="Toggle theme" aria-label="Toggle theme" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={signOut} title="Sign out" aria-label="Sign out" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink">
            <LogOutIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-surface shadow-xl">
            <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="absolute top-5 right-3 rounded-lg p-1.5 text-muted hover:bg-surface-2">
              <CloseIcon />
            </button>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 md:hidden">
          <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-muted hover:bg-surface-2">
            <MenuIcon />
          </button>
          <Logo />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
