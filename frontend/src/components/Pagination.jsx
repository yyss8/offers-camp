import React from "react";

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const maxButtons = 5;
  const start = Math.max(1, page - Math.floor(maxButtons / 2));
  const end = Math.min(totalPages, start + maxButtons - 1);
  const adjustedStart = Math.max(1, end - maxButtons + 1);

  const pages = [];
  for (let current = adjustedStart; current <= end; current += 1) {
    pages.push(current);
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded-full border border-stone-300 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-700 shadow-sm transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {pages.map(number => {
          const isActive = number === page;
          return (
            <button
              key={`page-${number}`}
              type="button"
              onClick={() => onPageChange(number)}
              className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${
                isActive
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white/80 text-stone-700 hover:border-stone-400"
              }`}
            >
              {number}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded-full border border-stone-300 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-700 shadow-sm transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
