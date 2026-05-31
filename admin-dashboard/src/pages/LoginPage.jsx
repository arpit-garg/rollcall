import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { DASHBOARD_DEMO_ACCOUNTS } from "../config/roleConfig.js";

export default function LoginPage() {
  const { login, parentSignup } = useAuth();
  const demoCredentialsEnabled = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === "true";
  const [formMode, setFormMode] = useState("sign-in");
  const [loginEmail, setLoginEmail] = useState(() => (demoCredentialsEnabled ? "warden@college.edu" : ""));
  const [loginPassword, setLoginPassword] = useState(() => (demoCredentialsEnabled ? "Warden@123" : ""));
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isParentSignup = formMode === "parent-signup";

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (isParentSignup) {
        await parentSignup({
          name: parentName,
          email: parentEmail,
          password: parentPassword,
          studentId
        });
      } else {
        await login({
          email: loginEmail,
          password: loginPassword
        });
      }
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
            Multi-role campus dashboard for wardens, parents, and super admins.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/80">
            Wardens monitor attendance operations, parents approve leave and review child history,
            and super admins provision hostels with warden accounts.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Live View</p>
              <p className="mt-3 text-lg font-semibold">Warden windows and overrides</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Parent Desk</p>
              <p className="mt-3 text-lg font-semibold">Child attendance + leave approval</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/65">Admin Control</p>
              <p className="mt-3 text-lg font-semibold">Hostel and warden provisioning</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-8 shadow-xl ring-1 ring-slate-200">
          <p className="text-sm uppercase tracking-[0.25em] text-steel">Sign In</p>
          <h2 className="mt-3 text-3xl font-semibold text-ink">Dashboard Access</h2>
          <p className="mt-3 text-sm text-steel">
            {isParentSignup
              ? "Register with your child's student ID, then continue to the parent dashboard."
              : "Sign in with a warden, parent, or super admin account to continue."}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-full bg-slate-100 p-1 text-sm font-semibold">
            <button
              className={[
                "rounded-full px-4 py-2 transition",
                !isParentSignup ? "bg-white text-ink shadow-sm" : "text-steel hover:text-ink"
              ].join(" ")}
              type="button"
              onClick={() => {
                setFormMode("sign-in");
                setErrorMessage("");
              }}
            >
              Sign In
            </button>
            <button
              className={[
                "rounded-full px-4 py-2 transition",
                isParentSignup ? "bg-white text-ink shadow-sm" : "text-steel hover:text-ink"
              ].join(" ")}
              type="button"
              onClick={() => {
                setFormMode("parent-signup");
                setErrorMessage("");
              }}
            >
              Parent Sign Up
            </button>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {isParentSignup ? (
              <label className="block">
                <span className="text-sm font-semibold text-ink">Parent Name</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                  type="text"
                  value={parentName}
                  onChange={(event) => setParentName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-ink">Email</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="email"
                value={isParentSignup ? parentEmail : loginEmail}
                onChange={(event) =>
                  isParentSignup ? setParentEmail(event.target.value) : setLoginEmail(event.target.value)
                }
                autoComplete="username"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink">Password</span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                type="password"
                value={isParentSignup ? parentPassword : loginPassword}
                onChange={(event) =>
                  isParentSignup
                    ? setParentPassword(event.target.value)
                    : setLoginPassword(event.target.value)
                }
                autoComplete={isParentSignup ? "new-password" : "current-password"}
                required
              />
            </label>

            {isParentSignup ? (
              <label className="block">
                <span className="text-sm font-semibold text-ink">Registered Student ID</span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                  type="text"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
            ) : null}

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
              {isSubmitting
                ? isParentSignup
                  ? "Creating parent account..."
                  : "Signing in..."
                : isParentSignup
                  ? "Create Parent Account"
                  : "Open Dashboard"}
            </button>
          </form>

          {demoCredentialsEnabled && !isParentSignup ? (
            <div className="mt-8 rounded-3xl bg-slate-50 p-4 text-sm text-steel">
              <p className="font-semibold text-ink">Demo credentials</p>
              <div className="mt-3 space-y-3">
                {DASHBOARD_DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.role}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-ink hover:bg-slate-50"
                    type="button"
                    onClick={() => {
                      setLoginEmail(account.email);
                      setLoginPassword(account.password);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-ink">{account.label}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-steel">
                        Use demo
                      </span>
                    </div>
                    <p className="mt-2">{account.email}</p>
                    <p>Password: {account.password}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
