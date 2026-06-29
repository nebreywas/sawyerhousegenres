/**
 * Song Pages desktop app presentation mode — runs in <head> before paint.
 *
 * Listener Mode loads pages with ?songpagesApp=1. This script adds
 * `songpages-app-client` on <html> so template CSS can hide browser-only chrome.
 * External file (not inline) so compiled CSP `script-src 'self'` allows it.
 */
(function () {
  try {
    var params = new URLSearchParams(location.search);
    if (params.get("songpagesApp") === "1" || params.get("songpagesEmbed") === "1") {
      document.documentElement.classList.add("songpages-app-client");
    }
  } catch (e) {
    /* ignore */
  }
})();
