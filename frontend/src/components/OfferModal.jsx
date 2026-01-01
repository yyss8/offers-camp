import React from "react";

export default function OfferModal({ modal, onClose }) {
  if (!modal) return null;

  const sourceLabel = modal.source
    ? modal.source[0].toUpperCase() + modal.source.slice(1)
    : "Offer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {modal.image ? (
              <img
                src={modal.image}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-xl border border-stone-200 bg-white object-contain"
              />
            ) : null}
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
                {sourceLabel}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-stone-900">
                {modal.title || "Offer details"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
          >
            Close
          </button>
        </div>
        <div
          className="mt-4 max-h-[60vh] overflow-y-auto text-sm text-stone-700"
          dangerouslySetInnerHTML={{
            __html: modal.html || "No description provided."
          }}
        />
      </div>
    </div>
  );
}
