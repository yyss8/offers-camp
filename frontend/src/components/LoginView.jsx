import React from "react";

export default function LoginView({
  isLocalApi,
  loginForm,
  onLoginChange,
  onSubmit,
  authError,
  loggingIn
}) {
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
          <h1 className="mt-3 text-2xl font-semibold text-stone-900">Sign in</h1>
          <p className="mt-2 text-sm text-stone-600">
            Log in to access your offers dashboard.
          </p>
          {isLocalApi ? (
            <p className="mt-2 text-xs text-stone-500">
              (Local server detected. Use username <b>1</b> and password <b>1</b>.)
            </p>
          ) : null}
          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Username or email
              <input
                type="text"
                value={loginForm.username}
                onChange={event => onLoginChange("username", event.target.value)}
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
                onChange={event => onLoginChange("password", event.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                autoComplete="current-password"
                required
              />
            </label>
            {authError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                {authError}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loggingIn}
              className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingIn ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
