(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};
  const utils = OffersCamp.utils || {};

  function createAmexProvider() {
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

    function match() {
      return (
        location.host.includes("americanexpress.com") &&
        location.pathname.includes("/offers")
      );
    }

    function getCardLast5() {
      const el = pageWindow.document?.querySelector(".simple-switcher-display-option[aria-label]");
      const label = el?.getAttribute("aria-label") || "";
      const digits = label.replace(/\D/g, "");
      if (!digits) return "";
      return digits.slice(-5);
    }

    function getAccountNumberProxyFromLink() {
      const doc = pageWindow.document;
      if (!doc) return "";
      const link = doc.querySelector("#added-view-more-header");
      const href = link && link.getAttribute("href");
      if (!href) return "";
      try {
        const url = new URL(href, pageWindow.location.origin);
        return url.searchParams.get("opaqueAccountId") || "";
      } catch (_) {
        const matchValue = href.match(/opaqueAccountId=([^&]+)/);
        return matchValue ? matchValue[1] : "";
      }
    }

    function normalizeOffers(data) {
      const sources = [
        data?.recommendedOffers?.offersList?.page1,
        data?.offers,
        data?.addedToCard?.offersList?.page1,
        data?.enrolledOffers?.offersList?.page1
      ];

      const flattened = sources.filter(Array.isArray).flat();
      if (!flattened.length) return [];
      const cardLast5 = getCardLast5();

      return flattened
        .map(o => ({
          source: "amex",
          id: o.offerId,
          title: o.title,
          summary: o.shortDescription,
          expires: o.expiration?.text,
          categories: (o.applicableCategories || []).map(c => c.optionType),
          enrolled: o.enrollmentDetails?.status === "ENROLLED",
          sourceUrl: location.href,
          collectedAt: utils.nowIso ? utils.nowIso() : new Date().toISOString(),
          image: o.image,
          channels: (o.applicableFilters || []).map(f => f.optionType),
          cardLast5
        }))
        .filter(o => o.id && o.expires);
    }

    function handleOffers(data, pushOffers) {
      const normalized = normalizeOffers(data);
      if (!normalized.length) return;
      pushOffers("amex", normalized);
    }

    function installFetchHook(pushOffers) {
      if (!pageWindow.fetch || pageWindow.fetch.__ccOffersHooked) return;
      const originalFetch = pageWindow.fetch;
      pageWindow.fetch = function (...args) {
        const requestUrl =
          typeof args[0] === "string"
            ? args[0]
            : args[0]?.url || "";
        const fetchPromise = originalFetch.apply(this, args);
        fetchPromise.then(response => {
          if (!requestUrl.toLowerCase().includes("offer")) return;
          response.clone().json().then(data => handleOffers(data, pushOffers)).catch(() => {});
        }).catch(() => {});
        return fetchPromise;
      };
      pageWindow.fetch.__ccOffersHooked = true;
    }

    function installXhrHook(pushOffers) {
      if (!pageWindow.XMLHttpRequest || pageWindow.XMLHttpRequest.__ccOffersHooked) return;
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
          if (!requestUrl || !requestUrl.toLowerCase().includes("offer")) return;
          try {
            if (!xhr.responseType || xhr.responseType === "text") {
              if (!xhr.responseText) return;
              handleOffers(JSON.parse(xhr.responseText), pushOffers);
            } else if (xhr.responseType === "json") {
              if (!xhr.response) return;
              handleOffers(xhr.response, pushOffers);
            }
          } catch (_) {}
        });
        return xhr;
      }
      PatchedXHR.prototype = OriginalXHR.prototype;
      Object.assign(PatchedXHR, OriginalXHR);
      PatchedXHR.__ccOffersHooked = true;
      pageWindow.XMLHttpRequest = PatchedXHR;
    }

    function manualFetch(pushOffers, setStatus) {
      const accountNumberProxy = getAccountNumberProxyFromLink();
      if (!accountNumberProxy) {
        setStatus("Missing account id");
        return;
      }
      const payload = {
        accountNumberProxy,
        locale: "en-US",
        offerPage: "page1",
        requestType: "OFFERSHUB_LANDING",
        sortBy: "RECOMMENDED"
      };
      GM_xmlhttpRequest({
        method: "POST",
        url: "https://functions.americanexpress.com/ReadOffersHubPresentation.web.v1",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "ce-source": "WEB"
        },
        data: JSON.stringify(payload),
        onload: response => {
          try {
            if (response && response.responseText) {
              handleOffers(JSON.parse(response.responseText), pushOffers);
            }
          } catch (_) {}
        }
      });
    }

    return {
      id: "amex",
      needsManualFetch: true,
      match,
      getCardLabel() {
        const last5 = getCardLast5();
        return last5 ? `Card ${last5}` : "";
      },
      start(pushOffers) {
        installFetchHook(pushOffers);
        installXhrHook(pushOffers);
      },
      manualFetch(pushOffers, setStatus) {
        manualFetch(pushOffers, setStatus);
      }
    };
  }

  if (typeof OffersCamp.registerProvider === "function") {
    OffersCamp.registerProvider(createAmexProvider());
  } else {
    OffersCamp.providers = OffersCamp.providers || [];
    OffersCamp.providers.push(createAmexProvider());
  }
})();
