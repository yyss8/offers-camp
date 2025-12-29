// ==UserScript==
// @name         Offers Camp Collector
// @namespace    https://offers.camp
// @version      0.1
// @description  Offers Camp unified offers collector shell
// @match        https://*/*
// @run-at       document-start
// @require      http://localhost:5173/offers-camp.js?v=0.11
// @resource     ccOffersCss http://localhost:5173/offers-camp.css?v=0.11
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      localhost
// @connect      functions.americanexpress.com
// ==/UserScript==

(function () {
  if (typeof GM_getResourceText === "function" && typeof GM_addStyle === "function") {
    const css = GM_getResourceText("ccOffersCss");
    if (css) {
      GM_addStyle(css);
    }
  }
})();
