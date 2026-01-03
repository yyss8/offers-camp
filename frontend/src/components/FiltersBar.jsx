import React from "react";

export default function FiltersBar({
  query,
  onQueryChange,
  cardFilter,
  onCardFilterChange,
  sourceFilter,
  onSourceFilterChange,
  highlightedFilter,
  onHighlightedFilterChange,
  cardOptions,
  sourceOptions,
  showReset,
  onReset,
  filteredCount,
  page,
  totalPages
}) {
  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative w-full sm:flex-1">
        <input
          type="search"
          placeholder="Search title or summary"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          className="w-full rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
      </div>
      <select
        value={cardFilter}
        onChange={event => onCardFilterChange(event.target.value)}
        className="w-full rounded-full border border-stone-300 bg-white/80 px-4 py-3 pr-7 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 sm:w-80"
        style={{ backgroundPosition: 'right 0.5rem center' }}
      >
        <option value="all">All cards</option>
        {cardOptions.map(card => {
          const value = card?.cardNum || "";
          const source = card?.source || "";
          const cardLabel = (card?.cardLabel || card?.card_label || "").trim();
          const labelSource = source
            ? source[0].toUpperCase() + source.slice(1)
            : "Card";
          const label = cardLabel
            ? `${cardLabel} - ${value}`
            : value
              ? `${labelSource} - ${value}`
              : labelSource;
          return (
            <option key={`${source}-${value}`} value={value}>
              {label}
            </option>
          );
        })}
      </select>
      <select
        value={sourceFilter}
        onChange={event => onSourceFilterChange(event.target.value)}
        className="w-full rounded-full border border-stone-300 bg-white/80 px-4 py-3 pr-7 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 sm:w-44"
        style={{ backgroundPosition: 'right 0.5rem center' }}
      >
        <option value="all">All sources</option>
        {sourceOptions.map(source => {
          const label = source ? source[0].toUpperCase() + source.slice(1) : source;
          return (
            <option key={source} value={source}>
              {label}
            </option>
          );
        })}
      </select>
      <select
        value={highlightedFilter}
        onChange={event => onHighlightedFilterChange(event.target.value)}
        className="w-full rounded-full border border-stone-300 bg-white/80 px-4 py-3 pr-7 text-sm text-stone-800 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200 sm:w-44"
        style={{ backgroundPosition: 'right 0.5rem center' }}
      >
        <option value="all">All offers</option>
        <option value="true">Highlighted</option>
        <option value="false">Not highlighted</option>
      </select>
      {showReset && (
        <button
          type="button"
          onClick={onReset}
          className="w-full rounded-full border border-stone-300 bg-white/80 px-4 py-3 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-400 sm:w-auto"
        >
          Reset filters
        </button>
      )}
      <span className="text-xs font-medium text-stone-500 sm:ml-auto">
        {filteredCount} shown (page {page} of {totalPages})
      </span>
    </section>
  );
}
