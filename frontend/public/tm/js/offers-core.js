(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};
  const auth = OffersCamp.auth;

  const config = window.OffersCampConfig || {};
  const appBase = config.appBase || "http://localhost:5173";
  const apiBase = config.apiBase || "http://localhost:4000";
  const DEFAULT_LOCAL_API = "localhost:4000";
  const SEND_DEBOUNCE_MS = 300;
  const LOGIN_URL = `${appBase}/?tm=1&tmOrigin=${encodeURIComponent(window.location.origin)}`;
  const settingsStore = OffersCamp.settings;
  const SEND_BUTTON_LABEL = "Send now";
  const SEND_BUTTON_LOADING_LABEL = "Sending...";
  const SEND_ALL_BUTTON_LABEL = "Send All";
  const SEND_ALL_BUTTON_LOADING_LABEL = "Sending all...";
  const AUTH_DISABLED_STATUS = "Ready";
  const REDIRECT_ROUTES = [
    {
      id: "amex",
      origin: "https://global.americanexpress.com",
      path: "/dashboard",
      offersUrl: "https://global.americanexpress.com/offers"
    },
    {
      id: "chase",
      origin: "https://secure.chase.com",
      path: "/web/auth/dashboard",
      hashPrefix: "#/dashboard/overview",
      offersUrl: "https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/offer-hub"
    },
    {
      id: "citi",
      origin: "https://online.citi.com",
      path: "/US/ag/dashboard/summary",
      offersUrl: "https://online.citi.com/US/ag/products-offers/merchantoffers"
    }
  ];

  const state = {
    activeProvider: null,
    pending: new Map(),
    pendingTimer: null,
    inFlight: false,
    queue: [],
    sendGroups: new Map(),
    groupId: 0,
    forceSend: false,
    sendAllActive: false,
    manualSending: false,
    sendAllSending: false,
    manualSendTimer: null,
    providerStarted: false,
    stats: {
      collected: 0,
      sent: 0
    }
  };
  let settings = settingsStore
    ? settingsStore.get()
    : { autoSend: true, providers: {}, useCloud: true, localApiBase: DEFAULT_LOCAL_API };
  let authInitialized = false;
  const panelHandlers = {
    onSend: null,
    onSendAll: null,
    onLogin: null,
    onLogout: null,
    onSettings: null
  };
  if (settingsStore && typeof settingsStore.onChange === "function") {
    settingsStore.onChange(next => {
      settings = next;
      if (state.activeProvider) {
        state.activeProvider.needsManualFetch = !settings.autoSend;
      }
      if (state.activeProvider && !isProviderEnabled(state.activeProvider.id)) {
        clearQueue();
        fadeOutPanel();
        return;
      }
      if (isCloudEnabled()) {
        initAuth();
      } else {
        authInitialized = false;
        setStatus(AUTH_DISABLED_STATUS);
        updateAuthUI();
      }
      if (state.activeProvider && !state.providerStarted) {
        state.activeProvider.start(pushOffers);
        state.providerStarted = true;
      }
      if (shouldShowPanel()) {
        ensurePanel();
        updateUI();
        updateAuthUI();
        if (!settings.autoSend) {
          setStatus("Manual send required");
        }
      } else if (panelVisible) {
        fadeOutPanel();
      }
    });
  }

  OffersCamp.providers = OffersCamp.providers || [];
  OffersCamp.registerProvider = OffersCamp.registerProvider || function registerProvider(provider) {
    OffersCamp.providers.push(provider);
  };

  function normalizeApiBase(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    return `http://${trimmed}`;
  }

  function isCloudEnabled() {
    return settings.useCloud !== false;
  }

  function getApiBase() {
    if (isCloudEnabled()) return apiBase;
    const localBase = normalizeApiBase(settings.localApiBase || DEFAULT_LOCAL_API);
    return localBase || normalizeApiBase(DEFAULT_LOCAL_API);
  }

  function getApiEndpoint() {
    return `${getApiBase()}/offers`;
  }

  function getVerifyUrl() {
    return `${getApiBase()}/auth/verify`;
  }

  function isLoggedIn() {
    if (!isCloudEnabled()) return true;
    if (!auth || typeof auth.isLoggedIn !== "function") return false;
    return auth.isLoggedIn();
  }

  function initAuth() {
    if (!isCloudEnabled() || authInitialized || !auth) return;
    authInitialized = true;
    auth.init({
      loginUrl: LOGIN_URL,
      verifyUrl: getVerifyUrl(),
      onStatus: setStatus,
      onAuthChange: () => {
        if (state.activeProvider && !isProviderEnabled(state.activeProvider.id)) {
          clearQueue();
          fadeOutPanel();
          return;
        }
        updateAuthUI();
        if (isLoggedIn()) {
          if (panelVisible && !state.activeProvider.needsManualFetch) {
            fadeOutPanel();
          }
        } else {
          ensurePanel();
          updateUI();
          updateAuthUI();
        }
      },
      onTokenSaved: () => {
        if (state.activeProvider && !isProviderEnabled(state.activeProvider.id)) {
          clearQueue();
          fadeOutPanel();
          return;
        }
        updateAuthUI();
        if (panelVisible && !state.activeProvider.needsManualFetch) {
          fadeOutPanel();
        }
        if (state.pending.size) {
          scheduleSend();
        }
      }
    });
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.className = "cc-offers-panel";
    panel.innerHTML = `
      <button class="cc-offers-panel__toggle" data-toggle type="button">Offers Camp</button>
      <div class="cc-offers-panel__header">
        <div class="cc-offers-panel__title">Offers Camp</div>
        <button class="cc-offers-panel__collapse" data-collapse type="button" aria-label="Collapse">
          <span class="cc-offers-panel__caret" aria-hidden="true"></span>
        </button>
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__muted" data-status>
        Idle
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__muted" data-count>
        Detected: 0
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__muted" data-cards>
        Card: -
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__bank-row">
        <span class="cc-offers-panel__bank" data-bank>Bank: -</span>
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__actions">
        <button class="cc-offers-panel__btn" data-send type="button">Send now</button>
        <button class="cc-offers-panel__btn" data-send-all type="button">Send All</button>
        <button class="cc-offers-panel__btn" data-login type="button">Login</button>
        <button class="cc-offers-panel__btn" data-logout type="button">Logout</button>
        <button class="cc-offers-panel__btn" data-settings type="button">Settings</button>
      </div>
    `;
    document.documentElement.appendChild(panel);
    return panel;
  }

  let panel = null;
  let statusEl = null;
  let countEl = null;
  let cardsEl = null;
  let bankEl = null;
  let sendBtn = null;
  let sendAllBtn = null;
  let loginBtn = null;
  let logoutBtn = null;
  let settingsBtn = null;
  let toggleBtn = null;
  let collapseBtn = null;
  let panelCollapsed = false;
  let panelVisible = false;
  let toast = null;
  let toastTimer = null;
  let redirectPopup = null;
  let redirectVisible = false;

  function fadeOutPanel() {
    if (!panel || !panelVisible) return;
    panel.style.opacity = "0";
    setTimeout(() => {
      if (panel && panel.parentNode) {
        panel.remove();
      }
      panel = null;
      panelVisible = false;
      statusEl = null;
      countEl = null;
      cardsEl = null;
      bankEl = null;
      sendBtn = null;
      sendAllBtn = null;
      loginBtn = null;
      logoutBtn = null;
      settingsBtn = null;
      toggleBtn = null;
      collapseBtn = null;
    }, 700);
  }

  function getRedirectRoute() {
    const { origin, pathname, hash } = window.location;
    return REDIRECT_ROUTES.find(route => {
      if (route.origin !== origin) return false;
      if (route.path !== pathname) return false;
      if (route.hashPrefix && !hash.startsWith(route.hashPrefix)) return false;
      return true;
    });
  }

  function removeRedirectPopup() {
    if (!redirectPopup) return;
    redirectPopup.remove();
    redirectPopup = null;
    redirectVisible = false;
  }

  function ensureRedirectPopup() {
    const route = getRedirectRoute();
    if (!route) {
      removeRedirectPopup();
      return;
    }
    if (redirectVisible) return;
    const popup = document.createElement("div");
    popup.className = "cc-offers-redirect";
    popup.innerHTML = `
      <div class="cc-offers-redirect__title">Offers Camp</div>
      <button class="cc-offers-redirect__btn" type="button">To Offers</button>
    `;
    const button = popup.querySelector(".cc-offers-redirect__btn");
    button.addEventListener("click", () => {
      window.location.href = route.offersUrl;
    });
    document.documentElement.appendChild(popup);
    redirectPopup = popup;
    redirectVisible = true;
  }

  function isProviderEnabled(providerId) {
    if (!providerId) return true;
    const providers = settings.providers || {};
    const value = providers[providerId];
    return value !== false;
  }

  function shouldShowPanel() {
    if (!state.activeProvider) return false;
    if (!isProviderEnabled(state.activeProvider.id)) return false;
    if (!isLoggedIn()) return isCloudEnabled();
    return !settings.autoSend || state.activeProvider.needsManualFetch;
  }

  function clearQueue() {
    if (state.pendingTimer) {
      clearTimeout(state.pendingTimer);
    }
    state.pendingTimer = null;
    state.pending.clear();
    state.queue = [];
    state.sendGroups.clear();
    state.forceSend = false;
  }

  function applyPanelHandlers() {
    if (!panelVisible) return;
    if (sendBtn) {
      sendBtn.onclick = () => {
        if (panelHandlers.onSend) panelHandlers.onSend();
      };
    }
    if (sendAllBtn) {
      sendAllBtn.onclick = () => {
        if (panelHandlers.onSendAll) panelHandlers.onSendAll();
      };
    }
    if (loginBtn) {
      loginBtn.onclick = () => {
        if (panelHandlers.onLogin) panelHandlers.onLogin();
      };
    }
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        if (panelHandlers.onLogout) panelHandlers.onLogout();
      };
    }
    if (settingsBtn) {
      settingsBtn.onclick = () => {
        if (panelHandlers.onSettings) panelHandlers.onSettings();
      };
    }
  }

  function setPanelCollapsed(next) {
    panelCollapsed = next;
    if (!panel) return;
    panel.classList.toggle("cc-offers-panel--collapsed", panelCollapsed);
    if (collapseBtn) {
      collapseBtn.setAttribute("aria-label", panelCollapsed ? "Expand" : "Collapse");
    }
  }

  function ensurePanel() {
    if (state.activeProvider && !isProviderEnabled(state.activeProvider.id)) return;
    if (panelVisible) return;
    panel = createPanel();
    panel.classList.add("cc-offers-panel--compact");
    statusEl = panel.querySelector("[data-status]");
    countEl = panel.querySelector("[data-count]");
    cardsEl = panel.querySelector("[data-cards]");
    bankEl = panel.querySelector("[data-bank]");
    sendBtn = panel.querySelector("[data-send]");
    sendAllBtn = panel.querySelector("[data-send-all]");
    loginBtn = panel.querySelector("[data-login]");
    logoutBtn = panel.querySelector("[data-logout]");
    settingsBtn = panel.querySelector("[data-settings]");
    toggleBtn = panel.querySelector("[data-toggle]");
    collapseBtn = panel.querySelector("[data-collapse]");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => setPanelCollapsed(false));
    }
    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => setPanelCollapsed(true));
    }
    if (sendBtn) {
      sendBtn.style.display = "none";
    }
    if (sendAllBtn) {
      sendAllBtn.style.display = "none";
    }
    if (loginBtn) {
      loginBtn.style.display = "inline-flex";
    }
    if (logoutBtn) {
      logoutBtn.style.display = "none";
    }
    panelVisible = true;
    setPanelCollapsed(panelCollapsed);
    applyPanelHandlers();
  }

  function updateUI() {
    if (!panelVisible) return;
    const bank = state.activeProvider ? state.activeProvider.id : "-";
    bankEl.textContent = `Bank: ${bank}`;
    const snapshot = getPendingSnapshot();
    countEl.textContent = `Detected: ${snapshot.totalOffers}`;
    if (cardsEl) {
      cardsEl.textContent = `Card: ${snapshot.cardLabels.length ? snapshot.cardLabels.join(", ") : "-"}`;
    }
  }

  function updateAuthUI() {
    if (!panelVisible) return;
    const loggedIn = isLoggedIn();
    const allowManual = state.activeProvider
      ? state.activeProvider.needsManualFetch || !settings.autoSend
      : !settings.autoSend;
    if (sendBtn) {
      sendBtn.style.display = loggedIn && allowManual ? "inline-flex" : "none";
    }
    if (sendAllBtn) {
      const supportsSendAll = Boolean(state.activeProvider && state.activeProvider.supportsSendAll);
      sendAllBtn.style.display = loggedIn && allowManual && supportsSendAll ? "inline-flex" : "none";
    }
    if (loginBtn) {
      loginBtn.style.display = isCloudEnabled() && !loggedIn ? "inline-flex" : "none";
    }
    if (logoutBtn) {
      logoutBtn.style.display = isCloudEnabled() && loggedIn ? "inline-flex" : "none";
    }
    updateSendButtonState();
  }

  function setSendButtonLoading(isLoading, labelOverride) {
    if (!sendBtn) return;
    sendBtn.disabled = isLoading || state.sendAllSending;
    sendBtn.textContent = isLoading ? (labelOverride || SEND_BUTTON_LOADING_LABEL) : SEND_BUTTON_LABEL;
  }

  function setSendAllButtonLoading(isLoading) {
    if (!sendAllBtn) return;
    sendAllBtn.disabled = isLoading || state.manualSending;
    sendAllBtn.textContent = isLoading ? SEND_ALL_BUTTON_LOADING_LABEL : SEND_ALL_BUTTON_LABEL;
  }

  function updateSendButtonState() {
    if (!sendBtn) return;
    const allowManual = state.activeProvider
      ? state.activeProvider.needsManualFetch || !settings.autoSend
      : !settings.autoSend;
    if (!allowManual) {
      setSendButtonLoading(false);
      setSendAllButtonLoading(false);
      return;
    }
    setSendButtonLoading(state.manualSending);
    setSendAllButtonLoading(state.sendAllSending);
  }

  function setManualSending(next) {
    state.manualSending = next;
    if (state.manualSendTimer) {
      clearTimeout(state.manualSendTimer);
      state.manualSendTimer = null;
    }
    if (next) {
      state.manualSendTimer = setTimeout(() => {
        state.manualSending = false;
        updateSendButtonState();
      }, 10000);
    }
    updateSendButtonState();
  }

  function setSendAllSending(next) {
    state.sendAllSending = next;
    updateSendButtonState();
  }

  function setStatus(text) {
    if (!panelVisible) return;
    statusEl.textContent = text;
  }

  function pushOffers(providerId, offers) {
    if (!isProviderEnabled(providerId)) return;
    if (!offers.length) return;
    let added = 0;
    offers.forEach(offer => {
      const cardKey = `${providerId}:${offer.cardNum || ""}`;
      let cardMap = state.pending.get(cardKey);
      if (!cardMap) {
        cardMap = new Map();
        state.pending.set(cardKey, cardMap);
      }
      const offerKey = `${providerId}:${offer.id}:${offer.cardNum || ""}`;
      if (cardMap.has(offerKey)) return;
      cardMap.set(offerKey, offer);
      added += 1;
    });
    if (added === 0) return;
    state.stats.collected += added;
    updateUI();
    scheduleSend();
    if (panelVisible && isLoggedIn() && settings.autoSend) {
      fadeOutPanel();
    }
  }

  function getCardLabels(cardKeys) {
    return Array.from(new Set(cardKeys)).map(key => {
      const parts = key.split(":");
      const last = parts[1] || "";
      return last ? `Card ${last}` : "Card unknown";
    });
  }

  function getPendingSnapshot() {
    const cardKeys = Array.from(state.pending.keys());
    let totalOffers = 0;
    state.pending.forEach(offerMap => {
      totalOffers += offerMap.size;
    });
    return {
      totalOffers,
      cardLabels: getCardLabels(cardKeys)
    };
  }

  function scheduleSend() {
    if (state.activeProvider && !isProviderEnabled(state.activeProvider.id)) {
      clearQueue();
      setManualSending(false);
      return;
    }
    if (!isLoggedIn()) {
      setStatus("Login required");
      setManualSending(false);
      return;
    }
    if (!settings.autoSend && !state.forceSend && !state.sendAllActive) {
      ensurePanel();
      updateUI();
      updateAuthUI();
      setStatus("Manual send required");
      return;
    }
    state.forceSend = false;
    setStatus("Queued");
    const snapshot = getPendingSnapshot();
    updateToast("queued", snapshot.totalOffers, snapshot.cardLabels);
    if (state.pendingTimer) {
      clearTimeout(state.pendingTimer);
    }
    state.pendingTimer = setTimeout(() => {
      if (state.pending.size === 0) return;
      const entries = Array.from(state.pending.entries());
      state.pending.clear();
      const groupId = state.groupId + 1;
      state.groupId = groupId;
      const batches = entries.map(([cardKey, offerMap]) => ({
        groupId,
        cardKey,
        offers: Array.from(offerMap.values())
      }));
      const totalOffers = batches.reduce((sum, batch) => sum + batch.offers.length, 0);
      const cardLabels = getCardLabels(batches.map(batch => batch.cardKey));
      state.sendGroups.set(groupId, {
        totalBatches: batches.length,
        sentBatches: 0,
        totalOffers,
        cardLabels
      });
      batches.forEach(batch => enqueueSend(batch));
    }, SEND_DEBOUNCE_MS);
  }

  function enqueueSend(batch) {
    if (!batch || !batch.offers || batch.offers.length === 0) return;
    state.queue.push(batch);
    processQueue();
  }

  function processQueue() {
    if (!isLoggedIn() || state.inFlight || state.queue.length === 0) return;
    const batch = state.queue.shift();
    if (!batch) return;
    state.inFlight = true;
    const group = state.sendGroups.get(batch.groupId);
    if (group) {
      updateToast("sending", group.totalOffers, group.cardLabels);
    }
    setStatus(`Sending ${batch.offers.length}...`);
    const headers = {
      "Content-Type": "application/json"
    };
    const token = isCloudEnabled() && auth && typeof auth.getToken === "function"
      ? auth.getToken() || ""
      : "";
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    GM_xmlhttpRequest({
      method: "POST",
      url: getApiEndpoint(),
      headers,
      data: JSON.stringify({ offers: batch.offers, token }),
      onload: () => {
        state.inFlight = false;
        state.stats.sent += batch.offers.length;
        setStatus(`Sent ${batch.offers.length}`);
        const groupState = state.sendGroups.get(batch.groupId);
        if (groupState) {
          groupState.sentBatches += 1;
          if (groupState.sentBatches >= groupState.totalBatches) {
            updateToast("sent", groupState.totalOffers, groupState.cardLabels);
            state.sendGroups.delete(batch.groupId);
          }
        }
        processQueue();
        if (!state.inFlight && state.queue.length === 0 && state.pending.size === 0) {
          setManualSending(false);
        }
      },
      onerror: () => {
        state.inFlight = false;
        setStatus("Send failed");
        processQueue();
        if (!state.inFlight && state.queue.length === 0 && state.pending.size === 0) {
          setManualSending(false);
        }
      }
    });
  }

  function updateToast(status, count, cardLabels) {
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
    const icon =
      status === "sent"
        ? '<span class="cc-offers-toast__icon cc-offers-toast__check"></span>'
        : '<span class="cc-offers-toast__icon cc-offers-toast__spinner"></span>';
    const label =
      status === "sent"
        ? "sent"
        : status === "sending"
          ? "sending"
          : "queued";
    const cards = Array.isArray(cardLabels) ? cardLabels : [];
    const cardsMarkup = cards.length
      ? cards.map(card => `<span>${card}</span>`).join("")
      : "";
    next.innerHTML = `
      ${icon}
      <div class="cc-offers-toast__content">
        <span>${count} offers ${label}</span>
        ${cardsMarkup ? `<div class="cc-offers-toast__cards">${cardsMarkup}</div>` : ""}
      </div>
      <button class="cc-offers-toast__close" type="button">X</button>
    `;
    next.querySelector(".cc-offers-toast__close").addEventListener("click", () => {
      fadeOutToast();
    });
    document.documentElement.appendChild(next);
    toast = next;
    if (status === "sent") {
      toastTimer = setTimeout(() => {
        fadeOutToast();
      }, 3000);
    }
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

  async function start() {
    if (state.activeProvider) {
      return;
    }
    ensureRedirectPopup();
    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand("Offers Camp Settings", () => {
        if (OffersCamp.settingsUI && typeof OffersCamp.settingsUI.open === "function") {
          OffersCamp.settingsUI.open();
          return;
        }
        ensurePanel();
      });
    }
    const provider = OffersCamp.providers.find(p => p.match());
    if (!provider) {
      installRouteWatcher();
      return;
    }
    state.activeProvider = provider;
    provider.needsManualFetch = !settings.autoSend;
    if (isProviderEnabled(provider.id) && !state.providerStarted) {
      provider.start(pushOffers);
      state.providerStarted = true;
    }
    if (isCloudEnabled()) {
      initAuth();
    } else {
      setStatus(AUTH_DISABLED_STATUS);
    }
    if (shouldShowPanel()) {
      ensurePanel();
      updateUI();
      updateAuthUI();
    }
    if (isProviderEnabled(provider.id) && !state.providerStarted) {
      provider.start(pushOffers);
      state.providerStarted = true;
    }
    panelHandlers.onSend = () => {
      if (!isProviderEnabled(provider.id)) return;
      if (state.manualSending) return;
      if (state.sendAllSending) return;
      state.forceSend = true;
      setManualSending(true);
      provider.manualFetch(pushOffers, setStatus);
      setStatus("Manual send");
      if (settings.autoSend) {
        fadeOutPanel();
      }
    };
    panelHandlers.onSendAll = () => {
      if (!isProviderEnabled(provider.id)) return;
      if (state.sendAllSending) return;
      if (!provider.sendAll) return;
      state.sendAllActive = true;
      setSendAllSending(true);
      provider.sendAll(pushOffers, setStatus, result => {
        state.sendAllActive = false;
        setSendAllSending(false);
        if (result && result.stopped) {
          setStatus("Send all stopped");
        }
      });
      setStatus("Sending all cards...");
    };
    panelHandlers.onLogin = () => {
      if (!isCloudEnabled() || !auth) return;
      auth.openLogin();
    };
    panelHandlers.onLogout = () => {
      if (!isCloudEnabled() || !auth) return;
      auth.logout().then(() => {
        setStatus("Logged out");
        updateAuthUI();
      });
    };
    panelHandlers.onSettings = () => {
      if (OffersCamp.settingsUI && typeof OffersCamp.settingsUI.open === "function") {
        OffersCamp.settingsUI.open();
      }
    };
    applyPanelHandlers();
  }

  OffersCamp.start = OffersCamp.start || start;
  OffersCamp.start();

  function installRouteWatcher() {
    if (state.routeWatcherInstalled) return;
    state.routeWatcherInstalled = true;
    const trigger = () => {
      ensureRedirectPopup();
      if (state.activeProvider && !state.activeProvider.match()) {
        clearQueue();
        fadeOutPanel();
        state.activeProvider = null;
        state.providerStarted = false;
      }
      if (!state.activeProvider) start();
    };
    window.addEventListener("popstate", trigger);
    window.addEventListener("hashchange", trigger);
    if (!window.history || window.history.__ccOffersHooked) return;
    const wrapHistory = method => {
      const original = window.history[method];
      if (typeof original !== "function") return;
      window.history[method] = function (...args) {
        const result = original.apply(this, args);
        trigger();
        return result;
      };
    };
    wrapHistory("pushState");
    wrapHistory("replaceState");
    window.history.__ccOffersHooked = true;
  }
})();
