// ==UserScript==
// @name         Offers Camp Collector (Dev)
// @namespace    https://offers.camp
// @version      0.1
// @description  Offers Camp unified offers collector shell
// @match        https://global.americanexpress.com/*
// @match        https://online.citi.com/US/ag/products-offers/merchantoffers*
// @match        https://secure.chase.com/web/auth/dashboard*
// @run-at       document-start
// @require      http://localhost:5173/tm/js/offers-config.js?v=0.11
// @require      http://localhost:5173/tm/js/offers-utils.js?v=0.11
// @require      http://localhost:5173/tm/js/offers-auth.js?v=0.11
// @require      http://localhost:5173/tm/js/providers/amex.js?v=0.11
// @require      http://localhost:5173/tm/js/providers/citi.js?v=0.11
// @require      http://localhost:5173/tm/js/providers/chase.js?v=0.11
// @require      http://localhost:5173/tm/js/offers-core.js?v=0.11
// @resource     ccOffersCss http://localhost:5173/tm/css/offers-camp.css?v=0.11
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
