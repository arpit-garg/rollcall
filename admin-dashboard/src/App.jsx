import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import OverrideLogPage from "./pages/OverrideLogPage.jsx";
import { useAuth } from "./context/AuthContext.jsx";

const linkClass = ({ isActive }) =>
  [
    "rounded-full px-4 py-2 text-sm font-semibold transition",
    isActive ? "bg-ink text-white" : "bg-white/70 text-ink hover:bg-white"
  ].join(" ");

export default function App() {
  const { isAuthenticated, isHydrated, logout, user } = useAuth();

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

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[2rem] bg-gradient-to-r from-ink via-[#114b5f] to-pine px-6 py-8 text-white shadow-xl">
          <p className="text-sm uppercase tracking-[0.35em] text-white/70">
            Warden Console
          </p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Hostel Attendance Control Room</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Monitor attendance windows, review failed verifications, and track manual overrides.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <nav className="flex gap-3">
                <NavLink to="/" end className={linkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/overrides" className={linkClass}>
                  Override Log
                </NavLink>
              </nav>
              <div className="flex items-center gap-3 text-sm text-white/80">
                <span>{user?.name}</span>
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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/overrides" element={<OverrideLogPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
