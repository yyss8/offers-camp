(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};
  const utils = OffersCamp.utils || {};

  function createChaseProvider() {
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const API_HINT = "/customer-offers";
    const DEFAULT_OFFERS_URL =
      "https://secure.chase.com/svc/wr/profile/secure/gateway/ccb/marketing/offer-management/digital-customer-targeted-offers/v2/customer-offers" +
      "?offer-count=&offerStatusNameList=NEW,ACTIVATED,SERVED&source-application-system-name=CHASE_WEB" +
      "&source-request-component-name=OFFERS_HUB_CAROUSELS&is-include-summary=true";
    const settingsStore = OffersCamp.settings;
    let lastRequest = null;

    function match() {
      if (!location.host.includes("secure.chase.com")) {
        return false;
      }
      if (location.pathname.includes("/merchantOffers/offer-hub")) {
        return true;
      }
      return location.hash.includes("/merchantOffers/offer-hub");
    }

    function getSelectedCardNum() {
      const host = pageWindow.document?.querySelector("#select-credit-card-account");
      const root = host && host.shadowRoot ? host.shadowRoot : null;
      const el = root
        ? root.querySelector("#select-select-credit-card-account span")
        : pageWindow.document?.querySelector("#select-select-credit-card-account span");
      const label = el?.textContent || "";
      const matchValue = label.match(/\(\.\.\.(\d{4})\)/);
      return matchValue ? matchValue[1] : extractCardNum(label);
    }

    function getSelectedCardLabel() {
      const host = pageWindow.document?.querySelector("#select-credit-card-account");
      const root = host && host.shadowRoot ? host.shadowRoot : null;
      const el = root
        ? root.querySelector("#select-select-credit-card-account span")
        : pageWindow.document?.querySelector("#select-select-credit-card-account span");
      const label = (el?.textContent || "").trim();
      if (!label) return "";
      return label.replace(/\s*\(\.\.\.\d{4}\)\s*/g, "").trim();
    }

    function isAutoSendEnabled() {
      if (!settingsStore || typeof settingsStore.get !== "function") return true;
      const current = settingsStore.get();
      return current.autoSend !== false;
    }

    function extractCardNum(value) {
      if (!value) return "";
      if (utils.extractLastDigits) {
        return utils.extractLastDigits(String(value), 4);
      }
      const digits = String(value).replace(/\D/g, "");
      if (digits.length < 4) return "";
      return digits.slice(-4);
    }

    function getGroupCardNum(group) {
      if (!group) return "";
      const candidates = [
        group.accountNumberSuffix,
        group.accountNumberLastFour,
        group.accountLastFour,
        group.lastFourAccountNumber,
        group.accountNumber,
        group.digitalAccountIdentifier,
        group.primaryDigitalAccountIdentifier,
        group.accountIdentifier,
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
        offer.creditCardAccountNumber,
        offer.accountNumber
      ];
      for (const value of candidates) {
        const cardNum = extractCardNum(value);
        if (cardNum) return cardNum;
      }
      return "";
    }

    function normalizeOffers(payload, cardInfo) {
      const groups = Array.isArray(payload?.customerOffers) ? payload.customerOffers : [];
      const selectedCardNum = cardInfo?.cardNum || getSelectedCardNum();
      const selectedLabel = cardInfo?.cardLabel || getSelectedCardLabel();
      const offers = groups.flatMap(group => {
        const groupCardNum = getGroupCardNum(group);
        const items = Array.isArray(group.offers) ? group.offers : [];
        return items.map(offer => ({
          offer,
          cardNum: getOfferCardNum(offer) || groupCardNum || selectedCardNum,
          cardLabel: selectedLabel
        }));
      });
      if (!offers.length) return [];

      return offers
        .map(entry => ({
          source: "chase",
          id: entry.offer.offerIdentifier,
          title:
            entry.offer.merchantDetails?.merchantName ||
            entry.offer.offerDisplayDetails?.offerHeaderText ||
            "Chase Offer",
          summary:
            entry.offer.offerDisplayDetails?.rewardDescriptionText ||
            entry.offer.offerDisplayDetails?.shortMessageText ||
            "",
          expires: utils.formatExpiry
            ? utils.formatExpiry(entry.offer.offerDetails?.offerEndTimestamp || "")
            : entry.offer.offerDetails?.offerEndTimestamp || "",
          categories: Array.isArray(entry.offer.offerCategories)
            ? entry.offer.offerCategories.map(category => category.offerCategoryName).filter(Boolean)
            : [],
          enrolled: entry.offer.offerStatusName === "ACTIVATED",
          sourceUrl: location.href,
          collectedAt: utils.nowIso ? utils.nowIso() : new Date().toISOString(),
          image:
            entry.offer.offerDisplayDetails?.images?.heroImage?.imageLinkUrlText ||
            entry.offer.offerDisplayDetails?.images?.logo?.imageLinkUrlText ||
            "",
          channels: Array.isArray(entry.offer.offerDisplayDetails?.locationRestrictions)
            ? entry.offer.offerDisplayDetails.locationRestrictions
                .map(item => item.locationName)
                .filter(Boolean)
            : [],
          cardNum: entry.cardNum,
          cardLabel: entry.cardLabel
        }))
        .filter(item => item.id && item.expires);
    }

    function recordRequest(url, options) {
      if (!url || !url.includes(API_HINT)) return;
      lastRequest = { url, options };
    }

    function parseIdList(text, key) {
      if (!text || !key) return [];
      const matchValue = text.match(new RegExp(`${key}["']?\\s*:\\s*\\[([^\\]]+)\\]`));
      if (!matchValue) return [];
      const ids = matchValue[1].match(/\d+/g);
      return ids ? Array.from(new Set(ids)) : [];
    }

    function parsePathParamsFromText(text) {
      if (!text) return null;
      const enterpriseMatch = text.match(/enterprisePartyIdentifier["']?\s*:\s*["'](\d+)["']/);
      if (!enterpriseMatch) return null;
      const digitalList = parseIdList(text, "digitalAccountIdentifierList");
      const primaryList = parseIdList(text, "primaryDigitalAccountIdentifierList");
      return {
        enterprisePartyIdentifier: enterpriseMatch[1],
        digitalAccountIdentifierList: digitalList,
        primaryDigitalAccountIdentifierList: primaryList.length ? primaryList : digitalList
      };
    }

    function findPathParamsFromStorage(storage) {
      if (!storage || !storage.length) return null;
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key) continue;
        const rawValue = storage.getItem(key);
        if (!rawValue || !rawValue.includes("enterprisePartyIdentifier")) continue;
        const parsed = parsePathParamsFromText(rawValue);
        if (parsed && parsed.enterprisePartyIdentifier) return parsed;
      }
      return null;
    }

    function findPathParamsFromScripts() {
      const scripts = pageWindow.document?.scripts || [];
      for (const script of scripts) {
        const text = script?.textContent || "";
        if (!text.includes("enterprisePartyIdentifier")) continue;
        const parsed = parsePathParamsFromText(text);
        if (parsed && parsed.enterprisePartyIdentifier) return parsed;
      }
      return null;
    }

    function getPathParamsFromPage() {
      const fromScripts = findPathParamsFromScripts();
      if (fromScripts) return fromScripts;
      const fromSession = findPathParamsFromStorage(pageWindow.sessionStorage);
      if (fromSession) return fromSession;
      const fromLocal = findPathParamsFromStorage(pageWindow.localStorage);
      if (fromLocal) return fromLocal;
      return null;
    }

    function buildFallbackRequest() {
      const pathParams = getPathParamsFromPage();
      if (!pathParams || !pathParams.enterprisePartyIdentifier) return null;
      const headers = {
        accept: "application/json, text/plain, */*",
        "channel-identifier": "C30",
        "channel-type": "WEB",
        "path-params": JSON.stringify(pathParams),
        "x-jpmc-channel": "id=C30",
        "x-jpmc-csrf-token": "NONE"
      };
      return {
        url: DEFAULT_OFFERS_URL,
        options: {
          method: "GET",
          headers,
          body: null,
          credentials: "include",
          mode: "cors"
        }
      };
    }

    function handlePayload(payload, pushOffers, source, cardInfo) {
      if (provider.needsManualFetch && source !== "manual") return;
      const normalized = normalizeOffers(payload, cardInfo);
      if (!normalized.length) return;
      if (source === "manual") {
        const selectedCardNum = cardInfo?.cardNum || getSelectedCardNum();
        if (selectedCardNum) {
          const filtered = normalized
            .filter(item => {
              const itemCardNum = extractCardNum(item.cardNum);
              return itemCardNum && itemCardNum === selectedCardNum;
            })
            .map(item => ({ ...item, cardNum: selectedCardNum }));
          if (filtered.length) {
            pushOffers("chase", filtered);
            return;
          }
          const forced = normalized.map(item => ({ ...item, cardNum: selectedCardNum }));
          pushOffers("chase", forced);
          return;
        }
      }
      if (!normalized.some(item => !item.cardNum)) {
        pushOffers("chase", normalized);
        return;
      }
      const waitForCard = utils.waitForValue || waitForCardNum;
      waitForCard(getSelectedCardNum, cardNum => {
        const filled = cardNum
          ? normalized.map(item => (item.cardNum ? item : { ...item, cardNum }))
          : normalized;
        pushOffers("chase", filled);
      });
    }

    function waitForCardNum(onReady, attempts = 10) {
      const cardNum = getSelectedCardNum();
      if (cardNum || attempts <= 0) {
        onReady(cardNum);
        return;
      }
      pageWindow.setTimeout(() => {
        waitForCardNum(onReady, attempts - 1);
      }, 500);
    }

    function installFetchHook(pushOffers) {
      if (!pageWindow.fetch || pageWindow.fetch.__ccOffersChaseHooked) return;
      const originalFetch = pageWindow.fetch;
      pageWindow.fetch = function (...args) {
        const requestUrl =
          typeof args[0] === "string"
            ? args[0]
            : args[0]?.url || "";
        const requestInit = args[1] || {};
        const headers = {
          ...(utils.cloneHeaders ? utils.cloneHeaders(args[0]?.headers) : {}),
          ...(utils.cloneHeaders ? utils.cloneHeaders(requestInit.headers) : {})
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
      pageWindow.fetch.__ccOffersChaseHooked = true;
    }

    function installXhrHook(pushOffers) {
      if (!pageWindow.XMLHttpRequest || pageWindow.XMLHttpRequest.__ccOffersChaseHooked) return;
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
      PatchedXHR.__ccOffersChaseHooked = true;
      pageWindow.XMLHttpRequest = PatchedXHR;
    }

    function parseCardInfoFromLabel(label) {
      const text = (label || "").trim();
      if (!text) return { cardNum: "", cardLabel: "" };
      const cardLabelMatch = text.match(/^(.+?)(?:\s*\(\.\.\.\d{4}\)\s*|\s*-\s*\d{4}\s*|$)/);
      const cardLabel = cardLabelMatch ? cardLabelMatch[1].trim() : text;
      if (utils.extractLastDigits) {
        return {
          cardNum: utils.extractLastDigits(text, 4),
          cardLabel
        };
      }
      const digits = text.replace(/\D/g, "");
      return {
        cardNum: digits ? digits.slice(-4) : "",
        cardLabel
      };
    }

    function collectAccountOptions() {
      const doc = pageWindow.document;
      if (!doc) return [];
      const elements = Array.from(doc.querySelectorAll(".mds-select-option--bcb"));
      const seen = new Set();
      return elements
        .map(el => {
          const primaryDigitalAccountIdentifier = el.getAttribute("value") || "";
          const label = el.getAttribute("label") || el.getAttribute("aria-label") || "";
          const { cardNum, cardLabel } = parseCardInfoFromLabel(label);
          if (!primaryDigitalAccountIdentifier || seen.has(primaryDigitalAccountIdentifier)) return null;
          seen.add(primaryDigitalAccountIdentifier);
          return {
            primaryDigitalAccountIdentifier,
            cardNum,
            cardLabel
          };
        })
        .filter(Boolean);
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
        } else {
          await new Promise(resolve => pageWindow.setTimeout(resolve, 200));
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
        const listSelector = ".mds-select-option--bcb";
        const listReady = pageWindow.document?.querySelector(listSelector);
        if (!listReady) {
          if (utils.waitForElement) {
            await utils.waitForElement(listSelector, 10000, pageWindow);
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
          } else {
            await new Promise(resolve => pageWindow.setTimeout(resolve, 500));
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
      id: "chase",
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
          const requestInfo = lastRequest
            ? {
                url: lastRequest.url,
                options: {
                  method: lastRequest.options?.method || "GET",
                  headers: { ...(lastRequest.options?.headers || {}) },
                  body: lastRequest.options?.body ?? null,
                  credentials: lastRequest.options?.credentials || "include",
                  mode: lastRequest.options?.mode
                }
              }
            : buildFallbackRequest();
          if (!requestInfo) {
            if (setStatus) setStatus("Manual send failed: missing request data");
            resolve(false);
            return;
          }
          if (cardInfo?.primaryDigitalAccountIdentifier) {
            const headers = requestInfo.options.headers || {};
            const headerKey = Object.keys(headers).find(key => key.toLowerCase() === "path-params") || "path-params";
            let pathParams = null;
            const rawPathParams = headers[headerKey];
            if (rawPathParams) {
              try {
                pathParams = typeof rawPathParams === "string" ? JSON.parse(rawPathParams) : rawPathParams;
              } catch (_) {
                pathParams = parsePathParamsFromText(String(rawPathParams));
              }
            }
            if (!pathParams) {
              pathParams = getPathParamsFromPage();
            }
            if (pathParams) {
              pathParams.digitalAccountIdentifierList = [cardInfo.primaryDigitalAccountIdentifier];
              pathParams.primaryDigitalAccountIdentifierList = [cardInfo.primaryDigitalAccountIdentifier];
              headers[headerKey] = JSON.stringify(pathParams);
            }
            requestInfo.options.headers = headers;
          }
          if (setStatus) setStatus("Manual send");
          pageWindow.fetch(requestInfo.url, requestInfo.options)
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
    OffersCamp.registerProvider(createChaseProvider());
  } else {
    OffersCamp.providers = OffersCamp.providers || [];
    OffersCamp.providers.push(createChaseProvider());
  }
})();
