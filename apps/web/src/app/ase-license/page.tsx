"use client";

import { FormEvent, useState } from "react";

export default function AseLicenseRequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setFeedback("");
    try {
      const res = await fetch("/api/public/ase-license/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, siteUrl, message }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setFeedback(body?.message || body?.error || "Aanvraag mislukt");
        return;
      }
      setStatus("ok");
      setFeedback(body?.message || "Aanvraag ontvangen. Je ontvangt de key via Digitify.");
      setMessage("");
    } catch {
      setStatus("error");
      setFeedback("Netwerkfout");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(165deg, #fff8f0 0%, #ffffff 45%, #f8fafc 100%)",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "56px 20px 80px" }}>
        <p style={{ color: "#9a6b2f", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 8 }}>
          DIGITIFY · AI BUILDER
        </p>
        <h1 style={{ fontSize: 30, margin: "0 0 12px", color: "#1f2937", letterSpacing: "-0.02em" }}>
          License key aanvragen
        </h1>
        <p style={{ color: "#475569", lineHeight: 1.55, margin: 0 }}>
          Vraag een license key aan voor de Digitify AI Builder. Na goedkeuring activeer je de key in
          WordPress → Digitify AI Webbuilder → Settings. Zonder geldige key blijft de editor open,
          maar kun je niets bewerken of AI gebruiken.
        </p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 28 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#334155" }}>Naam</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#334155" }}>E-mail</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#334155" }}>Website URL</span>
            <input
              required
              type="url"
              placeholder="https://voorbeeld.be"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#334155" }}>Bericht (optioneel)</span>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                resize: "vertical",
              }}
            />
          </label>
          <button
            type="submit"
            disabled={status === "loading"}
            style={{
              padding: "13px 16px",
              borderRadius: 10,
              border: 0,
              background: "#ffaf51",
              color: "#1f2937",
              fontWeight: 650,
              cursor: status === "loading" ? "wait" : "pointer",
              opacity: status === "loading" ? 0.75 : 1,
            }}
          >
            {status === "loading" ? "Versturen…" : "Vraag license aan"}
          </button>
        </form>
        {feedback ? (
          <p
            role="status"
            style={{
              marginTop: 18,
              color: status === "ok" ? "#166534" : "#b91c1c",
              lineHeight: 1.45,
            }}
          >
            {feedback}
          </p>
        ) : null}
      </div>
    </main>
  );
}
