(function () {
  if (window.__digitifyChatbotLoaderStarted) return;
  window.__digitifyChatbotLoaderStarted = true;

  var currentScript = document.currentScript;
  var leadsBase = (currentScript && currentScript.getAttribute("data-leads-url")) || "https://leads.digitify.be";
  leadsBase = String(leadsBase).replace(/\/+$/, "");

  var path = window.location.pathname || "/";
  var excludeRaw = currentScript ? currentScript.getAttribute("data-exclude") : "";
  if (excludeRaw) {
    var patterns = excludeRaw.split(",").map(function (part) {
      return part.trim();
    }).filter(Boolean);
    for (var i = 0; i < patterns.length; i++) {
      var pattern = patterns[i];
      if (path === pattern || path.indexOf(pattern + "/") === 0) return;
    }
  }

  function resolveChatbotConfig(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.chatbot && typeof payload.chatbot === "object") return payload.chatbot;
    return payload;
  }

  function mountWidget(cfg) {
    var chatbot = resolveChatbotConfig(cfg);
    if (!chatbot) {
      console.warn("[Digitify] Chatbot kon niet laden: lege embed-config.");
      return;
    }
    if (!chatbot.enabled) return;
    if (!chatbot.tenant) {
      console.warn("[Digitify] Chatbot kon niet laden: tenant ontbreekt in embed-config.");
      return;
    }
    if (window.__digitifyChatbotWidgetLoaded) return;

    var ds = currentScript ? currentScript.dataset : {};
    var script = document.createElement("script");
    script.src = leadsBase + "/chatbot/widget.js";
    script.async = true;
    script.dataset.company = ds.company || chatbot.company || "Digitify Contact";
    script.dataset.color = ds.color || chatbot.color || "#f9ae5a";
    script.dataset.position = ds.position || chatbot.position || "bottom-right";
    script.dataset.welcome = ds.welcome || chatbot.welcome || "Hallo! Hoe kan ik u helpen?";
    if (ds.askName != null && ds.askName !== "") {
      script.dataset.askName = ds.askName;
    } else {
      script.dataset.askName = chatbot.askName ? "1" : "0";
    }
    if (ds.autoOpen != null && ds.autoOpen !== "") {
      script.dataset.autoOpen = ds.autoOpen;
    } else {
      script.dataset.autoOpen = String(chatbot.autoOpen == null ? 0 : chatbot.autoOpen);
    }
    script.dataset.tenant = chatbot.tenant;
    (document.body || document.documentElement).appendChild(script);
  }

  function appendWhenReady() {
    fetch(leadsBase + "/api/public/chatbot/embed-config", { credentials: "omit" })
      .then(function (response) {
        if (!response.ok) {
          console.warn("[Digitify] Chatbot embed-config mislukt:", response.status);
          return null;
        }
        return response.json();
      })
      .then(mountWidget)
      .catch(function (error) {
        console.warn("[Digitify] Chatbot kon niet laden:", error);
      });
  }

  if (document.body) appendWhenReady();
  else document.addEventListener("DOMContentLoaded", appendWhenReady, { once: true });
})();
