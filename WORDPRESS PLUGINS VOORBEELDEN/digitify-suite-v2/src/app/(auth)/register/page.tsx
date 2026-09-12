"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Register page — create a new account.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Registratie mislukt");
        return;
      }

      // Auto-login after registration
      const { signIn } = await import("next-auth/react");
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      router.push("/");
      router.refresh();
    } catch {
      setError("Er is een fout opgetreden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            D
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            Account aanmaken
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Start gratis met Digitify Suite
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Naam
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Jouw naam"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              E-mailadres
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="jouw@email.be"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Wachtwoord
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Minimaal 8 tekens"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Account aanmaken..." : "Account aanmaken"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Al een account?{" "}
          <Link href="/login" className="text-indigo-600 hover:underline">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
