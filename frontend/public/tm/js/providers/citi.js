(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};
  const utils = OffersCamp.utils || {};

  function createCitiProvider() {
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const API_HINT = "/merchantOffers/retrieve";
    const settingsStore = OffersCamp.settings;
    let lastRequest = null;
    let cachedCardsData = null;

    function match() {
      return (
        location.host.includes("online.citi.com") &&
        location.pathname.includes("/merchantoffers")
      );
    }

    function extractCardNum(label) {
      if (!label) return "";
      const matchValue = String(label).match(/-\s*(\d+)/);
      if (!matchValue) return "";
      return matchValue[1];
    }

    function extractCardLabel(label) {
      if (!label) return "";
      return String(label).replace(/\s*-\s*\d+.*$/, "").trim();
    }

    function getSelectedCardNum() {
      const el = pageWindow.document?.querySelector("#cds-dropdown .cds-dd2-text-nowrap");
      const label = el?.textContent || "";
      return extractCardNum(label);
    }

    function getSelectedCardLabel() {
      const el = pageWindow.document?.querySelector("#cds-dropdown .cds-dd2-text-nowrap");
      const label = el?.textContent || "";
      return extractCardLabel(label);
    }

    function getPrimaryCardNum(payload) {
      const cards = Array.isArray(payload?.cardArtDetails) ? payload.cardArtDetails : [];
      const primary = cards[0];
      if (!primary) return "";
      return extractCardNum(primary.displayProductName || "");
    }

    function getPrimaryCardLabel(payload) {
      const cards = Array.isArray(payload?.cardArtDetails) ? payload.cardArtDetails : [];
      const primary = cards[0];
      if (!primary) return "";
      return extractCardLabel(primary.displayProductName || "");
    }

    function extractAllCardsFromPayload(payload) {
      const cards = Array.isArray(payload?.cardArtDetails) ? payload.cardArtDetails : [];
      return cards
        .map((card, index) => {
          const label = card.displayProductName || "";
          const accountId = card.accountId || card.cardAccountId || String(index);
          return {
            accountId,
            cardNum: extractCardNum(label),
            cardLabel: extractCardLabel(label)
          };
        })
        .filter(item => item.cardNum && item.accountId);
    }

    function isAutoSendEnabled() {
      if (!settingsStore || typeof settingsStore.get !== "function") return true;
      const current = settingsStore.get();
      return current.autoSend !== false;
    }

    function getGroupCardNum(group) {
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
        const cardNum = extractCardNum(value);
        if (cardNum) return cardNum;
      }
      return "";
    }

    function getOfferCardNum(offer) {
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
        const cardNum = extractCardNum(value);
        if (cardNum) return cardNum;
      }
      return "";
    }

    function normalizeOffers(payload, cardInfo) {
      const groups = Array.isArray(payload?.merchantOffers) ? payload.merchantOffers : [];
      if (!groups.length) return [];
      const selectedCardNum = getSelectedCardNum();
      const primaryCardNum = getPrimaryCardNum(payload);
      const selectedLabel = getSelectedCardLabel();
      const primaryLabel = getPrimaryCardLabel(payload);
      const fallbackLabel = selectedLabel || primaryLabel;
      const offers = groups.flatMap(group => {
        const groupCardNum = getGroupCardNum(group);
        const items = Array.isArray(group.offers) ? group.offers : [];
        return items.map(offer => ({
          offer,
          cardNum: cardInfo?.cardNum || getOfferCardNum(offer) || groupCardNum || selectedCardNum || primaryCardNum,
          cardLabel: cardInfo?.cardLabel || fallbackLabel
        }));
      });
      if (!offers.length) return [];
      return offers
        .map(entry => ({
          source: "citi",
          id: entry.offer.offerId,
          title: entry.offer.merchantName || entry.offer.offerTitle || "Citi Offer",
          summary: entry.offer.offerTitle || entry.offer.merchantName || "",
          expires: utils.formatExpiry ? utils.formatExpiry(entry.offer.offerEndDate || "") : "",
          categories: entry.offer.merchantCategory ? [entry.offer.merchantCategory] : [],
          enrolled: entry.offer.offerStatus === "ENROLLED",
          sourceUrl: location.href,
          collectedAt: utils.nowIso ? utils.nowIso() : new Date().toISOString(),
          image: entry.offer.merchantImageURL || entry.offer.merchantBannerImageUrl || "",
          channels: utils.parseChannels ? utils.parseChannels(entry.offer.redemptionType) : [],
          cardNum: entry.cardNum,
          cardLabel: entry.cardLabel
        }))
        .filter(item => item.id && item.expires);
    }

    function recordRequest(url, options) {
      if (!url || !url.includes(API_HINT)) return;
      lastRequest = { url, options };
    }

    function handlePayload(payload, pushOffers, source, cardInfo) {
      if (provider.needsManualFetch && source !== "manual") return;
      const normalized = normalizeOffers(payload, cardInfo);
      if (!normalized.length) return;
      if (source === "manual") {
        const selectedCardNum = cardInfo?.cardNum || getSelectedCardNum();
        if (selectedCardNum) {
          const filtered = normalized
            .filter(item => !item.cardNum || item.cardNum === selectedCardNum)
            .map(item => (item.cardNum ? item : { ...item, cardNum: selectedCardNum }));
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
        const headers = utils.cloneHeaders
          ? utils.cloneHeaders(args[0]?.headers, requestInit.headers)
          : {};
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
          response.clone().json().then(data => {
            cachedCardsData = extractAllCardsFromPayload(data);
            handlePayload(data, pushOffers, "hook");
          }).catch(() => { });
        }).catch(() => { });
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
              const data = JSON.parse(xhr.responseText);
              cachedCardsData = extractAllCardsFromPayload(data);
              handlePayload(data, pushOffers, "hook");
            } else if (xhr.responseType === "json") {
              if (!xhr.response) return;
              cachedCardsData = extractAllCardsFromPayload(xhr.response);
              handlePayload(xhr.response, pushOffers, "hook");
            }
          } catch (_) { }
        });
        return xhr;
      }
      PatchedXHR.prototype = OriginalXHR.prototype;
      Object.assign(PatchedXHR, OriginalXHR);
      PatchedXHR.__ccOffersCitiHooked = true;
      pageWindow.XMLHttpRequest = PatchedXHR;
    }


    function extractAccountIdFromOptionId(id) {
      if (!id) return "";
      const value = String(id);
      const prefix = "mo-card-selector-option-";
      if (!value.startsWith(prefix)) return "";
      return value.slice(prefix.length);
    }

    function collectAccountOptions() {
      // Try to use cached cards data from API first
      if (cachedCardsData && cachedCardsData.length > 0) {
        return cachedCardsData;
      }

      // Fallback to HTML parsing
      const doc = pageWindow.document;
      if (!doc) return [];
      const listBox = doc.querySelector("#cds-dropdown-listbox");
      if (!listBox) return [];
      const options = Array.from(listBox.querySelectorAll('li[role="option"]')).filter(el => {
        if (el.classList.contains("cds-option2-disabled")) return false;
        if (el.classList.contains("cds-menu-item-disabled")) return false;
        const ariaDisabled = el.getAttribute("aria-disabled");
        return ariaDisabled !== "true";
      });
      return options.map(el => {
        const label = (el.getAttribute("aria-label") || "").replace(/\u00a0/g, " ");
        const accountId = extractAccountIdFromOptionId(el.getAttribute("id"));
        return {
          accountId,
          cardNum: extractCardNum(label),
          cardLabel: extractCardLabel(label)
        };
      }).filter(item => item.accountId);
    }

    async function collectAccountOptionsWithRetry() {
      let best = [];
      let lastCount = -1;
      let stableCount = 0;
      const start = Date.now();
      while (Date.now() - start < 2500) {
        const current = collectAccountOptions();
        if (current.length > lastCount) {
          best = current;
          lastCount = current.length;
          stableCount = 0;
        } else {
          stableCount += 1;
          if (stableCount >= 2) break;
        }
        if (utils.sleep) {
          await utils.sleep(200, pageWindow);
        }
      }
      return best;
    }

    let sendAllInFlight = false;

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
      const modal = utils.createSendAllModal ? utils.createSendAllModal(pageWindow) : null;
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
        const listBox = pageWindow.document?.querySelector("#cds-dropdown-listbox");
        if (!listBox) {
          if (utils.waitForElement) {
            await utils.waitForElement("#cds-dropdown-listbox", 10000, pageWindow);
          }
        }

        modal.setStatus("Scanning cards...");
        const options = await collectAccountOptionsWithRetry();
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
          await provider.manualFetch(pushOffers, setStatus, cardInfo);
          completed += 1;
          modal.setProgress((completed / total) * 100);
          if (stopRequested) break;
          if (utils.sleep) {
            await utils.sleep(500, pageWindow);
          }
        }

        if (stopRequested) {
          return;
        }
        modal.remove();
        pageWindow.alert(`Sent offers for ${completed} cards.`);
      } finally {
        if (stopRequested && modal) {
          modal.remove();
        }
        sendAllInFlight = false;
        if (typeof onDone === "function") onDone();
      }
    }

    const provider = {
      id: "citi",
      needsManualFetch: !isAutoSendEnabled(),
      supportsSendAll: true,
      match,
      getCardLabel() {
        const cardLabel = getSelectedCardLabel();
        if (cardLabel) return cardLabel;
        const cardNum = getSelectedCardNum();
        return cardNum ? `Card ${cardNum}` : "";
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
      manualFetch(pushOffers, setStatus, cardInfo) {
        return new Promise(resolve => {
          if (!lastRequest) {
            if (setStatus) setStatus("No recent request captured yet");
            resolve(false);
            return;
          }
          const options = {
            method: lastRequest.options?.method || "GET",
            headers: { ...(lastRequest.options?.headers || {}) },
            body: lastRequest.options?.body ?? null,
            credentials: lastRequest.options?.credentials || "include",
            mode: lastRequest.options?.mode
          };
          if (cardInfo?.accountId) {
            try {
              const rawBody = options.body;
              const parsedBody =
                typeof rawBody === "string" && rawBody.trim()
                  ? JSON.parse(rawBody)
                  : (rawBody && typeof rawBody === "object" ? { ...rawBody } : {});
              parsedBody.accountId = cardInfo.accountId;
              options.body = JSON.stringify(parsedBody);
            } catch (_) { }
          }
          if (setStatus) setStatus("Manual send");
          pageWindow.fetch(lastRequest.url, options)
            .then(response => response.json())
            .then(data => {
              handlePayload(data, pushOffers, "manual", cardInfo);
              resolve(true);
            })
            .catch(() => {
              if (setStatus) setStatus("Manual send failed");
              resolve(false);
            });
        });
      },
      sendAll(pushOffers, setStatus, onDone) {
        sendAll(pushOffers, setStatus, onDone);
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
