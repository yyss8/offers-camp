(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};
  const auth = OffersCamp.auth;

  const config = window.OffersCampConfig || {};
  const appBase = config.appBase || "http://localhost:5173";
  const apiBase = config.apiBase || "http://localhost:4000";
  const API_ENDPOINT = `${apiBase}/offers`;
  const SEND_DEBOUNCE_MS = 1500;
  const LOGIN_URL = `${appBase}/?tm=1&tmOrigin=${encodeURIComponent(window.location.origin)}`;
  const VERIFY_URL = `${apiBase}/auth/verify`;

  const state = {
    activeProvider: null,
    pending: new Map(),
    pendingTimer: null,
    inFlight: false,
    queue: [],
    sendGroups: new Map(),
    groupId: 0,
    stats: {
      collected: 0,
      sent: 0
    }
  };

  OffersCamp.providers = OffersCamp.providers || [];
  OffersCamp.registerProvider = OffersCamp.registerProvider || function registerProvider(provider) {
    OffersCamp.providers.push(provider);
  };

  function createPanel() {
    const panel = document.createElement("div");
    panel.className = "cc-offers-panel";
    panel.innerHTML = `
      <div class="cc-offers-panel__header">
        <div class="cc-offers-panel__title">Offers Camp</div>
        <button class="cc-offers-panel__close" type="button">X</button>
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__muted" data-status>
        Idle
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__muted" data-count>
        Collected: 0
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__bank-row">
        <span class="cc-offers-panel__bank" data-bank>Bank: -</span>
      </div>
      <div class="cc-offers-panel__row cc-offers-panel__actions">
        <button class="cc-offers-panel__btn" data-send type="button">Send now</button>
        <button class="cc-offers-panel__btn" data-login type="button">Login</button>
        <button class="cc-offers-panel__btn" data-logout type="button">Logout</button>
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
  let loginBtn = null;
  let logoutBtn = null;
  let panelVisible = false;
  let toast = null;
  let toastTimer = null;

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
      bankEl = null;
      sendBtn = null;
      loginBtn = null;
      logoutBtn = null;
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
    loginBtn = panel.querySelector("[data-login]");
    logoutBtn = panel.querySelector("[data-logout]");
    if (sendBtn) {
      sendBtn.style.display = "none";
    }
    if (loginBtn) {
      loginBtn.style.display = "inline-flex";
    }
    if (logoutBtn) {
      logoutBtn.style.display = "none";
    }
    panelVisible = true;
  }

  function updateUI() {
    if (!panelVisible) return;
    const bank = state.activeProvider ? state.activeProvider.id : "-";
    bankEl.textContent = `Bank: ${bank}`;
    countEl.textContent = `Collected: ${state.stats.collected}`;
  }

  function updateAuthUI() {
    if (!panelVisible) return;
    const loggedIn = auth.isLoggedIn();
    if (sendBtn) {
      sendBtn.style.display = loggedIn ? "inline-flex" : "none";
    }
    if (loginBtn) {
      loginBtn.style.display = loggedIn ? "none" : "inline-flex";
    }
    if (logoutBtn) {
      logoutBtn.style.display = loggedIn ? "inline-flex" : "none";
    }
  }

  function setStatus(text) {
    if (!panelVisible) return;
    statusEl.textContent = text;
  }

  function pushOffers(providerId, offers) {
    if (!offers.length) return;
    let added = 0;
    offers.forEach(offer => {
      const cardKey = `${providerId}:${offer.cardLast5 || ""}`;
      let cardMap = state.pending.get(cardKey);
      if (!cardMap) {
        cardMap = new Map();
        state.pending.set(cardKey, cardMap);
      }
      const offerKey = `${providerId}:${offer.id}:${offer.cardLast5 || ""}`;
      if (cardMap.has(offerKey)) return;
      cardMap.set(offerKey, offer);
      added += 1;
    });
    if (added === 0) return;
    state.stats.collected += added;
    updateUI();
    scheduleSend();
    if (panelVisible && auth.isLoggedIn()) {
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
    if (!auth.isLoggedIn()) {
      setStatus("Login required");
      return;
    }
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
    if (!auth.isLoggedIn() || state.inFlight || state.queue.length === 0) return;
    const batch = state.queue.shift();
    if (!batch) return;
    state.inFlight = true;
    const group = state.sendGroups.get(batch.groupId);
    if (group) {
      updateToast("sending", group.totalOffers, group.cardLabels);
    }
    setStatus(`Sending ${batch.offers.length}...`);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.getToken()}`
    };
    GM_xmlhttpRequest({
      method: "POST",
      url: API_ENDPOINT,
      headers,
      data: JSON.stringify({ offers: batch.offers }),
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
      },
      onerror: () => {
        state.inFlight = false;
        setStatus("Send failed");
        processQueue();
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
    const provider = OffersCamp.providers.find(p => p.match());
    if (!provider) {
      return;
    }
    state.activeProvider = provider;
    await auth.init({
      loginUrl: LOGIN_URL,
      verifyUrl: VERIFY_URL,
      onStatus: setStatus,
      onAuthChange: () => {
        if (auth.isLoggedIn()) {
          if (panelVisible && !provider.needsManualFetch) {
            fadeOutPanel();
          }
        } else {
          ensurePanel();
          updateUI();
          updateAuthUI();
        }
      },
      onTokenSaved: () => {
        if (panelVisible && !provider.needsManualFetch) {
          fadeOutPanel();
        }
        if (state.pending.size) {
          scheduleSend();
        }
      }
    });
    if (!auth.isLoggedIn() || provider.needsManualFetch) {
      ensurePanel();
      updateUI();
      updateAuthUI();
    }
    provider.start(pushOffers);
    sendBtn.onclick = () => {
      provider.manualFetch(pushOffers, setStatus);
      setStatus("Manual send");
      fadeOutPanel();
    };
    loginBtn.onclick = () => auth.openLogin();
    logoutBtn.onclick = () => {
      auth.logout().then(() => {
        setStatus("Logged out");
        updateAuthUI();
      });
    };
  }

  OffersCamp.start = OffersCamp.start || start;
  OffersCamp.start();
})();
