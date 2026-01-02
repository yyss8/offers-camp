import React from "react";

export default function LoginView({
  isLocalApi,
  authMode,
  onModeChange,
  loginForm,
  onLoginChange,
  onSubmit,
  registerForm,
  onRegisterChange,
  onRegisterSubmit,
  verifyForm,
  onVerifyChange,
  onVerifySubmit,
  onResendCode,
  authError,
  authNotice,
  loggingIn,
  registering,
  verifying,
  resending,
  resendCooldown
}) {
  const mode = isLocalApi ? "login" : authMode;
  const heading =
    mode === "register"
      ? "Create account"
      : mode === "verify"
        ? "Verify email"
        : "Sign in";
  const subtitle =
    mode === "register"
      ? "Start collecting offers in minutes."
      : mode === "verify"
        ? "Enter the 6-digit code we sent."
        : "Log in to access your offers dashboard.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-stone-900">
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-lg">
          <img
            src="/images/logo-sm.png"
            alt="Offers Camp"
            className="h-7 w-auto"
            loading="lazy"
          />
          <h1 className="mt-3 text-2xl font-semibold text-stone-900">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-stone-600">{subtitle}</p>
          {isLocalApi ? (
            <p className="mt-2 text-xs text-stone-500">
              (Local server detected. Use username <b>1</b> and password <b>1</b>.)
            </p>
          ) : null}
          {!isLocalApi && mode !== "verify" ? (
            <div className="mt-5 inline-flex rounded-full border border-stone-200 bg-white p-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              <button
                type="button"
                onClick={() => onModeChange("login")}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${mode === "login"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-900"
                  }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => onModeChange("register")}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${mode === "register"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-900"
                  }`}
              >
                Register
              </button>
            </div>
          ) : null}
          {!isLocalApi && mode === "verify" ? (
            <button
              type="button"
              onClick={() => onModeChange("register")}
              className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 hover:text-stone-900"
            >
              Back to register
            </button>
          ) : null}
          {authNotice ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              {authNotice}
            </div>
          ) : null}
          {authError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
              {authError}
            </div>
          ) : null}
          {mode === "register" ? (
            <form className="mt-6 flex flex-col gap-4" onSubmit={onRegisterSubmit}>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Username
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={event =>
                    onRegisterChange("username", event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  autoComplete="username"
                  minLength={4}
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Email
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={event => onRegisterChange("email", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Password
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={event =>
                    onRegisterChange("password", event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={registering}
                className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {registering ? "Creating..." : "Create account"}
              </button>
            </form>
          ) : mode === "verify" ? (
            <form className="mt-6 flex flex-col gap-4" onSubmit={onVerifySubmit}>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Email
                <input
                  type="email"
                  value={verifyForm.email}
                  onChange={event => onVerifyChange("email", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
                  autoComplete="email"
                  disabled
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Verification code
                <input
                  type="text"
                  value={verifyForm.code}
                  onChange={event => onVerifyChange("code", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={verifying}
                className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? "Verifying..." : "Verify"}
              </button>
              <button
                type="button"
                onClick={onResendCode}
                disabled={resending || resendCooldown > 0}
                className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resending ? "Sending..." : resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
              </button>
            </form>
          ) : (
            <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Username or email
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={event =>
                    onLoginChange("username", event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={event =>
                    onLoginChange("password", event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                  autoComplete="current-password"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={loggingIn}
                className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingIn ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
