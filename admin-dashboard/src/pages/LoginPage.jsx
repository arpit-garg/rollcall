import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("warden@college.edu");
  const [password, setPassword] = useState("Warden@123");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await login({
        email,
        password
      });
    } catch (error) {
      setErrorMessage(error.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4 py-10 text-ink">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[2rem] bg-gradient-to-br from-ink via-[#114b5f] to-pine p-8 text-white shadow-2xl">
          <p className="text-sm uppercase tracking-[0.35em] text-white/70">Hostel Attendance</p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">
            Warden operations dashboard for live attendance control.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/80">
            Open nightly windows, monitor verification results, and record manual overrides
            without leaving the console.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Live View</p>
              <p className="mt-3 text-lg font-semibold">Window + record polling</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Audit Trail</p>
              <p className="mt-3 text-lg font-semibold">Override log with reasons</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Demo Account</p>
              <p className="mt-3 text-lg font-semibold">Seeded warden credentials ready</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-8 shadow-xl ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.25em] text-steel">Sign In</p>
          <h2 className="mt-3 text-3xl font-semibold text-ink">Warden Access</h2>
          <p className="mt-3 text-sm text-steel">
            Use the seeded demo warden account or your own warden credentials.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-semibold text-ink">Email</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink">Password</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <button
              className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Open Dashboard"}
            </button>
          </form>

          <div className="mt-8 rounded-3xl bg-slate-50 p-4 text-sm text-steel">
            <p className="font-semibold text-ink">Demo credentials</p>
            <p className="mt-2">Email: warden@college.edu</p>
            <p>Password: Warden@123</p>
          </div>
        </section>
      </div>
    </div>
  );
}
