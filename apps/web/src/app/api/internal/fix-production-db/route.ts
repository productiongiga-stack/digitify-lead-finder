import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { scryptSync, randomBytes } from "crypto";
import { runProductionSchemaCatchUp } from "@digitify/api/src/lib/production-schema-catch-up";

const FIX_TOKEN = "bootstrap-owner-20260607-digitify";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("x-bootstrap-token");
    if (token !== FIX_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      resetPassword?: boolean;
    };

    const catchUp = await runProductionSchemaCatchUp(prisma);

    let user: { id: string; email: string; role: string; name: string | null } | null = null;
    if (body.resetPassword) {
      const email = body.email?.trim().toLowerCase() || "contact@digitify.be";
      const password = body.password?.trim() || "DigitifyContact2026!";
      if (password.length < 12) {
        return NextResponse.json({ error: "invalid_password" }, { status: 400 });
      }

      user = await prisma.user.update({
        where: { email },
        data: {
          passwordHash: hashPassword(password),
          emailVerified: new Date(),
          role: "OWNER",
        },
        select: { id: true, email: true, role: true, name: true },
      });
    }

    return NextResponse.json({ ok: true, catchUp, user, schemaFixed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
