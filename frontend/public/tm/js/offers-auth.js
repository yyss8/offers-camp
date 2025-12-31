(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};

  const state = {
    token: "",
    loginUrl: "",
    loginOrigin: "",
    verifyUrl: "",
    storageKey: "offersCampToken",
    loginPopup: null,
    onStatus: () => {},
    onAuthChange: () => {},
    onTokenSaved: () => {},
    listeners: new Set()
  };

  function getStoredToken() {
    if (typeof GM_getValue !== "function") {
      return Promise.resolve("");
    }
    return Promise.resolve(GM_getValue(state.storageKey, ""));
  }

  function saveStoredToken(token) {
    if (typeof GM_setValue === "function") {
      return Promise.resolve(GM_setValue(state.storageKey, token));
    }
    return Promise.resolve();
  }

  function validateToken(token) {
    return new Promise(resolve => {
      if (!token) {
        resolve(false);
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: state.verifyUrl,
        headers: {
          Authorization: `Bearer ${token}`
        },
        onload: response => {
          resolve(response.status >= 200 && response.status < 300);
        },
        onerror: () => resolve(false),
        ontimeout: () => resolve(false)
      });
    });
  }

  async function setToken(token) {
    state.token = token;
    await saveStoredToken(token);
    state.onAuthChange(Boolean(token));
    state.listeners.forEach(fn => fn(Boolean(token)));
    if (token) {
      state.onTokenSaved(token);
    }
  }

  async function clearToken() {
    state.token = "";
    await saveStoredToken("");
    state.onAuthChange(false);
    state.listeners.forEach(fn => fn(false));
  }

  function handleTokenMessage(event) {
    if (!state.loginOrigin || event.origin !== state.loginOrigin) return;
    const data = event.data || {};
    if (!data || data.type !== "offersCampToken" || !data.token) return;
    setToken(String(data.token)).then(() => {
      state.onStatus("Ready");
    });
    if (state.loginPopup && !state.loginPopup.closed) {
      state.loginPopup.close();
      state.loginPopup = null;
    }
  }

  function openLogin() {
    if (!state.loginUrl) return;
    const width = 480;
    const height = 640;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    state.loginPopup = window.open(
      state.loginUrl,
      "offersCampLogin",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }

  async function init(options) {
    state.loginUrl = options.loginUrl;
    state.verifyUrl = options.verifyUrl;
    state.storageKey = options.storageKey || state.storageKey;
    state.onStatus = options.onStatus || state.onStatus;
    state.onAuthChange = options.onAuthChange || state.onAuthChange;
    state.onTokenSaved = options.onTokenSaved || state.onTokenSaved;
    state.loginOrigin = state.loginUrl ? new URL(state.loginUrl).origin : "";

    window.addEventListener("message", handleTokenMessage);

    state.token = (await getStoredToken()) || "";
    if (state.token) {
      state.onStatus("Checking login...");
      const valid = await validateToken(state.token);
      if (!valid) {
        await clearToken();
        state.onStatus("Login required");
      } else {
        state.onAuthChange(true);
        state.onStatus("Ready");
      }
    } else {
      state.onStatus("Login required");
    }
  }

  OffersCamp.auth = {
    init,
    openLogin,
    logout: clearToken,
    onChange(fn) {
      if (typeof fn !== "function") return () => {};
      state.listeners.add(fn);
      return () => state.listeners.delete(fn);
    },
    getToken() {
      return state.token;
    },
    isLoggedIn() {
      return Boolean(state.token);
    }
  };
})();
