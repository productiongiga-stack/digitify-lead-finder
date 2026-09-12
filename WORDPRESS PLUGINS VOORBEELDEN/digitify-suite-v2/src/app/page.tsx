import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  FileText,
  Users,
  SlidersHorizontal,
  Zap,
  Shield,
  Globe,
} from "lucide-react";

/**
 * Landing page — public homepage at /.
 * If user is already logged in, redirects to their first workspace.
 */
export default async function LandingPage() {
  // If logged in, redirect to app
  const session = await auth();
  if (session?.user?.id) {
    const membership = await db.workspaceMember.findFirst({
      where: { userId: session.user.id },
      include: { workspace: { select: { slug: true } } },
      orderBy: { joinedAt: "asc" },
    });
    if (membership) {
      redirect(`/${membership.workspace.slug}`);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
              D
            </div>
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              Digitify Suite
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              Inloggen
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Gratis starten
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
            <Zap className="h-3.5 w-3.5" />
            Het platform voor Belgische service businesses
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight text-gray-900 sm:text-6xl">
            Alles wat je nodig hebt.{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Eén platform.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-500">
            CRM, offertes, facturen, planning, configurators en meer — gebouwd
            voor agencies, freelancers en service bedrijven in België.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200"
            >
              Gratis starten
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Inloggen
            </Link>
          </div>
        </div>

        {/* App preview mockup */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-2xl shadow-gray-200/50">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center">
                <div className="mx-auto max-w-xs rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-400">
                  app.digitify.be/dashboard
                </div>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-0">
              {/* Sidebar mock */}
              <div className="col-span-3 border-r border-gray-200 bg-white p-4">
                <div className="mb-6 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-600" />
                  <div className="h-3 w-20 rounded bg-gray-200" />
                </div>
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className={`mb-1.5 flex items-center gap-2 rounded-md px-2 py-2 ${i === 0 ? "bg-indigo-50" : ""}`}
                  >
                    <div className={`h-4 w-4 rounded ${i === 0 ? "bg-indigo-300" : "bg-gray-200"}`} />
                    <div className={`h-2.5 rounded ${i === 0 ? "w-16 bg-indigo-300" : "w-14 bg-gray-200"}`} />
                  </div>
                ))}
              </div>
              {/* Content mock */}
              <div className="col-span-9 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="h-5 w-32 rounded bg-gray-300" />
                  <div className="h-8 w-24 rounded-lg bg-indigo-200" />
                </div>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="h-2 w-16 rounded bg-gray-200 mb-2" />
                      <div className="h-5 w-12 rounded bg-gray-300" />
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0">
                      <div className="h-8 w-8 rounded-full bg-gray-200" />
                      <div className="flex-1">
                        <div className="h-2.5 w-28 rounded bg-gray-200 mb-1.5" />
                        <div className="h-2 w-40 rounded bg-gray-100" />
                      </div>
                      <div className="h-5 w-16 rounded-full bg-gray-100" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Eén platform, alle tools
            </h2>
            <p className="mt-3 text-gray-500">
              Geen 10 losse tools meer. Alles zit erin.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Users,
                title: "CRM & Contacten",
                desc: "Beheer al je klanten, organisaties en interacties op één plek.",
              },
              {
                icon: FileText,
                title: "Offertes & Facturen",
                desc: "Professionele offertes met e-handtekening. Automatisch factureren.",
              },
              {
                icon: Calendar,
                title: "Planning & Booking",
                desc: "Laat klanten zelf inplannen. Sync met Google Calendar.",
              },
              {
                icon: SlidersHorizontal,
                title: "Configurator Builder",
                desc: "Bouw interactieve offerte-wizards met live prijsberekening.",
              },
              {
                icon: BarChart3,
                title: "Pipeline & Deals",
                desc: "Visueel salesproces. Van lead tot gewonnen deal.",
              },
              {
                icon: Globe,
                title: "Embed & Delen",
                desc: "Embed je configurators en booking op elke website.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex justify-center">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <blockquote className="text-xl font-medium leading-relaxed text-gray-900">
              &ldquo;Eindelijk één tool die alles doet. Geen Calendly, geen
              Teamleader, geen los factuurprogramma meer. Alles zit erin.&rdquo;
            </blockquote>
            <div className="mt-4">
              <p className="font-medium text-gray-900">Digitify Team</p>
              <p className="text-sm text-gray-500">Digital Agency, België</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 bg-indigo-600 py-16">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">
            Klaar om te starten?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-indigo-200">
            Maak gratis een account aan en ontdek hoe Digitify Suite je business
            kan versnellen.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              Gratis starten
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
              D
            </div>
            <span className="text-sm font-medium text-gray-500">
              Digitify Suite
            </span>
          </div>
          <p className="text-xs text-gray-400">
            © 2026 Digitify. Gemaakt in België.
          </p>
        </div>
      </footer>
    </div>
  );
}
