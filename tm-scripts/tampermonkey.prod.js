// ==UserScript==
// @name         Offers Camp Collector (Prod)
// @namespace    https://offers.camp
// @version      0.1
// @description  Offers Camp unified offers collector shell (prod)
// @match        https://*/*
// @run-at       document-start
// @require      https://tm.offers.camp/offers-config.js?v=0.11
// @require      https://tm.offers.camp/offers-utils.js?v=0.11
// @require      https://tm.offers.camp/offers-auth.js?v=0.11
// @require      https://tm.offers.camp/providers/amex.js?v=0.11
// @require      https://tm.offers.camp/offers-core.js?v=0.11
// @resource     ccOffersCss https://tm.offers.camp/offers-camp.css?v=0.11
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.offers.camp
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
