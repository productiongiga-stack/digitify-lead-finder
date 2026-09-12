/**
 * Digitify Suite — Embed Widget Loader
 *
 * This script is loaded on external websites to render Digitify
 * configurators and booking widgets via Shadow DOM isolation.
 *
 * Usage:
 *   <div id="digitify-configurator" data-slug="website-offerte"></div>
 *   <script src="https://app.digitify.be/embed/widget.js"
 *     data-type="configurator"
 *     data-slug="website-offerte"
 *     data-width="100%"
 *     data-height="700px"
 *   ></script>
 *
 * Features:
 *   - Shadow DOM CSS isolation
 *   - Auto-resize via postMessage
 *   - Event callbacks (submitted, step-changed)
 *   - Loading state
 */
(function () {
  "use strict";

  var BASE_URL = "https://app.digitify.be";

  // Find the script tag to read config
  var scripts = document.querySelectorAll('script[src*="widget.js"]');
  var script = scripts[scripts.length - 1];

  if (!script) return;

  var type = script.dataset.type || "configurator";
  var slug = script.dataset.slug;
  var width = script.dataset.width || "100%";
  var height = script.dataset.height || "700px";
  var hideHeader = script.dataset.hideHeader === "1";
  var hideFooter = script.dataset.hideFooter === "1";

  if (!slug) {
    console.error("[Digitify] Missing data-slug attribute on script tag");
    return;
  }

  // Build embed URL
  var embedPath =
    type === "booking"
      ? "/embed/booking/" + slug
      : "/embed/configurator/" + slug;

  var params = [];
  if (hideHeader) params.push("hideHeader=1");
  if (hideFooter) params.push("hideFooter=1");
  var embedUrl =
    BASE_URL + embedPath + (params.length ? "?" + params.join("&") : "");

  // Find or create container
  var containerId =
    type === "booking" ? "digitify-booking" : "digitify-configurator";
  var container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    script.parentNode.insertBefore(container, script.nextSibling);
  }

  // Create iframe inside shadow DOM for CSS isolation
  var shadow = container.attachShadow
    ? container.attachShadow({ mode: "open" })
    : container;

  // Loading state
  var wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:relative;width:" +
    width +
    ";max-width:100%;margin:0 auto;";

  var loader = document.createElement("div");
  loader.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#f8fafc;border-radius:12px;";
  loader.innerHTML =
    '<div style="width:32px;height:32px;border:3px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:digitify-spin 0.8s linear infinite"></div>';

  var style = document.createElement("style");
  style.textContent =
    "@keyframes digitify-spin{to{transform:rotate(360deg)}}";

  var iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.style.cssText =
    "width:100%;height:" +
    height +
    ";border:none;border-radius:12px;display:block;box-shadow:0 4px 24px rgba(0,0,0,0.06);";
  iframe.loading = "lazy";
  iframe.allow = "payment";
  iframe.title = "Digitify " + (type === "booking" ? "Booking" : "Configurator");

  wrapper.appendChild(style);
  wrapper.appendChild(loader);
  wrapper.appendChild(iframe);
  shadow.appendChild(wrapper);

  // Listen for messages from the iframe
  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "object") return;

    switch (event.data.type) {
      case "digitify:ready":
        // Remove loading state
        if (loader.parentNode) loader.parentNode.removeChild(loader);
        break;

      case "digitify:resize":
        // Auto-resize iframe height
        if (event.data.height) {
          iframe.style.height = event.data.height + "px";
        }
        break;

      case "digitify:configurator:submitted":
        // Dispatch custom event for the host page
        var customEvent = new CustomEvent("digitify:submitted", {
          detail: event.data.data,
        });
        container.dispatchEvent(customEvent);
        document.dispatchEvent(customEvent);
        break;
    }
  });

  // Send init message when iframe loads
  iframe.addEventListener("load", function () {
    iframe.contentWindow.postMessage({ type: "digitify:init" }, "*");
  });
})();
