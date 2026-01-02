(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};

  OffersCamp.utils = {
    nowIso() {
      return new Date().toISOString();
    },
    extractLastDigits(value, count) {
      if (!value) return "";
      const matches = String(value).match(/\d+/g);
      if (!matches || matches.length === 0) return "";
      const lastDigits = matches[matches.length - 1];
      return lastDigits.slice(-count);
    },
    sleep(ms, pageWindow) {
      const timer = pageWindow && pageWindow.setTimeout ? pageWindow.setTimeout : setTimeout;
      return new Promise(resolve => timer(resolve, ms));
    },
    waitForElement(selector, timeoutMs, pageWindow) {
      const doc = pageWindow && pageWindow.document ? pageWindow.document : document;
      const Win = pageWindow || window;
      const root = doc.documentElement || doc.body;

      return new Promise(resolve => {
        const existing = doc.querySelector(selector);
        if (existing) {
          resolve(existing);
          return;
        }

        const observer = new Win.MutationObserver(() => {
          const found = doc.querySelector(selector);
          if (found) {
            observer.disconnect();
            resolve(found);
          }
        });

        observer.observe(root, { childList: true, subtree: true });

        if (timeoutMs) {
          Win.setTimeout(() => {
            observer.disconnect();
            resolve(null);
          }, timeoutMs);
        }
      });
    },
    parseChannels(value) {
      if (!value) return [];
      return String(value)
        .split("_")
        .map(item => item.trim())
        .filter(Boolean);
    },
    cloneHeaders(...values) {
      const output = {};
      values.forEach(value => {
        if (!value) return;
        if (typeof Headers !== "undefined" && value instanceof Headers) {
          value.forEach((val, key) => {
            output[key] = val;
          });
          return;
        }
        if (Array.isArray(value)) {
          value.forEach(pair => {
            if (Array.isArray(pair) && pair.length >= 2) {
              output[pair[0]] = pair[1];
            }
          });
          return;
        }
        Object.keys(value).forEach(key => {
          output[key] = value[key];
        });
      });
      return output;
    },
    createSendAllModal(pageWindow) {
      const doc = pageWindow.document;

      const overlay = doc.createElement("div");
      overlay.className = "offers-camp-sendall-overlay";
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:2147483647;";

      const modal = doc.createElement("div");
      modal.className = "offers-camp-sendall-modal";
      modal.style.cssText =
        "background:#0f172a;color:#f8fafc;border-radius:16px;min-width:320px;max-width:420px;padding:20px 22px;box-shadow:0 20px 60px rgba(15,23,42,0.4);text-align:center;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;";

      const title = doc.createElement("div");
      title.textContent = "Send All";
      title.style.cssText = "font-size:16px;font-weight:600;margin-bottom:8px;";

      const status = doc.createElement("div");
      status.textContent = "Preparing...";
      status.style.cssText = "font-size:13px;color:#cbd5f5;margin-bottom:14px;";

      const progressWrap = doc.createElement("div");
      progressWrap.style.cssText =
        "width:100%;height:10px;border-radius:999px;background:#1e293b;overflow:hidden;margin-bottom:14px;";

      const progress = doc.createElement("div");
      progress.style.cssText = "height:100%;width:0%;background:#38bdf8;transition:width 0.2s ease;";
      progressWrap.appendChild(progress);

      const stopBtn = doc.createElement("button");
      stopBtn.type = "button";
      stopBtn.textContent = "Stop";
      stopBtn.style.cssText =
        "border:1px solid #334155;background:#0b1220;color:#f8fafc;border-radius:999px;padding:6px 16px;cursor:pointer;font-size:13px;";

      modal.appendChild(title);
      modal.appendChild(status);
      modal.appendChild(progressWrap);
      modal.appendChild(stopBtn);
      overlay.appendChild(modal);

      doc.body.appendChild(overlay);

      return {
        overlay,
        stopBtn,
        setStatus(text) {
          status.textContent = text;
        },
        setProgress(value) {
          const safe = Math.max(0, Math.min(100, value));
          progress.style.width = `${safe}%`;
        },
        remove() {
          if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }
      };
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
