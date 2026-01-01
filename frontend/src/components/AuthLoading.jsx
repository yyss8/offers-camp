import React from "react";

export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-stone-900">
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl border border-stone-200 bg-white/80 px-6 py-8 text-sm text-stone-600 shadow-sm">
          Checking session...
        </div>
      </div>
    </div>
  );
}
