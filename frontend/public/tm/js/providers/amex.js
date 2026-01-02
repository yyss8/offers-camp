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

    function getCardNum() {
      const el = pageWindow.document?.querySelector(".simple-switcher-display-option[aria-label]");
      const label = el?.getAttribute("aria-label") || "";
      if (utils.extractLastDigits) {
        return utils.extractLastDigits(label, 5);
      }
      const digits = label.replace(/\D/g, "");
      if (!digits) return "";
      return digits.slice(-5);
    }

    function getCardLabelFromAria() {
      const el = pageWindow.document?.querySelector(".simple-switcher-display-option[aria-label]");
      const label = (el?.getAttribute("aria-label") || "").trim();
      if (!label) return "";
      const match = label.match(/^(.+?)(?:\s+ending\s+in\b|\s*\(|\s*-\s*\d|$)/i);
      return match ? match[1].trim() : label;
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

    function normalizeOffers(data, cardInfo) {
      const sources = [
        data?.recommendedOffers?.offersList?.page1,
        data?.offers,
        data?.addedToCard?.offersList?.page1,
        data?.enrolledOffers?.offersList?.page1
      ];

      const flattened = sources.filter(Array.isArray).flat();
      if (!flattened.length) return [];
      const cardNum = cardInfo?.cardNum || getCardNum();
      const cardLabel = cardInfo?.cardLabel || getCardLabelFromAria();

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
          cardNum,
          cardLabel
        }))
        .filter(o => o.id && o.expires);
    }

    let manualInFlight = false;

    function handleOffers(data, pushOffers, source, cardInfo) {
      if (provider.needsManualFetch && source !== "manual") return;
      const normalized = normalizeOffers(data, cardInfo);
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

    function manualFetch(pushOffers, setStatus, cardInfo) {
      return new Promise(resolve => {
        const accountNumberProxy = cardInfo?.accountNumberProxy || getAccountNumberProxyFromLink();
        if (!accountNumberProxy) {
          if (typeof setStatus === "function") {
            setStatus("Missing account id");
          }
          resolve(false);
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
                handleOffers(JSON.parse(response.responseText), pushOffers, "manual", cardInfo);
              }
            } catch (_) {} finally {
              manualInFlight = false;
              resolve(true);
            }
          },
          onerror: () => {
            manualInFlight = false;
            resolve(false);
          }
        });
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

    let sendAllInFlight = false;

    function extractAccountNumberProxyFromOptionId(id) {
      if (!id) return "";
      const match = id.match(/^combo-([A-Za-z0-9]+)$/);
      return match ? match[1] : "";
    }

    function parseCardInfoFromLabel(label) {
      const text = (label || "").trim();
      if (!text) return { cardNum: "", cardLabel: "" };
      const cardLabelMatch = text.match(/^(.+?)(?:\s+ending\s+in\b|\s*\(|\s*-\s*\d|$)/i);
      const cardLabel = cardLabelMatch ? cardLabelMatch[1].trim() : text;
      return {
        cardNum: utils.extractLastDigits(text, 5),
        cardLabel
      };
    }

    function collectAccountOptions() {
      const doc = pageWindow.document;
      if (!doc) return [];
      const group = doc.querySelector('[data-testid="simple_switcher_list_options_product_group"]');
      if (!group) return [];
      const elements = Array.from(group.children).filter(el =>
        el.classList.contains("option-current") ||
        el.classList.contains("simple-switcher-list-option")
      );
      return elements.map(el => {
        const accountNumberProxy = extractAccountNumberProxyFromOptionId(el.getAttribute("id"));
        const ariaText = el.getAttribute("aria-label");
        const labelText = (ariaText || el.textContent || "").replace(/\s+/g, " ").trim();
        const { cardNum, cardLabel } = parseCardInfoFromLabel(labelText);
        return {
          accountNumberProxy,
          cardNum,
          cardLabel
        };
      }).filter(item => item.accountNumberProxy);
    }


    async function sendAll(pushOffers, setStatus, onDone) {
      if (sendAllInFlight) {
        if (typeof onDone === "function") onDone();
        return;
      }
      if (!pageWindow.confirm("Send offers for all cards?")) {
        if (typeof onDone === "function") onDone();
        return;
      }
      sendAllInFlight = true;
      let stopRequested = false;
      let openedList = false;
      const modal = utils.createSendAllModal(pageWindow);
      if (!modal) {
        sendAllInFlight = false;
        if (typeof onDone === "function") onDone();
        return;
      }
      modal.stopBtn.addEventListener("click", () => {
        stopRequested = true;
        modal.stopBtn.disabled = true;
        modal.setStatus("Stopping...");
      });

      try {
        const doc = pageWindow.document;
        const listSelector = '[data-testid="simple_switcher_list_options_product_group"]';
        let listGroup = doc?.querySelector(listSelector);
        const combo = doc?.querySelector("#simple-switcher-wrapper .simple-switcher-combobox-input");
        if (!listGroup && combo) {
          combo.click();
          openedList = true;
          listGroup = await utils.waitForElement(listSelector, 10000, pageWindow);
        }

        const options = collectAccountOptions();
        if (!options.length) {
          modal.setProgress(100);
          modal.setStatus("No cards found.");
          modal.remove();
          pageWindow.alert("Sent offers for 0 cards.");
          return;
        }

        let completed = 0;
        const total = options.length;
        for (let i = 0; i < options.length; i += 1) {
          if (stopRequested) break;
          const cardInfo = options[i];
          modal.setStatus(`Sending ${i + 1} of ${total}`);
          await manualFetch(pushOffers, setStatus, cardInfo);
          completed += 1;
          modal.setProgress((completed / total) * 100);
          if (stopRequested) break;
          await utils.sleep(500, pageWindow);
        }

        if (stopRequested) {
          return;
        }
        modal.remove();
        pageWindow.alert(`Sent offers for ${completed} cards.`);
      } finally {
        if (openedList) {
          const combo = pageWindow.document?.querySelector("#simple-switcher-wrapper .simple-switcher-combobox-input");
          if (combo) combo.click();
        }
        if (stopRequested && modal) {
          modal.remove();
        }
        sendAllInFlight = false;
        if (typeof onDone === "function") onDone();
      }
    }

    const provider = {
      id: "amex",
      needsManualFetch: !isAutoSendEnabled(),
      supportsSendAll: true,
      match,
      getCardLabel() {
        const cardLabel = getCardLabelFromAria();
        if (cardLabel) return cardLabel;
        const cardNum = getCardNum();
        return cardNum ? `Card ${cardNum}` : "";
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
      },
      sendAll(pushOffers, setStatus, onDone) {
        sendAll(pushOffers, setStatus, onDone);
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
