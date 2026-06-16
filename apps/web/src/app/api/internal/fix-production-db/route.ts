import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { runProductionSchemaCatchUp } from "@digitify/api/src/lib/production-schema-catch-up";
import { log } from "@digitify/api/src/lib/logger";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function isBootstrapEnabled() {
  const token = process.env.BOOTSTRAP_DB_TOKEN?.trim();
  if (!token) return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_BOOTSTRAP_DB !== "1") {
    return false;
  }
  return true;
}

function verifyBootstrapToken(provided: string | null) {
  const expected = process.env.BOOTSTRAP_DB_TOKEN?.trim();
  if (!expected || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!isBootstrapEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const token = request.headers.get("x-bootstrap-token");
    if (!verifyBootstrapToken(token)) {
      log.security.warn("Bootstrap DB route: unauthorized attempt");
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
      const email = body.email?.trim().toLowerCase();
      const password = body.password?.trim();
      if (!email || !password) {
        return NextResponse.json({ error: "email_and_password_required" }, { status: 400 });
      }
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
      log.security.info("Bootstrap DB route: owner password reset", { email, userId: user.id });
    }

    return NextResponse.json({ ok: true, catchUp, user, schemaFixed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
