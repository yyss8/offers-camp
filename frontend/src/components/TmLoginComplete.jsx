import React from "react";

export default function TmLoginComplete({ tmStatus, onClose }) {
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
            Login complete
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {tmStatus || "Finishing sign-in..."}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-700 shadow-sm transition hover:border-stone-400"
          >
            Close window
          </button>
        </div>
      </div>
    </div>
  );
}
