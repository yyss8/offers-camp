// ==UserScript==
// @name         Offers Camp Collector
// @namespace    https://offers.camp
// @version      0.05
// @description  Offers Camp unified offers collector shell
// @downloadURL  https://tm.offers.camp/offers-camp.user.js
// @updateURL    https://tm.offers.camp/offers-camp.user.js
// @match        https://global.americanexpress.com/dashboard*
// @match        https://global.americanexpress.com/offers*
// @match        https://online.citi.com/US/ag/*
// @match        https://secure.chase.com/web/auth/dashboard*
// @author       yyss8
// @run-at       document-start
// @require      https://tm.offers.camp/js/offers-config.js?v=0.05
// @require      https://tm.offers.camp/js/offers-utils.js?v=0.05
// @require      https://tm.offers.camp/js/offers-settings.js?v=0.05
// @require      https://tm.offers.camp/js/offers-auth.js?v=0.05
// @require      https://tm.offers.camp/js/providers/amex.js?v=0.05
// @require      https://tm.offers.camp/js/providers/citi.js?v=0.05
// @require      https://tm.offers.camp/js/providers/chase.js?v=0.05
// @require      https://tm.offers.camp/js/offers-core.js?v=0.05
// @resource     ccOffersCss https://tm.offers.camp/css/offers-camp.css?v=0.05
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      localhost
// @connect      127.0.0.1
// @connect      offers.camp
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
