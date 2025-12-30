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
    pending: [],
    pendingTimer: null,
    inFlight: false,
    queue: [],
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
    if (panelVisible && auth.isLoggedIn()) {
      fadeOutPanel();
    }
  }

  function scheduleSend() {
    if (!auth.isLoggedIn()) {
      setStatus("Login required");
      return;
    }
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
    if (!auth.isLoggedIn() || state.inFlight || state.queue.length === 0) return;
    const batch = state.queue.shift();
    if (!batch) return;
    state.inFlight = true;
    setStatus(`Sending ${batch.length}...`);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.getToken()}`
    };
    GM_xmlhttpRequest({
      method: "POST",
      url: API_ENDPOINT,
      headers,
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
        if (state.pending.length) {
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
