import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import OverrideLogPage from "./pages/OverrideLogPage.jsx";
import ParentDashboardPage from "./pages/ParentDashboardPage.jsx";
import StudentSummaryPage from "./pages/StudentSummaryPage.jsx";
import SuperAdminDashboardPage from "./pages/SuperAdminDashboardPage.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { getDefaultRouteForRole, getRoleShell } from "./config/roleConfig.js";

const linkClass = ({ isActive }) =>
  [
    "rounded-full px-4 py-2 text-sm font-semibold transition",
    isActive ? "bg-ink text-white" : "bg-white/70 text-ink hover:bg-white"
  ].join(" ");

function getRoutesForRole(role) {
  if (role === "warden") {
    return [
      { path: "/", element: <DashboardPage /> },
      { path: "/students", element: <StudentSummaryPage /> },
      { path: "/overrides", element: <OverrideLogPage /> }
    ];
  }

  if (role === "parent") {
    return [{ path: "/", element: <ParentDashboardPage /> }];
  }

  if (role === "super_admin") {
    return [{ path: "/", element: <SuperAdminDashboardPage /> }];
  }

  return [];
}

export default function App() {
  const { isAuthenticated, isHydrated, logout, user } = useAuth();
  const shell = getRoleShell(user?.role);
  const routes = getRoutesForRole(user?.role);
  const defaultRoute = getDefaultRouteForRole(user?.role);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist text-steel">
        Preparing dashboard...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (!shell || routes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-4 text-steel">
        This account role is not configured for the dashboard.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[2rem] bg-gradient-to-r from-ink via-[#114b5f] to-pine px-6 py-8 text-white shadow-xl">
          <p className="text-sm uppercase tracking-[0.35em] text-white/70">
            {shell.eyebrow}
          </p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">{shell.title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                {shell.description}
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              {shell.links.length > 1 ? (
                <nav className="flex gap-3">
                  {shell.links.map((link) => (
                    <NavLink key={link.to} to={link.to} end={link.to === "/"} className={linkClass}>
                      {link.label}
                    </NavLink>
                  ))}
                </nav>
              ) : null}
              <div className="flex items-center gap-3 text-sm text-white/80">
                <span>{user?.name}</span>
                <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
                  {String(user?.role || "").replace("_", " ")}
                </span>
                <button
                  className="rounded-full border border-white/25 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
                  type="button"
                  onClick={logout}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <Routes>
            {routes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            <Route path="*" element={<Navigate to={defaultRoute} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
