"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";

type BookingPayload = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  date: string;
  duration: number;
  status: string;
  location: string | null;
  canManage: boolean;
  eventType: { name: string; slug: string } | null;
};

export default function ManageBookingPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [booking, setBooking] = useState<BookingPayload | null>(null);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/public/bookings/manage/${encodeURIComponent(token)}`);
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Boeking niet gevonden.");
      return;
    }
    setBooking(data);
  }

  useEffect(() => {
    load();
  }, [token]);

  async function submit(action: "cancel" | "reschedule") {
    setMessage("");
    const response = await fetch(`/api/public/bookings/manage/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, date: date ? new Date(date).toISOString() : undefined }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Wijziging opgeslagen." : data.error || "Wijziging mislukt.");
    if (response.ok) await load();
  }

  return (
    <main className="min-h-screen bg-[#f3f1ee] px-4 py-8 text-slate-950">
      <section className="mx-auto max-w-xl rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <CalendarClock className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Boeking beheren</h1>
        {loading ? <p className="mt-4 text-sm text-slate-500">Laden...</p> : null}
        {message ? <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm">{message}</p> : null}
        {booking ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border p-4 text-sm">
              <p className="font-medium">{booking.eventType?.name || "Afspraak"}</p>
              <p className="mt-1 text-slate-500">{new Date(booking.date).toLocaleString("nl-BE")} · {booking.duration} min</p>
              <p className="mt-1 text-slate-500">{booking.location || "Locatie volgt"}</p>
              <p className="mt-1 text-slate-500">Status: {booking.status}</p>
            </div>
            {booking.canManage ? (
              <>
                <label className="block text-sm font-medium">
                  Nieuw moment
                  <input
                    type="datetime-local"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="mt-2 h-11 w-full rounded-2xl border px-3"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => submit("reschedule")} className="inline-flex h-11 items-center gap-2 rounded-full bg-amber-400 px-4 text-sm font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Verplaatsen aanvragen
                  </button>
                  <button type="button" onClick={() => submit("cancel")} className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold text-red-700">
                    <XCircle className="h-4 w-4" />
                    Annuleren
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Deze boeking kan niet meer publiek aangepast worden.</p>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
