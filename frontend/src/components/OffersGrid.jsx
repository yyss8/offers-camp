import React, { useState } from "react";

import OfferDescription from "./OfferDescription";

export default function OffersGrid({
  offers,
  loading,
  isFiltering,
  formatExpiresDisplay,
  isExpiringSoon,
  onViewDetails
}) {
  const MAX_VISIBLE_CARDS = 4;

  const CardTagGroup = ({ cards, offerId }) => {
    const [expanded, setExpanded] = useState(false);
    const shouldCollapse = cards.length > MAX_VISIBLE_CARDS;
    const visibleCards =
      expanded || !shouldCollapse
        ? cards
        : cards.slice(0, MAX_VISIBLE_CARDS - 1);

    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {visibleCards.map(card => {
          const cardLabel = (card.label || "").trim();
          const tooltip = cardLabel
            ? `${cardLabel} - ${card.cardNum}`
            : `Card ${card.cardNum}`;
          return (
            <span
              className={`cursor-help rounded-full border px-2 py-1 text-[11px] font-medium ${
                card.enrolled
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-stone-200 bg-white text-stone-600"
              }`}
              key={`card-${offerId}-${card.cardNum}`}
              title={tooltip}
            >
              Card {card.cardNum}
            </span>
          );
        })}
        {shouldCollapse ? (
          <button
            type="button"
            className="rounded-full border border-stone-200 bg-white px-2 py-1 text-[11px] font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? "Show less" : "Show all"}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="relative">
      {(loading || isFiltering) && (
        <div className="absolute inset-0 z-10 rounded-2xl bg-white/70 backdrop-blur-sm"></div>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {offers.map(offer => (
          <article
            className="relative flex h-full flex-col gap-3 rounded-2xl border border-stone-200 bg-white/80 p-5 shadow-sm backdrop-blur"
            key={offer.id}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {offer.image ? (
                <img
                  src={offer.image}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-lg border border-stone-200 object-contain bg-white"
                />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <h2 className="min-w-0 flex-1 break-words text-base font-semibold text-stone-900">
                  {offer.title || "Untitled offer"}
                </h2>
                {(() => {
                  const sourceKey = (offer.source || "amex").toLowerCase();
                  const iconSrc = `/images/cards/${sourceKey}.png`;
                  return (
                    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                      <img
                        src={iconSrc}
                        alt={sourceKey}
                        loading="lazy"
                        className="h-4 w-4 object-contain"
                      />
                      <span>{sourceKey}</span>
                    </span>
                  );
                })()}
              </div>
            </div>
            <OfferDescription
              html={offer.summary || ""}
              source={(offer.source || "").toLowerCase()}
              onView={() =>
                onViewDetails({
                  title: offer.title || "Offer details",
                  html: offer.summary || "",
                  source: (offer.source || "").toLowerCase(),
                  image: offer.image || ""
                })
              }
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span
                className={
                  isExpiringSoon(offer.expires)
                    ? "font-semibold text-red-600"
                    : ""
                }
              >
                {formatExpiresDisplay(offer.expires)
                  ? `Expires ${formatExpiresDisplay(offer.expires)}`
                  : "No expiry"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(offer.categories || []).map(tag => (
                <span
                  className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-800"
                  key={`cat-${offer.id}-${tag}`}
                >
                  {tag}
                </span>
              ))}
              {(offer.channels || []).map(tag => (
                <span
                  className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-700"
                  key={`chn-${offer.id}-${tag}`}
                >
                  {tag}
                </span>
              ))}
            </div>
            {offer.cards && offer.cards.length > 0 ? (
              <CardTagGroup cards={offer.cards} offerId={offer.id} />
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
