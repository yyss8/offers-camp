(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};
  const utils = OffersCamp.utils || {};

  function createAmexProvider() {
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const settingsStore = OffersCamp.settings;

    function match() {
      return (
        location.host.includes("americanexpress.com") &&
        location.pathname.includes("/offers")
      );
    }

    function isAutoSendEnabled() {
      if (!settingsStore || typeof settingsStore.get !== "function") return true;
      const current = settingsStore.get();
      return current.autoSend !== false;
    }

    function getCardLast5() {
      const el = pageWindow.document?.querySelector(".simple-switcher-display-option[aria-label]");
      const label = el?.getAttribute("aria-label") || "";
      if (utils.extractLastDigits) {
        return utils.extractLastDigits(label, 5);
      }
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

    let manualInFlight = false;

    function handleOffers(data, pushOffers, source) {
      if (provider.needsManualFetch && source !== "manual") return;
      const normalized = normalizeOffers(data);
      if (!normalized.length) return;
      pushOffers("amex", normalized);
    }

    function installFetchHook(pushOffers) {
      if (utils.installFetchJsonHook) {
        utils.installFetchJsonHook(
          pageWindow,
          "__ccOffersAmexFetch",
          url => url.toLowerCase().includes("offer"),
          data => handleOffers(data, pushOffers, "hook")
        );
        return;
      }
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
          response.clone().json().then(data => handleOffers(data, pushOffers, "hook")).catch(() => {});
        }).catch(() => {});
        return fetchPromise;
      };
      pageWindow.fetch.__ccOffersHooked = true;
    }

    function installXhrHook(pushOffers) {
      if (utils.installXhrJsonHook) {
        utils.installXhrJsonHook(
          pageWindow,
          "__ccOffersAmexXhr",
          url => url && url.toLowerCase().includes("offer"),
          data => handleOffers(data, pushOffers, "hook")
        );
        return;
      }
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
              handleOffers(JSON.parse(xhr.responseText), pushOffers, "hook");
            } else if (xhr.responseType === "json") {
              if (!xhr.response) return;
              handleOffers(xhr.response, pushOffers, "hook");
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
      manualInFlight = true;
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
              handleOffers(JSON.parse(response.responseText), pushOffers, "manual");
            }
          } catch (_) {} finally {
            manualInFlight = false;
          }
        },
        onerror: () => {
          manualInFlight = false;
        }
      });
    }

    function triggerManualFetchWhenRecommendedReady(pushOffers) {
      const doc = pageWindow.document;
      if (!doc || !pageWindow.MutationObserver) return;
      const selector = '[data-testid="recommendedOffersContainer"]';
      let triggered = false;
      let observer;
      let timeoutId;

      const done = () => {
        if (observer) observer.disconnect();
        if (timeoutId) pageWindow.clearTimeout(timeoutId);
      };

      const trigger = () => {
        if (triggered) return;
        triggered = true;
        manualFetch(pushOffers, () => {});
        done();
      };

      if (doc.querySelector(selector)) {
        trigger();
        return;
      }

      observer = new pageWindow.MutationObserver(() => {
        if (doc.querySelector(selector)) {
          trigger();
        }
      });
      observer.observe(doc.documentElement || doc.body, { childList: true, subtree: true });
      timeoutId = pageWindow.setTimeout(done, 20000);
    }

    const provider = {
      id: "amex",
      needsManualFetch: !isAutoSendEnabled(),
      match,
      getCardLabel() {
        const last5 = getCardLast5();
        return last5 ? `Card ${last5}` : "";
      },
      start(pushOffers) {
        const ensureHooksInstalled = () => {
          if (provider.hooksInstalled) return;
          installFetchHook(pushOffers);
          installXhrHook(pushOffers);
          triggerManualFetchWhenRecommendedReady(pushOffers);
          provider.hooksInstalled = true;
        };
        provider.needsManualFetch = !isAutoSendEnabled();
        if (!provider.needsManualFetch) {
          ensureHooksInstalled();
        }
        if (settingsStore && typeof settingsStore.onChange === "function") {
          settingsStore.onChange(() => {
            provider.needsManualFetch = !isAutoSendEnabled();
            if (!provider.needsManualFetch) {
              ensureHooksInstalled();
            }
          });
        }
      },
      manualFetch(pushOffers, setStatus) {
        manualFetch(pushOffers, setStatus);
      }
    };

    return provider;
  }

  if (typeof OffersCamp.registerProvider === "function") {
    OffersCamp.registerProvider(createAmexProvider());
  } else {
    OffersCamp.providers = OffersCamp.providers || [];
    OffersCamp.providers.push(createAmexProvider());
  }
})();
