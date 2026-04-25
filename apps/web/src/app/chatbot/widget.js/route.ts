import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const script = `
(function () {
  if (window.__digitifyChatbotWidgetLoaded) return;
  window.__digitifyChatbotWidgetLoaded = true;

  var currentScript = document.currentScript;
  if (!currentScript) {
    var scripts = document.getElementsByTagName("script");
    currentScript = scripts[scripts.length - 1];
  }

  var dataset = currentScript ? currentScript.dataset : {};
  var position = dataset.position === "bottom-left" ? "bottom-left" : "bottom-right";
  var autoOpen = Number(dataset.autoOpen || "0");
  var tenant = (dataset.tenant || "").trim();

  function parseBoolean(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    var normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].indexOf(normalized) > -1) return true;
    if (["0", "false", "no", "off"].indexOf(normalized) > -1) return false;
    return fallback;
  }

  function mount(remote) {
    var company = dataset.company || (remote && remote.companyName) || "Digitify";
    var color = dataset.color || (remote && remote.primaryColor) || "#6366f1";
    var avatarUrl = dataset.avatar || (remote && remote.avatarUrl) || "";
    var askNameRemote = !!(remote && remote.askNameBeforeChat);
    var askName = parseBoolean(dataset.askName, askNameRemote);

    var iframeUrl = new URL("${origin}/embed/chatbot");
    if (dataset.company) iframeUrl.searchParams.set("company", dataset.company);
    if (dataset.color) iframeUrl.searchParams.set("color", dataset.color);
    if (dataset.welcome) iframeUrl.searchParams.set("welcome", dataset.welcome);
    if (askName) iframeUrl.searchParams.set("askName", "1");
    if (tenant) iframeUrl.searchParams.set("tenant", tenant);

    var host = document.createElement("div");
    host.setAttribute("data-digitify-chatbot", "true");
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483000";

    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = [
      ":host { all: initial; }",
      "*, *::before, *::after { box-sizing: border-box; }",
      ".digitify-root {",
      "  all: initial;",
      "  position: fixed;",
      "  bottom: 24px;",
      "  display: flex;",
      "  flex-direction: column;",
      "  gap: 12px;",
      "  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;",
      "  pointer-events: auto;",
      "}",
      ".digitify-root.right { right: 24px; align-items: flex-end; }",
      ".digitify-root.left { left: 24px; align-items: flex-start; }",
      ".digitify-panel {",
      "  width: 368px;",
      "  height: 610px;",
      "  max-width: calc(100vw - 28px);",
      "  max-height: min(610px, calc(100vh - 108px));",
      "  border: 0;",
      "  border-radius: 20px;",
      "  background: #fff;",
      "  box-shadow: 0 28px 68px rgba(15, 23, 42, 0.26);",
      "  display: none;",
      "}",
      ".digitify-root.open .digitify-panel { display: block; }",
      ".digitify-bubble {",
      "  width: 56px;",
      "  height: 56px;",
      "  border: 0;",
      "  border-radius: 999px;",
      "  cursor: pointer;",
      "  background: " + color + ";",
      "  color: #fff;",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  box-shadow: 0 16px 42px rgba(15, 23, 42, 0.28);",
      "  overflow: hidden;",
      "  font-weight: 700;",
      "  font-size: 18px;",
      "}",
      ".digitify-bubble:focus-visible {",
      "  outline: 2px solid #fff;",
      "  outline-offset: 2px;",
      "}",
      ".digitify-avatar { width: 100%; height: 100%; object-fit: cover; display: block; }",
      "@media (max-width: 640px) {",
      "  .digitify-root { bottom: 12px; }",
      "  .digitify-root.right { right: 12px; }",
      "  .digitify-root.left { left: 12px; }",
      "  .digitify-panel { width: calc(100vw - 24px); max-height: min(78vh, 590px); }",
      "}",
    ].join("\\n");

    var root = document.createElement("div");
    root.className = "digitify-root " + (position === "bottom-left" ? "left" : "right");

    var panel = document.createElement("iframe");
    panel.src = iframeUrl.toString();
    panel.className = "digitify-panel";
    panel.setAttribute("title", company + " chatbot");
    panel.setAttribute("loading", "lazy");

    var bubble = document.createElement("button");
    bubble.type = "button";
    bubble.className = "digitify-bubble";
    bubble.setAttribute("aria-label", "Open chatbot");
    bubble.setAttribute("aria-expanded", "false");

    if (avatarUrl) {
      var img = document.createElement("img");
      img.src = avatarUrl;
      img.alt = company;
      img.className = "digitify-avatar";
      bubble.appendChild(img);
    } else {
      bubble.textContent = (company || "D").charAt(0).toUpperCase();
    }

    function setOpen(open) {
      if (open) root.classList.add("open");
      else root.classList.remove("open");
      bubble.setAttribute("aria-expanded", String(open));
    }

    bubble.addEventListener("click", function () {
      setOpen(!root.classList.contains("open"));
    });

    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });

    root.appendChild(panel);
    root.appendChild(bubble);
    shadow.appendChild(style);
    shadow.appendChild(root);

    if (document.body) {
      document.body.appendChild(host);
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        document.body.appendChild(host);
      }, { once: true });
    }

    if (autoOpen > 0) {
      window.setTimeout(function () {
        setOpen(true);
      }, autoOpen * 1000);
    }
  }

  fetch("${origin}/api/public/chatbot/settings" + (tenant ? ("?tenant=" + encodeURIComponent(tenant)) : ""))
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (remote) { mount(remote); })
    .catch(function () { mount(null); });
})();
  `.trim();

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
