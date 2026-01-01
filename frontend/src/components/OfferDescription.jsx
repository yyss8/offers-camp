import React, { useEffect, useRef, useState } from "react";

export default function OfferDescription({ html, source, onView }) {
  const contentRef = useRef(null);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const checkClamp = () => {
      setClamped(el.scrollHeight > el.clientHeight + 1);
    };
    checkClamp();
  }, [html]);

  const showDetails = source === "chase" ? !!html : clamped;

  return (
    <div>
      <div
        ref={contentRef}
        className="text-sm text-stone-700"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
          overflow: "hidden"
        }}
        dangerouslySetInnerHTML={{
          __html: html || "No description provided."
        }}
      />
      {showDetails ? (
        <button
          type="button"
          onClick={onView}
          className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-700 transition hover:text-amber-900"
        >
          View details
        </button>
      ) : null}
    </div>
  );
}
