(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};

  OffersCamp.utils = {
    nowIso() {
      return new Date().toISOString();
    },
    parseChannels(value) {
      if (!value) return [];
      return String(value)
        .split("_")
        .map(item => item.trim())
        .filter(Boolean);
    },
    formatExpiry(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const yy = String(date.getFullYear()).slice(-2);
      return `${mm}/${dd}/${yy}`;
    },
    installFetchJsonHook(pageWindow, flag, shouldHandle, onJson) {
      if (!pageWindow || !pageWindow.fetch) return false;
      const originalFetch = pageWindow.fetch;
      if (originalFetch && originalFetch[flag]) return false;
      const wrapped = function (...args) {
        const requestUrl =
          typeof args[0] === "string"
            ? args[0]
            : args[0]?.url || "";
        const fetchPromise = originalFetch.apply(this, args);
        fetchPromise.then(response => {
          if (!shouldHandle(requestUrl)) return;
          response.clone().json().then(onJson).catch(() => {});
        }).catch(() => {});
        return fetchPromise;
      };
      wrapped[flag] = true;
      pageWindow.fetch = wrapped;
      return true;
    },
    waitForValue(getter, onReady, attempts = 10, delayMs = 300) {
      if (typeof getter !== "function" || typeof onReady !== "function") return;
      const value = getter();
      if (value || attempts <= 0) {
        onReady(value);
        return;
      }
      setTimeout(() => {
        OffersCamp.utils.waitForValue(getter, onReady, attempts - 1, delayMs);
      }, delayMs);
    },
    installXhrJsonHook(pageWindow, flag, shouldHandle, onJson) {
      if (!pageWindow || !pageWindow.XMLHttpRequest) return false;
      const OriginalXHR = pageWindow.XMLHttpRequest;
      if (OriginalXHR && OriginalXHR[flag]) return false;
      function PatchedXHR() {
        const xhr = new OriginalXHR();
        let requestUrl = "";
        const originalOpen = OriginalXHR.prototype.open;
        xhr.open = function (...args) {
          requestUrl = typeof args[1] === "string" ? args[1] : "";
          return originalOpen.apply(xhr, args);
        };
        xhr.addEventListener("load", function () {
          if (!shouldHandle(requestUrl)) return;
          try {
            if (!xhr.responseType || xhr.responseType === "text") {
              if (!xhr.responseText) return;
              onJson(JSON.parse(xhr.responseText));
            } else if (xhr.responseType === "json") {
              if (!xhr.response) return;
              onJson(xhr.response);
            }
          } catch (_) {}
        });
        return xhr;
      }
      PatchedXHR.prototype = OriginalXHR.prototype;
      Object.assign(PatchedXHR, OriginalXHR);
      PatchedXHR[flag] = true;
      pageWindow.XMLHttpRequest = PatchedXHR;
      return true;
    }
  };
})();
