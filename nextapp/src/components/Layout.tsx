import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { api } from "../api/client";
import { DemoDataBanner } from "./DemoDataBanner";
import { LiveModeBanner } from "./LiveModeBanner";

const NAV_ITEMS = [
  { to: "/overview", label: "Overview" },
  { to: "/deals", label: "Deals" },
  { to: "/learnings", label: "Learnings" },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/agent", label: "Ask Revenue Learning" },
  { to: "/settings", label: "Settings" },
];

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" className="h-4 w-4">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [connectionMode, setConnectionMode] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    api.get<{ mode: string }>("/api/settings/graph8-connection").then((res) => setConnectionMode(res.mode));
  }, []);

  const navLinks = (
    <>
      <div className="mb-8 flex items-center justify-between px-2">
        <div>
          <div className="text-lg font-semibold text-ink dark:text-slate-100">Graph8</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Revenue Learning</div>
        </div>
        <button
          onClick={() => setMobileNavOpen(false)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 md:hidden"
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          onClick={toggle}
          className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <div className="px-2 text-sm font-medium text-ink dark:text-slate-100">{user?.name}</div>
        <div className="px-2 text-xs text-slate-400 dark:text-slate-500">{user?.email}</div>
        <button
          onClick={logout}
          className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950 md:flex-row">
      {/* Mobile top bar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <div className="text-lg font-semibold text-ink dark:text-slate-100">Graph8</div>
        <button
          onClick={() => setMobileNavOpen(true)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
      </div>

      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`z-50 flex w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 transition-transform dark:border-slate-800 dark:bg-slate-900 md:static md:translate-x-0 ${
          mobileNavOpen ? "fixed inset-y-0 left-0 translate-x-0" : "fixed inset-y-0 left-0 -translate-x-full md:flex"
        }`}
      >
        {navLinks}
      </aside>

      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-10 md:py-8">
        {connectionMode === "live" ? <LiveModeBanner /> : connectionMode === "demo" ? <DemoDataBanner /> : null}
        <Outlet />
      </main>
    </div>
  );
}
