import { createHash } from "node:crypto";
import { createPublicFormSubmission } from "@digitify/api";
import { prisma } from "@digitify/db";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/http-security";

type RouteContext = { params: Promise<{ publicKey: string }> };

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function getPublishedForm(publicKey: string) {
  return prisma.leadForm.findFirst({
    where: { publicKey, status: "PUBLISHED" },
    select: { id: true, name: true, publicKey: true, fields: true, createdById: true },
  });
}

export async function GET(_request: Request, { params }: RouteContext) {
  const form = await getPublishedForm((await params).publicKey);
  if (!form) return NextResponse.json({ error: "Formulier niet gevonden." }, { status: 404 });
  const { createdById: _createdById, ...publicForm } = form;
  return NextResponse.json({ form: publicForm });
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const form = await getPublishedForm((await params).publicKey);
    if (!form) return NextResponse.json({ error: "Formulier niet gevonden." }, { status: 404 });

    const limiter = await enforceRateLimit(request, {
      key: `public-form:${form.id}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
      message: "Te veel aanvragen. Probeer later opnieuw.",
    });
    if (limiter) return limiter;

    const body = (await request.json()) as Record<string, unknown>;
    if (String(body.website ?? "").trim()) return NextResponse.json({ success: true });
    const data = {
      name: String(body.name ?? "").trim().slice(0, 120),
      email: String(body.email ?? "").trim().toLowerCase().slice(0, 180),
      company: String(body.company ?? "").trim().slice(0, 180),
      phone: String(body.phone ?? "").trim().slice(0, 50),
      message: String(body.message ?? "").trim().slice(0, 4000),
    };
    const fields = Array.isArray(form.fields) ? form.fields as Array<{ key?: string; required?: boolean }> : [];
    for (const field of fields) {
      if (field.required && !data[field.key as keyof typeof data]) {
        return NextResponse.json({ error: "Vul alle verplichte velden in." }, { status: 400 });
      }
    }
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
      return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
    }

    const fingerprint = hash(`${form.id}|${data.email}|${data.company}|${data.name}`.toLowerCase());
    const submission = await createPublicFormSubmission(prisma, {
      formId: form.id,
      formPublicKey: form.publicKey,
      workspaceId: form.createdById,
      fingerprint,
      data,
    });
    if (!submission) return NextResponse.json({ error: "Deze aanvraag is al ontvangen." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Aanvraag kon niet worden opgeslagen." }, { status: 500 });
  }
}
