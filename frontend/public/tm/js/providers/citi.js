(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};
  const utils = OffersCamp.utils || {};

  function createCitiProvider() {
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const API_HINT = "/merchantOffers/retrieve";
    const settingsStore = OffersCamp.settings;
    let lastRequest = null;

    function match() {
      return (
        location.host.includes("online.citi.com") &&
        location.pathname.includes("/merchantoffers")
      );
    }

    function extractLast4(label) {
      if (!label) return "";
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

    function isAutoSendEnabled() {
      if (!settingsStore || typeof settingsStore.get !== "function") return true;
      const current = settingsStore.get();
      return current.autoSend !== false;
    }

    function getGroupCardLast4(group) {
      if (!group) return "";
      const candidates = [
        group.accountNumberSuffix,
        group.accountNumberLastFour,
        group.accountLastFour,
        group.lastFourAccountNumber,
        group.accountNumber,
        group.cardAccountNumber,
        group.cardAccountId,
        group.accountId
      ];
      for (const value of candidates) {
        const last4 = extractLast4(value);
        if (last4) return last4;
      }
      return "";
    }

    function getOfferCardLast4(offer) {
      if (!offer) return "";
      const candidates = [
        offer.accountNumberSuffix,
        offer.accountNumberLastFour,
        offer.accountLastFour,
        offer.lastFourAccountNumber,
        offer.cardLastFour,
        offer.cardLast4,
        offer.accountNumber,
        offer.cardAccountNumber,
        offer.accountId
      ];
      for (const value of candidates) {
        const last4 = extractLast4(value);
        if (last4) return last4;
      }
      return "";
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
      const selectedLast4 = getSelectedCardLast4();
      const primaryLast4 = getPrimaryCardLast4(payload);
      const offers = groups.flatMap(group => {
        const groupLast4 = getGroupCardLast4(group);
        const items = Array.isArray(group.offers) ? group.offers : [];
        return items.map(offer => ({
          offer,
          cardLast5: getOfferCardLast4(offer) || groupLast4 || selectedLast4 || primaryLast4
        }));
      });
      if (!offers.length) return [];
      return offers
        .map(entry => ({
          source: "citi",
          id: entry.offer.offerId,
          title: entry.offer.merchantName || entry.offer.offerTitle || "Citi Offer",
          summary: entry.offer.offerTitle || entry.offer.merchantName || "",
          expires: formatExpiry(entry.offer.offerEndDate || ""),
          categories: entry.offer.merchantCategory ? [entry.offer.merchantCategory] : [],
          enrolled: entry.offer.offerStatus === "ENROLLED",
          sourceUrl: location.href,
          collectedAt: utils.nowIso ? utils.nowIso() : new Date().toISOString(),
          image: entry.offer.merchantImageURL || entry.offer.merchantBannerImageUrl || "",
          channels: parseChannels(entry.offer.redemptionType),
          cardLast5: entry.cardLast5
        }))
        .filter(item => item.id && item.expires);
    }

    function cloneHeaders(value) {
      if (!value) return {};
      if (value instanceof pageWindow.Headers) {
        const headers = {};
        value.forEach((headerValue, key) => {
          headers[key] = headerValue;
        });
        return headers;
      }
      if (Array.isArray(value)) {
        return value.reduce((acc, [key, headerValue]) => {
          acc[key] = headerValue;
          return acc;
        }, {});
      }
      if (typeof value === "object") {
        return { ...value };
      }
      return {};
    }

    function recordRequest(url, options) {
      if (!url || !url.includes(API_HINT)) return;
      lastRequest = { url, options };
    }

    function handlePayload(payload, pushOffers, source) {
      if (provider.needsManualFetch && source !== "manual") return;
      const normalized = normalizeOffers(payload);
      if (!normalized.length) return;
      if (source === "manual") {
        const selectedLast4 = getSelectedCardLast4();
        if (selectedLast4) {
          const filtered = normalized
            .filter(item => !item.cardLast5 || item.cardLast5 === selectedLast4)
            .map(item => (item.cardLast5 ? item : { ...item, cardLast5: selectedLast4 }));
          if (!filtered.length) return;
          pushOffers("citi", filtered);
          return;
        }
      }
      pushOffers("citi", normalized);
    }

    function installFetchHook(pushOffers) {
      if (!pageWindow.fetch || pageWindow.fetch.__ccOffersCitiHooked) return;
      const originalFetch = pageWindow.fetch;
      pageWindow.fetch = function (...args) {
        const requestUrl =
          typeof args[0] === "string"
            ? args[0]
            : args[0]?.url || "";
        const requestInit = args[1] || {};
        const headers = {
          ...cloneHeaders(args[0]?.headers),
          ...cloneHeaders(requestInit.headers)
        };
        const options = {
          method: requestInit.method || args[0]?.method || "GET",
          headers,
          body: requestInit.body ?? null,
          credentials: requestInit.credentials || args[0]?.credentials || "include",
          mode: requestInit.mode || args[0]?.mode
        };
        recordRequest(requestUrl, options);
        const fetchPromise = originalFetch.apply(this, args);
        fetchPromise.then(response => {
          if (!requestUrl.includes(API_HINT)) return;
          response.clone().json().then(data => handlePayload(data, pushOffers, "hook")).catch(() => {});
        }).catch(() => {});
        return fetchPromise;
      };
      pageWindow.fetch.__ccOffersCitiHooked = true;
    }

    function installXhrHook(pushOffers) {
      if (!pageWindow.XMLHttpRequest || pageWindow.XMLHttpRequest.__ccOffersCitiHooked) return;
      const OriginalXHR = pageWindow.XMLHttpRequest;
      function PatchedXHR() {
        const xhr = new OriginalXHR();
        let requestUrl = "";
        let requestMethod = "GET";
        let requestHeaders = {};
        const originalOpen = OriginalXHR.prototype.open;
        xhr.open = function (...args) {
          requestMethod = args[0] ? String(args[0]) : "GET";
          requestUrl = typeof args[1] === "string" ? args[1] : "";
          return originalOpen.apply(xhr, args);
        };
        const originalSetRequestHeader = OriginalXHR.prototype.setRequestHeader;
        xhr.setRequestHeader = function (...args) {
          if (args[0]) {
            requestHeaders[String(args[0])] = args[1];
          }
          return originalSetRequestHeader.apply(xhr, args);
        };
        const originalSend = OriginalXHR.prototype.send;
        xhr.send = function (...args) {
          recordRequest(requestUrl, {
            method: requestMethod,
            headers: { ...requestHeaders },
            body: args[0] ?? null,
            credentials: "include",
            mode: "cors"
          });
          return originalSend.apply(xhr, args);
        };
        xhr.addEventListener("load", function () {
          if (!requestUrl.includes(API_HINT)) return;
          try {
            if (!xhr.responseType || xhr.responseType === "text") {
              if (!xhr.responseText) return;
              handlePayload(JSON.parse(xhr.responseText), pushOffers, "hook");
            } else if (xhr.responseType === "json") {
              if (!xhr.response) return;
              handlePayload(xhr.response, pushOffers, "hook");
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

    const provider = {
      id: "citi",
      needsManualFetch: !isAutoSendEnabled(),
      match,
      getCardLabel() {
        const last4 = getSelectedCardLast4();
        return last4 ? `Card ${last4}` : "";
      },
      start(pushOffers) {
        installFetchHook(pushOffers);
        installXhrHook(pushOffers);
        provider.needsManualFetch = !isAutoSendEnabled();
        if (settingsStore && typeof settingsStore.onChange === "function") {
          settingsStore.onChange(() => {
            provider.needsManualFetch = !isAutoSendEnabled();
          });
        }
      },
      manualFetch(pushOffers, setStatus) {
        if (!lastRequest) {
          if (setStatus) setStatus("No recent request captured yet");
          return;
        }
        const options = {
          method: lastRequest.options?.method || "GET",
          headers: { ...(lastRequest.options?.headers || {}) },
          body: lastRequest.options?.body ?? null,
          credentials: lastRequest.options?.credentials || "include",
          mode: lastRequest.options?.mode
        };
        if (setStatus) setStatus("Manual send");
        pageWindow.fetch(lastRequest.url, options)
          .then(response => response.json())
          .then(data => handlePayload(data, pushOffers, "manual"))
          .catch(() => {
            if (setStatus) setStatus("Manual send failed");
          });
      }
    };

    return provider;
  }

  if (typeof OffersCamp.registerProvider === "function") {
    OffersCamp.registerProvider(createCitiProvider());
  } else {
    OffersCamp.providers = OffersCamp.providers || [];
    OffersCamp.providers.push(createCitiProvider());
  }
})();
