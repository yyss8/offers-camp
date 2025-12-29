(() => {
  const API_ENDPOINT = "http://localhost:4000/api/offers";
  const SEND_DEBOUNCE_MS = 1500;

  const state = {
    activeProvider: null,
    pending: [],
    pendingTimer: null,
    inFlight: false,
    queue: [],
    stats: {
      collected: 0,
      sent: 0
    }
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.className = "cc-offers-panel";
    panel.innerHTML = `
      <div class="cc-offers-panel__row">
        <span class="cc-offers-panel__title">Offers Camp</span>
        <button class="cc-offers-panel__close" type="button">X</button>
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__muted" data-status>
        Idle
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__muted" data-count>
        Collected: 0
      </div>
      <div class="cc-offers-panel__row">
        <span class="cc-offers-panel__bank" data-bank>Bank: -</span>
        <button class="cc-offers-panel__btn" data-send type="button">Send now</button>
      </div>
    `;
    panel.querySelector(".cc-offers-panel__close").addEventListener("click", () => {
      fadeOutPanel();
    });
    document.documentElement.appendChild(panel);
    return panel;
  }

  let panel = null;
  let statusEl = null;
  let countEl = null;
  let bankEl = null;
  let sendBtn = null;
  let panelVisible = false;
  let panelTimer = null;
  let toast = null;
  let toastTimer = null;

  function fadeOutPanel() {
    if (!panel || !panelVisible) return;
    panel.style.opacity = "0";
    if (panelTimer) {
      clearTimeout(panelTimer);
      panelTimer = null;
    }
    setTimeout(() => {
      if (panel && panel.parentNode) {
        panel.remove();
      }
      panel = null;
      panelVisible = false;
      statusEl = null;
      countEl = null;
      bankEl = null;
      sendBtn = null;
    }, 700);
  }

  function ensurePanel() {
    if (panelVisible) return;
    panel = createPanel();
    panel.classList.add("cc-offers-panel--compact");
    statusEl = panel.querySelector("[data-status]");
    countEl = panel.querySelector("[data-count]");
    bankEl = panel.querySelector("[data-bank]");
    sendBtn = panel.querySelector("[data-send]");
    panelVisible = true;
    panelTimer = setTimeout(() => {
      fadeOutPanel();
    }, 15000);
  }

  function updateUI() {
    if (!panelVisible) return;
    const bank = state.activeProvider ? state.activeProvider.id : "-";
    bankEl.textContent = `Bank: ${bank}`;
    countEl.textContent = `Collected: ${state.stats.collected}`;
  }

  function setStatus(text) {
    if (!panelVisible) return;
    statusEl.textContent = text;
  }

  function pushOffers(providerId, offers) {
    if (!offers.length) return;
    const unique = new Map();
    offers.forEach(offer => {
      const key = `${providerId}:${offer.id}:${offer.cardLast5 || ""}`;
      if (!unique.has(key)) {
        unique.set(key, offer);
      }
    });
    const batch = Array.from(unique.values());
    if (!batch.length) return;
    state.stats.collected += batch.length;
    state.pending.push(...batch);
    updateUI();
    scheduleSend();
    if (panelVisible) {
      fadeOutPanel();
    }
  }

  function scheduleSend() {
    setStatus("Queued");
    showToast(state.pending.length, "queued");
    if (state.pendingTimer) {
      clearTimeout(state.pendingTimer);
    }
    state.pendingTimer = setTimeout(() => {
      const batch = state.pending.slice();
      state.pending = [];
      enqueueSend(batch);
    }, SEND_DEBOUNCE_MS);
  }

  function enqueueSend(batch) {
    if (!batch.length) return;
    state.queue.push(batch);
    processQueue();
  }

  function processQueue() {
    if (state.inFlight || state.queue.length === 0) return;
    const batch = state.queue.shift();
    if (!batch) return;
    state.inFlight = true;
    setStatus(`Sending ${batch.length}...`);
    GM_xmlhttpRequest({
      method: "POST",
      url: API_ENDPOINT,
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ offers: batch }),
      onload: () => {
        state.inFlight = false;
        state.stats.sent += batch.length;
        setStatus(`Sent ${batch.length}`);
        showToast(batch.length, "sent");
        processQueue();
      },
      onerror: () => {
        state.inFlight = false;
        setStatus("Send failed");
        processQueue();
      }
    });
  }

  function showToast(count, label = "sent") {
    if (toast) {
      toast.remove();
      toast = null;
    }
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    const next = document.createElement("div");
    next.className = "cc-offers-toast";
    const cardLabel = state.activeProvider && state.activeProvider.getCardLabel
      ? state.activeProvider.getCardLabel()
      : "";
    const icon =
      label === "queued"
        ? '<span class="cc-offers-toast__icon cc-offers-toast__spinner"></span>'
        : '<span class="cc-offers-toast__icon cc-offers-toast__check"></span>';
    const suffix = cardLabel ? ` - ${cardLabel}` : "";
    next.innerHTML = `
      ${icon}
      <span>${count} offers ${label}${suffix}</span>
      <button class="cc-offers-toast__close" type="button">X</button>
    `;
    next.querySelector(".cc-offers-toast__close").addEventListener("click", () => {
      fadeOutToast();
    });
    document.documentElement.appendChild(next);
    toast = next;
    toastTimer = setTimeout(() => {
      fadeOutToast();
    }, 3000);
  }

  function fadeOutToast() {
    if (!toast) return;
    toast.style.opacity = "0";
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.remove();
      }
      toast = null;
    }, 700);
  }

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
      const matchValue = label.match(/ending in\\s*([0-9]{4,6})/i);
      const digits = matchValue ? matchValue[1] : label.replace(/\\D/g, "");
      if (!digits) return "";
      return digits.length >= 5 ? digits.slice(-5) : digits;
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
          collectedAt: nowIso(),
          image: o.image,
          channels: (o.applicableFilters || []).map(f => f.optionType),
          cardLast5
        }))
        .filter(o => o.id && o.expires);
    }

    function handleOffers(data) {
      const normalized = normalizeOffers(data);
      if (!normalized.length) return;
      pushOffers("amex", normalized);
    }

    function installFetchHook() {
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
          response.clone().json().then(handleOffers).catch(() => {});
        }).catch(() => {});
        return fetchPromise;
      };
      pageWindow.fetch.__ccOffersHooked = true;
    }

    function installXhrHook() {
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
              handleOffers(JSON.parse(xhr.responseText));
            } else if (xhr.responseType === "json") {
              if (!xhr.response) return;
              handleOffers(xhr.response);
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

    function manualFetch() {
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
              handleOffers(JSON.parse(response.responseText));
            }
          } catch (_) {}
        }
      });
    }

    return {
      id: "amex",
      match,
      getCardLabel() {
        const last5 = getCardLast5();
        return last5 ? `Card ${last5}` : "";
      },
      start() {
        installFetchHook();
        installXhrHook();
      },
      manualFetch
    };
  }

  const providers = [createAmexProvider()];

  function start() {
    const provider = providers.find(p => p.match());
    if (!provider) {
      return;
    }
    state.activeProvider = provider;
    ensurePanel();
    updateUI();
    provider.start();
    setStatus("Ready");
    sendBtn.onclick = () => {
      provider.manualFetch();
      setStatus("Manual send");
      fadeOutPanel();
    };
  }

  start();
})();
