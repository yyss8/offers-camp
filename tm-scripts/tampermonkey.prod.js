// ==UserScript==
// @name         Offers Camp Collector (Prod)
// @namespace    https://offers.camp
// @version      0.1
// @description  Offers Camp unified offers collector shell (prod)
// @match        https://global.americanexpress.com/*
// @match        https://online.citi.com/US/ag/products-offers/merchantoffers*
// @match        https://secure.chase.com/web/auth/dashboard*
// @run-at       document-start
// @require      https://tm.offers.camp/js/offers-config.js?v=0.01
// @require      https://tm.offers.camp/js/offers-utils.js?v=0.01
// @require      https://tm.offers.camp/js/offers-settings.js?v=0.01
// @require      https://tm.offers.camp/js/offers-auth.js?v=0.01
// @require      https://tm.offers.camp/js/providers/amex.js?v=0.01
// @require      https://tm.offers.camp/js/providers/citi.js?v=0.01
// @require      https://tm.offers.camp/js/providers/chase.js?v=0.01
// @require      https://tm.offers.camp/js/offers-core.js?v=0.01
// @resource     ccOffersCss https://tm.offers.camp/css/offers-camp.css?v=0.01
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
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
