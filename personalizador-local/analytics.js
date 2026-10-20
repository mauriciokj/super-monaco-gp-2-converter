/* Optional production-only aggregate metrics. Local/offline use makes no requests. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else factory(root);
})(typeof window !== 'undefined' ? window : null, function setupMetrics(win) {
  'use strict';
  if (!win || !win.document || !win.location) return false;
  const config = win.CONVERTER_ANALYTICS_CONFIG;
  if (!config || config.enabled !== true || win.location.protocol !== 'https:') return false;
  let canonical;
  try {
    canonical = new URL(config.canonicalUrl);
    if (canonical.protocol !== 'https:' || canonical.origin !== win.location.origin ||
        canonical.username || canonical.password || canonical.search || canonical.hash ||
        /^(localhost|127\.|\[::1\])/.test(canonical.hostname) ||
        win.location.pathname !== canonical.pathname) return false;
  } catch (_) { return false; }
  const canonicalUrl = canonical.href;
  const customEvents = config.customEvents === true;
  function safeProviderContext() {
    try {
      // The provider adds referrer and saved attribution after its middleware.
      // Preserve other apps' storage; skip measurement without parsing/transmitting attribution.
      const referrer = win.document.referrer || '';
      return ['', 'https://flowofdevelopment.com/', 'https://fir-d4471.web.app/'].includes(referrer) &&
        win.localStorage.getItem('__va_attribution') === null;
    } catch (_) { return false; }
  }
  if (!safeProviderContext()) return false;
  try {
    win.va = win.va || function () { (win.vaq = win.vaq || []).push(Array.from(arguments)); };
    win.va('beforeSend', function (event) {
      if (!safeProviderContext()) return null;
      if (!event || (event.type !== 'pageview' && event.type !== 'event')) return null;
      if (event.type === 'event') {
        if (!customEvents || !event.payload || event.payload.name !== 'smgp2_conversion_completed') return null;
        return { type: 'event', url: canonicalUrl, payload: { name: 'smgp2_conversion_completed' } };
      }
      return { type: 'pageview', url: canonicalUrl };
    });
    const script = win.document.createElement('script');
    script.src = '/_vercel/insights/script.js';
    script.defer = true;
    script.setAttribute('data-disable-auto-track', 'true');
    script.referrerPolicy = 'no-referrer';
    win.document.head.appendChild(script);
    win.va('pageview', { path: canonical.pathname, route: canonical.pathname });
    if (customEvents) {
      win.addEventListener('smgp2:conversion-completed', function () {
        try { win.va('event', { name: 'smgp2_conversion_completed' }); } catch (_) {}
      });
    }
    return true;
  } catch (_) { return false; }
});
