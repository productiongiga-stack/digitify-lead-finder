import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceFromHeader } from "@/lib/api-auth";
import { ConfiguratorService } from "@/lib/services/configurator.service";
import { createConfiguratorVersionSchema } from "@/lib/validations/configurator";

/**
 * POST /api/configurators/[id]/versions
 *
 * Create a new version of a configurator.
 * Authenticated endpoint — requires workspace context.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { workspaceId, userId, role, permissions } =
      await requireWorkspaceFromHeader(request);

    const body = await request.json();
    const parsed = createConfiguratorVersionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Ongeldige invoer",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const service = new ConfiguratorService({
      workspaceId,
      userId,
      role,
      permissions,
    });

    const version = await service.createVersion(id, parsed.data);

    return NextResponse.json(version, { status: 201 });
  } catch (error: any) {
    if (error.statusCode === 404) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[versions/create]", error);
    return NextResponse.json(
      { error: "Er is een interne fout opgetreden" },
      { status: 500 }
    );
  }
}
