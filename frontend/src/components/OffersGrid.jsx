import React from "react";

import OfferDescription from "./OfferDescription";

export default function OffersGrid({
  offers,
  loading,
  isFiltering,
  formatExpiresDisplay,
  isExpiringSoon,
  onViewDetails
}) {
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
              <div className="flex flex-wrap gap-2 pt-1">
                {offer.cards.map(card => {
                  const cardLabel = (card.label || "").trim();
                  const tooltip = cardLabel
                    ? `${cardLabel} - ${card.last5}`
                    : `Card ${card.last5}`;
                  return (
                    <span
                      className={`cursor-help rounded-full border px-2 py-1 text-[11px] font-medium ${
                        card.enrolled
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-stone-200 bg-white text-stone-600"
                      }`}
                      key={`card-${offer.id}-${card.last5}`}
                      title={tooltip}
                    >
                      Card {card.last5}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
