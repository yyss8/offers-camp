(() => {
  const OffersCamp = window.OffersCamp = window.OffersCamp || {};

  OffersCamp.utils = {
    nowIso() {
      return new Date().toISOString();
    }
  };
})();
