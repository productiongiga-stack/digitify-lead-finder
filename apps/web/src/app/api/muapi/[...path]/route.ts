import { NextRequest, NextResponse } from "next/server";
import { loadUserMuapiKey } from "@digitify/api/src/lib/muapi-key";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/http-security";

const MUAPI_ORIGIN = "https://api.muapi.ai";

const ALLOWED_PATH_PREFIXES = [
  "api/v1/models",
  "api/v1/balance",
  "api/v1/upload_file",
  "api/v1/",
] as const;

function isAllowedMuapiPath(pathSegments: string[]): boolean {
  const normalized = pathSegments.join("/").replace(/^\/+/, "");
  return ALLOWED_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
}

async function proxyMuapi(req: NextRequest, pathSegments: string[]) {
  const rateLimited = await enforceRateLimit(req, {
    key: "muapi-proxy",
    limit: 60,
    windowMs: 60_000,
    message: "Te veel MuAPI-proxyverzoeken. Probeer later opnieuw.",
  });
  if (rateLimited) return rateLimited;

  if (!isAllowedMuapiPath(pathSegments)) {
    return NextResponse.json({ error: "MuAPI-pad niet toegestaan." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  }

  const apiKey = await loadUserMuapiKey(prisma, user.id);
  if (!apiKey) {
    return NextResponse.json(
      { error: "MuAPI API-key niet ingesteld. Voeg je sleutel toe in Instellingen → Creative Studio." },
      { status: 412 },
    );
  }

  const targetPath = pathSegments.join("/");
  const url = new URL(req.url);
  const targetUrl = `${MUAPI_ORIGIN}/${targetPath}${url.search}`;

  const headers = new Headers();
  headers.set("x-api-key", apiKey);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const response = await fetch(targetUrl, init);
  const body = await response.arrayBuffer();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyMuapi(req, path);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyMuapi(req, path);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyMuapi(req, path);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyMuapi(req, path);
}
