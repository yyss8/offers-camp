import React from "react";

export default function DashboardHeader({
  debouncedQuery,
  cardFilter,
  sourceFilter,
  total,
  user,
  onLogout,
  onChangePassword
}) {
  const hasFilters =
    debouncedQuery.trim() || cardFilter !== "all" || sourceFilter !== "all";

  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <img
          src="/images/logo-sm.png"
          alt="Offers Camp"
          className="h-10 w-auto"
          loading="lazy"
        />
        <h1 className="mt-3 text-3xl font-semibold text-stone-900 sm:text-4xl">
          Collected offers from your active session
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          Displaying normalized offer data captured by the Tampermonkey collector.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3 rounded-2xl bg-stone-900 px-5 py-4 text-stone-100 shadow-lg">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
            {hasFilters ? "Filtered offers" : "Total offers"}
          </p>
          <p className="mt-2 text-2xl font-semibold">{total}</p>
          {hasFilters && (
            <p className="mt-2 text-[11px] text-stone-400">
              Filtered
              {debouncedQuery.trim() ? ` · "${debouncedQuery.trim()}"` : ""}
              {cardFilter !== "all" ? ` · Card ${cardFilter}` : ""}
              {sourceFilter !== "all" ? ` · ${sourceFilter}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-stone-300">
          <span>{user.username}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onChangePassword}
              className="rounded-full border border-stone-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-200 transition hover:border-stone-400 hover:text-white"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full border border-stone-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-200 transition hover:border-stone-400 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
