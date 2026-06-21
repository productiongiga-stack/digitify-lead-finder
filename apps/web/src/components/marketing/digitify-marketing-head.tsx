const CRITICAL_CSS = [
  "html.digitify-shell-booting .digitify-site-header{opacity:0}",
  "html.digitify-page-ready .digitify-site-header{opacity:1;transition:opacity .35s ease .08s}",
  "body.digitify-leads-body{padding-top:var(--digitify-site-offset,65px);background:#fff9f2;color:#0a0a0a}",
  "body.digitify-leads-body .digitify-page-content{opacity:0;transition:opacity .42s ease .04s}",
  "html.digitify-page-ready body.digitify-leads-body .digitify-page-content{opacity:1}",
  ".digitify-site-header{position:fixed;top:0;left:0;right:0;z-index:1000;width:100%}",
  ".digitify-mobile-nav{position:fixed;inset:0;z-index:2000;pointer-events:none;visibility:hidden}",
  ".digitify-mobile-nav__panel{transform:translateX(100%)}",
  ".digitify-mobile-nav.is-open{visibility:visible;pointer-events:auto}",
].join("");

const BOOT_SCRIPT = `(function(){var r=document.documentElement;r.classList.add("digitify-shell-booting");function m(){if(!document.body)return;document.body.classList.add("digitify-leads-body","theme-light");}if(document.body)m();else document.addEventListener("DOMContentLoaded",m,{once:true});})();`;

/** Server-rendered shell assets so marketing pages don't FOUC before client hydration. */
export function DigitifyMarketingHead() {
  return (
    <>
      <link rel="stylesheet" href="/digitify/digitify-shell.css?v=3" />
      <link rel="stylesheet" href="/digitify/digitify-header-deck.css?v=5" />
      <link rel="stylesheet" href="/digitify/digitify-header-ecosystem.css?v=4" />
      <link rel="stylesheet" href="/digitify/digitify-mobile-drawer.css?v=1" />
      <link rel="stylesheet" href="/digitify/digitify-footer.css?v=1" />
      <link rel="stylesheet" href="/digitify/digitify-leads-chrome.css?v=6" />
      <style id="digitifyCriticalCssLeads" dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
      <script id="digitifyMarketingBoot" dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
    </>
  );
}
