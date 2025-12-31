(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};

  const DEFAULT_SETTINGS = {
    autoSend: true,
    providers: {
      amex: true,
      chase: true,
      citi: true
    }
  };
  const STORAGE_KEY = "offersCampSettings";

  function loadSettings() {
    if (typeof GM_getValue !== "function") {
      return { ...DEFAULT_SETTINGS };
    }
    const raw = GM_getValue(STORAGE_KEY, "");
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        providers: {
          ...DEFAULT_SETTINGS.providers,
          ...(parsed.providers || {})
        }
      };
    } catch (_) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(next) {
    if (typeof GM_setValue !== "function") return;
    GM_setValue(STORAGE_KEY, JSON.stringify(next));
  }

  let settings = loadSettings();
  const listeners = new Set();

  OffersCamp.settings = {
    get() {
      return { ...settings, providers: { ...settings.providers } };
    },
    set(partial) {
      settings = {
        ...settings,
        ...partial,
        providers: {
          ...settings.providers,
          ...(partial.providers || {})
        }
      };
      saveSettings(settings);
      listeners.forEach(fn => fn(settings));
    },
    onChange(fn) {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };

  function ensureRoot() {
    let root = document.getElementById("offers-camp-settings-root");
    if (root) return root;
    root = document.createElement("div");
    root.id = "offers-camp-settings-root";
    document.body.appendChild(root);
    return root;
  }

  function closeSettings() {
    const root = document.getElementById("offers-camp-settings-root");
    if (root) {
      root.remove();
    }
  }

  function fetchUser(auth, apiBase, onUpdate) {
    if (!auth || !auth.getToken) {
      onUpdate("");
      return;
    }
    const token = auth.getToken();
    if (!token) {
      onUpdate("");
      return;
    }
    GM_xmlhttpRequest({
      method: "GET",
      url: `${apiBase}/auth/me`,
      headers: {
        Authorization: `Bearer ${token}`
      },
      onload: response => {
        if (response.status < 200 || response.status >= 300) {
          onUpdate("");
          return;
        }
        try {
          const data = JSON.parse(response.responseText || "{}");
          const username = data?.user?.username || data?.user?.email || "";
          onUpdate(username);
        } catch (_) {
          onUpdate("");
        }
      },
      onerror: () => onUpdate("")
    });
  }

  function renderSettings(auth, config) {
    const root = ensureRoot();
    const appBase = config.appBase || "http://localhost:5173";
    const apiBase = config.apiBase || "http://localhost:4000";
    let username = "";

    function render() {
      const current = OffersCamp.settings.get();
      const provider = current.providers || {};
      root.innerHTML = `
        <div class="cc-settings-overlay">
          <div class="cc-settings">
            <div class="cc-settings__panel">
              <div class="cc-settings__header">
                <div class="cc-settings__brand">Offers Camp</div>
                <button class="cc-settings__btn cc-settings__btn--ghost" data-close type="button">Close</button>
              </div>
            <div class="cc-settings__section">
              <div class="cc-settings__row">
                <div>
                  <div class="cc-settings__title">Account</div>
                  <div class="cc-settings__meta">${username ? `Signed in as <strong>${username}</strong>` : "No active session"}</div>
                </div>
                <div class="cc-settings__actions">
                  <button class="cc-settings__btn" data-login>${auth.isLoggedIn() ? "Open Offers Camp" : "Login"}</button>
                  <button class="cc-settings__btn cc-settings__btn--ghost" data-logout>Logout</button>
                </div>
              </div>
            </div>
            <div class="cc-settings__section">
              <div class="cc-settings__row">
                <div>
                  <div class="cc-settings__title">Auto send</div>
                  <div class="cc-settings__meta">Automatically send offers after refresh, or require manual send.</div>
                </div>
                <label class="cc-settings__toggle">
                  <input type="checkbox" data-auto-send ${current.autoSend ? "checked" : ""} />
                </label>
              </div>
            </div>
            <div class="cc-settings__section">
              <div class="cc-settings__title">Enabled providers</div>
              <label class="cc-settings__toggle">
                <input type="checkbox" data-provider="amex" ${provider.amex ? "checked" : ""} />
                <span>Amex</span>
              </label>
              <label class="cc-settings__toggle">
                <input type="checkbox" data-provider="chase" ${provider.chase ? "checked" : ""} />
                <span>Chase</span>
              </label>
              <label class="cc-settings__toggle">
                <input type="checkbox" data-provider="citi" ${provider.citi ? "checked" : ""} />
                <span>Citi</span>
              </label>
              <div class="cc-settings__actions">
                <button class="cc-settings__btn cc-settings__btn--ghost" data-enable-all>Enable all</button>
                <button class="cc-settings__btn cc-settings__btn--ghost" data-disable-all>Disable all</button>
              </div>
            </div>
            <div class="cc-settings__footer">
              Settings are stored locally in Tampermonkey and apply to all supported banks.
            </div>
            </div>
          </div>
        </div>
      `;

      root.querySelector(".cc-settings-overlay").addEventListener("click", event => {
        if (event.target.classList.contains("cc-settings-overlay")) {
          closeSettings();
        }
      });
      root.querySelector("[data-close]").addEventListener("click", () => {
        closeSettings();
      });
      root.querySelector("[data-login]").addEventListener("click", () => {
        if (auth.isLoggedIn()) {
          window.open(appBase, "_blank", "noopener");
          return;
        }
        auth.openLogin();
      });
      root.querySelector("[data-logout]").addEventListener("click", () => {
        auth.logout().then(() => {
          username = "";
          render();
        });
      });
      root.querySelector("[data-auto-send]").addEventListener("change", event => {
        OffersCamp.settings.set({ autoSend: event.target.checked });
      });
      root.querySelectorAll("[data-provider]").forEach(input => {
        input.addEventListener("change", event => {
          OffersCamp.settings.set({
            providers: {
              ...OffersCamp.settings.get().providers,
              [event.target.dataset.provider]: event.target.checked
            }
          });
        });
      });
      root.querySelector("[data-enable-all]").addEventListener("click", () => {
        OffersCamp.settings.set({
          providers: {
            amex: true,
            chase: true,
            citi: true
          }
        });
      });
      root.querySelector("[data-disable-all]").addEventListener("click", () => {
        OffersCamp.settings.set({
          providers: {
            amex: false,
            chase: false,
            citi: false
          }
        });
      });
    }

    render();
    OffersCamp.settings.onChange(render);
    if (auth.onChange) {
      auth.onChange(() => {
        fetchUser(auth, apiBase, name => {
          username = name;
          render();
        });
      });
    }
    fetchUser(auth, apiBase, name => {
      username = name;
      render();
    });
  }

  OffersCamp.settingsUI = {
    open() {
      const auth = OffersCamp.auth;
      const config = window.OffersCampConfig || {};
      if (!auth) return;
      const existing = document.getElementById("offers-camp-settings-root");
      if (existing) {
        existing.remove();
        return;
      }
      renderSettings(auth, config);
    }
  };
})();
