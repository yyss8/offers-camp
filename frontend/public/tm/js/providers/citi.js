(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};
  const utils = OffersCamp.utils || {};

  function createCitiProvider() {
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const API_HINT = "/merchantOffers/retrieve";

    function match() {
      return (
        location.host.includes("online.citi.com") &&
        location.pathname.includes("/merchantoffers")
      );
    }

    function extractLast4(label) {
      if (!label) return "";
      if (utils.extractLastDigits) {
        return utils.extractLastDigits(label, 4);
      }
      const matchValue = String(label).match(/-\s*(\d+)/);
      if (!matchValue) return "";
      return matchValue[1];
    }

    function getSelectedCardLast4() {
      const el = pageWindow.document?.querySelector("#cds-dropdown .cds-dd2-text-nowrap");
      const label = el?.textContent || "";
      return extractLast4(label);
    }

    function getPrimaryCardLast4(payload) {
      const cards = Array.isArray(payload?.cardArtDetails) ? payload.cardArtDetails : [];
      const primary = cards[0];
      if (!primary) return "";
      return extractLast4(primary.displayProductName || "");
    }

    function parseChannels(value) {
      if (utils.parseChannels) {
        return utils.parseChannels(value);
      }
      if (!value) return [];
      return String(value)
        .split("_")
        .map(item => item.trim())
        .filter(Boolean);
    }

    function formatExpiry(value) {
      if (utils.formatExpiry) {
        return utils.formatExpiry(value);
      }
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const yy = String(date.getFullYear()).slice(-2);
      return `${mm}/${dd}/${yy}`;
    }

    function normalizeOffers(payload) {
      const groups = Array.isArray(payload?.merchantOffers) ? payload.merchantOffers : [];
      if (!groups.length) return [];
      const cardLast5 = getSelectedCardLast4() || getPrimaryCardLast4(payload);
      const offers = groups.flatMap(group => (Array.isArray(group.offers) ? group.offers : []));
      if (!offers.length) return [];
      return offers
        .map(offer => ({
          source: "citi",
          id: offer.offerId,
          title: offer.merchantName || offer.offerTitle || "Citi Offer",
          summary: offer.offerTitle || offer.merchantName || "",
          expires: formatExpiry(offer.offerEndDate || ""),
          categories: offer.merchantCategory ? [offer.merchantCategory] : [],
          enrolled: offer.offerStatus === "ENROLLED",
          sourceUrl: location.href,
          collectedAt: utils.nowIso ? utils.nowIso() : new Date().toISOString(),
          image: offer.merchantImageURL || offer.merchantBannerImageUrl || "",
          channels: parseChannels(offer.redemptionType),
          cardLast5
        }))
        .filter(item => item.id && item.expires);
    }

    function handlePayload(payload, pushOffers) {
      const normalized = normalizeOffers(payload);
      if (!normalized.length) return;
      pushOffers("citi", normalized);
    }

    function installFetchHook(pushOffers) {
      if (utils.installFetchJsonHook) {
        utils.installFetchJsonHook(
          pageWindow,
          "__ccOffersCitiFetch",
          url => url.includes(API_HINT),
          data => handlePayload(data, pushOffers)
        );
        return;
      }
      if (!pageWindow.fetch || pageWindow.fetch.__ccOffersCitiHooked) return;
      const originalFetch = pageWindow.fetch;
      pageWindow.fetch = function (...args) {
        const requestUrl =
          typeof args[0] === "string"
            ? args[0]
            : args[0]?.url || "";
        const fetchPromise = originalFetch.apply(this, args);
        fetchPromise.then(response => {
          if (!requestUrl.includes(API_HINT)) return;
          response.clone().json().then(data => handlePayload(data, pushOffers)).catch(() => {});
        }).catch(() => {});
        return fetchPromise;
      };
      pageWindow.fetch.__ccOffersCitiHooked = true;
    }

    function installXhrHook(pushOffers) {
      if (utils.installXhrJsonHook) {
        utils.installXhrJsonHook(
          pageWindow,
          "__ccOffersCitiXhr",
          url => url.includes(API_HINT),
          data => handlePayload(data, pushOffers)
        );
        return;
      }
      if (!pageWindow.XMLHttpRequest || pageWindow.XMLHttpRequest.__ccOffersCitiHooked) return;
      const OriginalXHR = pageWindow.XMLHttpRequest;
      function PatchedXHR() {
        const xhr = new OriginalXHR();
        let requestUrl = "";
        const originalOpen = OriginalXHR.prototype.open;
        xhr.open = function (...args) {
          requestUrl = typeof args[1] === "string" ? args[1] : "";
          return originalOpen.apply(xhr, args);
        };
        xhr.addEventListener("load", function () {
          if (!requestUrl.includes(API_HINT)) return;
          try {
            if (!xhr.responseType || xhr.responseType === "text") {
              if (!xhr.responseText) return;
              handlePayload(JSON.parse(xhr.responseText), pushOffers);
            } else if (xhr.responseType === "json") {
              if (!xhr.response) return;
              handlePayload(xhr.response, pushOffers);
            }
          } catch (_) {}
        });
        return xhr;
      }
      PatchedXHR.prototype = OriginalXHR.prototype;
      Object.assign(PatchedXHR, OriginalXHR);
      PatchedXHR.__ccOffersCitiHooked = true;
      pageWindow.XMLHttpRequest = PatchedXHR;
    }

    return {
      id: "citi",
      match,
      getCardLabel() {
        const last4 = getSelectedCardLast4();
        return last4 ? `Card ${last4}` : "";
      },
      start(pushOffers) {
        installFetchHook(pushOffers);
        installXhrHook(pushOffers);
      },
      manualFetch() {}
    };
  }

  if (typeof OffersCamp.registerProvider === "function") {
    OffersCamp.registerProvider(createCitiProvider());
  } else {
    OffersCamp.providers = OffersCamp.providers || [];
    OffersCamp.providers.push(createCitiProvider());
  }
})();
