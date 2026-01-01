(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};

  const state = {
    token: "",
    user: null,
    loginUrl: "",
    loginOrigin: "",
    verifyUrl: "",
    tokenUrl: "",
    storageKey: "offersCampToken",
    loginPopup: null,
    loginPollTimer: null,
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
        state.user = null;
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
          const ok = response.status >= 200 && response.status < 300;
          if (!ok) {
            state.user = null;
            resolve(false);
            return;
          }
          try {
            const payload = response.responseText ? JSON.parse(response.responseText) : {};
            state.user = payload && payload.user ? payload.user : null;
          } catch (err) {
            state.user = null;
          }
          resolve(true);
        },
        onerror: () => {
          state.user = null;
          resolve(false);
        },
        ontimeout: () => {
          state.user = null;
          resolve(false);
        }
      });
    });
  }

  async function setToken(token) {
    state.token = token;
    await saveStoredToken(token);
    if (!token) {
      state.user = null;
      state.onAuthChange(false);
      state.listeners.forEach(fn => fn(false));
      return;
    }
    const valid = await validateToken(token);
    if (!valid) {
      await clearToken();
      state.onStatus("Login required");
      return;
    }
    state.onAuthChange(true);
    state.listeners.forEach(fn => fn(true));
    state.onTokenSaved(token);
  }

  async function clearToken() {
    state.token = "";
    state.user = null;
    await saveStoredToken("");
    state.onAuthChange(false);
    state.listeners.forEach(fn => fn(false));
  }

  function stopLoginPoll() {
    if (!state.loginPollTimer) return;
    clearInterval(state.loginPollTimer);
    state.loginPollTimer = null;
  }

  function fetchTokenFromSession() {
    return new Promise(resolve => {
      if (!state.tokenUrl) {
        resolve(false);
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: state.tokenUrl,
        withCredentials: true,
        anonymous: false,
        onload: response => {
          if (response.status < 200 || response.status >= 300) {
            resolve(false);
            return;
          }
          try {
            const payload = response.responseText ? JSON.parse(response.responseText) : {};
            const token = payload && payload.token ? String(payload.token) : "";
            if (!token) {
              resolve(false);
              return;
            }
            setToken(token).then(() => resolve(true));
          } catch (err) {
            resolve(false);
          }
        },
        onerror: () => resolve(false),
        ontimeout: () => resolve(false)
      });
    });
  }

  function handleTokenMessage(event) {
    if (!state.loginOrigin || event.origin !== state.loginOrigin) return;
    const data = event.data || {};
    if (!data || data.type !== "offersCampToken" || !data.token) return;
    stopLoginPoll();
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
    stopLoginPoll();
    state.loginPopup = window.open(
      state.loginUrl,
      "offersCampLogin",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    state.loginPollTimer = setInterval(() => {
      if (!state.loginPopup || !state.loginPopup.closed) return;
      stopLoginPoll();
      fetchTokenFromSession().then(ok => {
        if (!ok) {
          state.onStatus("Login required");
        }
      });
    }, 500);
  }

  async function init(options) {
    state.loginUrl = options.loginUrl;
    state.verifyUrl = options.verifyUrl;
    state.tokenUrl = options.tokenUrl || "";
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
    getUser() {
      return state.user;
    },
    getUserId() {
      return state.user ? state.user.id : null;
    },
    isLoggedIn() {
      return Boolean(state.token);
    }
  };
})();
