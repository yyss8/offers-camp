(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};

  const DEFAULT_SETTINGS = {
    autoSend: false,
    useCloud: true,
    localApiBase: "localhost:4000",
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
    if (!raw) {
      const defaults = { ...DEFAULT_SETTINGS };
      saveSettings(defaults);
      return defaults;
    }
    try {
      const parsed = JSON.parse(raw);
      const merged = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        providers: {
          ...DEFAULT_SETTINGS.providers,
          ...(parsed.providers || {})
        }
      };
      const needsSave =
        typeof parsed.autoSend !== "boolean" ||
        typeof parsed.useCloud !== "boolean" ||
        !parsed.localApiBase ||
        !parsed.providers ||
        typeof parsed.providers.amex !== "boolean" ||
        typeof parsed.providers.chase !== "boolean" ||
        typeof parsed.providers.citi !== "boolean";
      if (needsSave) {
        saveSettings(merged);
      }
      return merged;
    } catch (_) {
      const defaults = { ...DEFAULT_SETTINGS };
      saveSettings(defaults);
      return defaults;
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
      if (typeof fn !== "function") return () => { };
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

  const DEFAULT_LOCAL_API = "localhost:4000";

  function normalizeApiBase(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const hasScheme = /^[a-zA-Z][a-zA-Z\\d+.-]*:\/\//.test(trimmed);
    const base = hasScheme ? trimmed : `http://${trimmed}`;
    return base.replace(/\/+$/, "");
  }

  function renderSettings(auth, config) {
    const root = ensureRoot();
    const appBase = config.appBase || "http://localhost:5173";
    const apiBase = config.apiBase || "http://localhost:4000";
    let username = "";
    let localDraft = settings.localApiBase || DEFAULT_LOCAL_API;
    let localStatus = { text: "", tone: "" };
    let localSaving = false;

    function render() {
      const current = OffersCamp.settings.get();
      const provider = current.providers || {};
      const useCloud = current.useCloud !== false;
      const loggedIn = auth.isLoggedIn();
      localDraft = current.localApiBase || localDraft || DEFAULT_LOCAL_API;
      root.innerHTML = `
        <div class="cc-settings-overlay">
          <div class="cc-settings">
            <div class="cc-settings__panel">
              <div class="cc-settings__header">
                <div class="cc-settings__brand">Offers Camp</div>
                <button class="cc-settings__btn cc-settings__btn--ghost" data-close type="button" aria-label="Close">X</button>
              </div>
            <div class="cc-settings__section">
              <div class="cc-settings__row">
                <label class="cc-settings__toggle">
                  <input type="checkbox" data-use-cloud ${useCloud ? "checked" : ""} />
                  <span>Use cloud server</span>
                </label>
              </div>
              ${useCloud ? "" : `
                <div class="cc-settings__row cc-settings__row--stack">
                  <div class="cc-settings__field">
                    <div class="cc-settings__label">
                      Local URL
                      <a href="https://github.com/yyss8/offers-camp/blob/master/SELF-HOSTING.MD" target="_blank" style="margin-left: 8px; font-size: 11px; color: #f59e0b; text-decoration: none; font-weight: 500;">
                        Self-Hosting Guide →
                      </a>
                    </div>
                    <div class="cc-settings__input-row">
                      <input class="cc-settings__input" data-local-api value="${localDraft}" placeholder="${DEFAULT_LOCAL_API}" />
                      <button class="cc-settings__btn cc-settings__btn--ghost" data-save-local ${localSaving ? "disabled" : ""}>
                        ${localSaving ? "Checking..." : "Save"}
                      </button>
                    </div>
                    ${localStatus.text ? `<div class="cc-settings__status ${localStatus.tone ? `cc-settings__status--${localStatus.tone}` : ""}">${localStatus.text}</div>` : ""}
                  </div>
                </div>
              `}
            </div>
            ${useCloud ? `
              <div class="cc-settings__section">
                <div class="cc-settings__row">
                  <div>
                    <div class="cc-settings__title">Account</div>
                    <div class="cc-settings__meta">${username ? `Signed in as <strong>${username}</strong>` : "No active session"}</div>
                  </div>
                  <div class="cc-settings__actions">
                    <button class="cc-settings__btn" data-login>${loggedIn ? "Open Offers Camp" : "Login"}</button>
                    ${loggedIn ? `<button class="cc-settings__btn cc-settings__btn--ghost" data-logout>Logout</button>` : ""}
                  </div>
                </div>
              </div>
            ` : ""}
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
      const loginBtn = root.querySelector("[data-login]");
      if (loginBtn) {
        loginBtn.addEventListener("click", () => {
          if (useCloud && auth.isLoggedIn()) {
            window.open(appBase, "_blank", "noopener");
            return;
          }
          if (useCloud) {
            auth.openLogin();
          }
        });
      }
      const logoutBtn = root.querySelector("[data-logout]");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          auth.logout().then(() => {
            username = "";
            render();
          });
        });
      }
      root.querySelector("[data-auto-send]").addEventListener("change", event => {
        OffersCamp.settings.set({ autoSend: event.target.checked });
      });
      const useCloudToggle = root.querySelector("[data-use-cloud]");
      if (useCloudToggle) {
        useCloudToggle.addEventListener("change", event => {
          OffersCamp.settings.set({ useCloud: event.target.checked });
        });
      }
      const localInput = root.querySelector("[data-local-api]");
      if (localInput) {
        localInput.addEventListener("input", event => {
          localDraft = event.target.value;
        });
      }
      const saveLocalBtn = root.querySelector("[data-save-local]");
      if (saveLocalBtn) {
        saveLocalBtn.addEventListener("click", () => {
          const trimmed = String(localDraft || "").trim();
          const normalized = normalizeApiBase(trimmed);
          if (!normalized) {
            localStatus = { text: "Enter a valid address.", tone: "error" };
            render();
            return;
          }
          localSaving = true;
          localStatus = { text: "Checking backend...", tone: "" };
          render();
          const healthUrl = `${normalized}/health`;
          const request = {
            method: "GET",
            url: healthUrl,
            onload: response => {
              if (response.status >= 200 && response.status < 300) {
                localSaving = false;
                localStatus = { text: "Connected", tone: "success" };
                OffersCamp.settings.set({ localApiBase: trimmed.replace(/\/+$/, "") });
                return;
              }
              localSaving = false;
              localStatus = { text: "Local server unavailable", tone: "error" };
              render();
            },
            onerror: () => {
              localSaving = false;
              localStatus = { text: "Local server unavailable", tone: "error" };
              render();
            },
            ontimeout: () => {
              localSaving = false;
              localStatus = { text: "Local server unavailable", tone: "error" };
              render();
            }
          };
          if (typeof GM_xmlhttpRequest === "function") {
            GM_xmlhttpRequest(request);
          } else {
            fetch(healthUrl, { method: "GET" })
              .then(response => {
                if (!response.ok) throw new Error("offline");
                localSaving = false;
                localStatus = { text: "Connected", tone: "success" };
                OffersCamp.settings.set({ localApiBase: trimmed.replace(/\/+$/, "") });
              })
              .catch(() => {
                localSaving = false;
                localStatus = { text: "Local server unavailable", tone: "error" };
                render();
              });
          }
        });
      }
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
    OffersCamp.settings.onChange(() => {
      const current = OffersCamp.settings.get();
      if (current.useCloud !== false) {
        fetchUser(auth, apiBase, name => {
          username = name;
          render();
        });
      } else {
        // Don't clear username when switching to local mode, just re-render
        render();
      }
    });
    if (auth.onChange) {
      auth.onChange(() => {
        if (OffersCamp.settings.get().useCloud !== false) {
          fetchUser(auth, apiBase, name => {
            username = name;
            render();
          });
        }
      });
    }
    if (OffersCamp.settings.get().useCloud !== false) {
      fetchUser(auth, apiBase, name => {
        username = name;
        render();
      });
    }
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
