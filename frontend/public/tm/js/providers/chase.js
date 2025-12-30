(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};
  const utils = OffersCamp.utils || {};

  function createChaseProvider() {
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const API_HINT = "/customer-offers";

    function match() {
      if (!location.host.includes("secure.chase.com")) {
        return false;
      }
      if (location.pathname.includes("/merchantOffers/offer-hub")) {
        return true;
      }
      return location.hash.includes("/merchantOffers/offer-hub");
    }

    function getSelectedCardLast4() {
      const host = pageWindow.document?.querySelector("#select-credit-card-account");
      const root = host && host.shadowRoot ? host.shadowRoot : null;
      const el = root
        ? root.querySelector("#select-select-credit-card-account span")
        : pageWindow.document?.querySelector("#select-select-credit-card-account span");
      const label = el?.textContent || "";
      const matchValue = label.match(/\(\.\.\.(\d{4})\)/);
      return matchValue ? matchValue[1] : "";
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
      const groups = Array.isArray(payload?.customerOffers) ? payload.customerOffers : [];
      const offers = groups.flatMap(group => (Array.isArray(group.offers) ? group.offers : []));
      if (!offers.length) return [];
      const cardLast5 = getSelectedCardLast4();

      return offers
        .map(offer => ({
          source: "chase",
          id: offer.offerIdentifier,
          title: offer.merchantDetails?.merchantName || offer.offerDisplayDetails?.offerHeaderText || "Chase Offer",
          summary: offer.offerDisplayDetails?.rewardDescriptionText || offer.offerDisplayDetails?.shortMessageText || "",
          expires: formatExpiry(offer.offerDetails?.offerEndTimestamp || ""),
          categories: Array.isArray(offer.offerCategories)
            ? offer.offerCategories.map(category => category.offerCategoryName).filter(Boolean)
            : [],
          enrolled: offer.offerStatusName === "ACTIVATED",
          sourceUrl: location.href,
          collectedAt: utils.nowIso ? utils.nowIso() : new Date().toISOString(),
          image:
            offer.offerDisplayDetails?.images?.heroImage?.imageLinkUrlText ||
            offer.offerDisplayDetails?.images?.logo?.imageLinkUrlText ||
            "",
          channels: Array.isArray(offer.offerDisplayDetails?.locationRestrictions)
            ? offer.offerDisplayDetails.locationRestrictions
                .map(item => item.locationName)
                .filter(Boolean)
            : [],
          cardLast5
        }))
        .filter(item => item.id && item.expires);
    }

    function handlePayload(payload, pushOffers) {
      const normalized = normalizeOffers(payload);
      if (!normalized.length) return;
      if (!normalized.some(item => !item.cardLast5)) {
        pushOffers("chase", normalized);
        return;
      }
      const waitForCard = utils.waitForValue || waitForCardLast4;
      waitForCard(getSelectedCardLast4, cardLast5 => {
        const filled = cardLast5
          ? normalized.map(item => (item.cardLast5 ? item : { ...item, cardLast5 }))
          : normalized;
        pushOffers("chase", filled);
      });
    }

    function waitForCardLast4(onReady, attempts = 10) {
      const cardLast5 = getSelectedCardLast4();
      if (cardLast5 || attempts <= 0) {
        onReady(cardLast5);
        return;
      }
      pageWindow.setTimeout(() => {
        waitForCardLast4(onReady, attempts - 1);
      }, 500);
    }

    function installFetchHook(pushOffers) {
      if (utils.installFetchJsonHook) {
        utils.installFetchJsonHook(
          pageWindow,
          "__ccOffersChaseFetch",
          url => url.includes(API_HINT),
          data => handlePayload(data, pushOffers)
        );
        return;
      }
      if (!pageWindow.fetch || pageWindow.fetch.__ccOffersChaseHooked) return;
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
      pageWindow.fetch.__ccOffersChaseHooked = true;
    }

    function installXhrHook(pushOffers) {
      if (utils.installXhrJsonHook) {
        utils.installXhrJsonHook(
          pageWindow,
          "__ccOffersChaseXhr",
          url => url.includes(API_HINT),
          data => handlePayload(data, pushOffers)
        );
        return;
      }
      if (!pageWindow.XMLHttpRequest || pageWindow.XMLHttpRequest.__ccOffersChaseHooked) return;
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
      PatchedXHR.__ccOffersChaseHooked = true;
      pageWindow.XMLHttpRequest = PatchedXHR;
    }

    return {
      id: "chase",
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
    OffersCamp.registerProvider(createChaseProvider());
  } else {
    OffersCamp.providers = OffersCamp.providers || [];
    OffersCamp.providers.push(createChaseProvider());
  }
})();
