import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceFromHeader } from "@/lib/api-auth";
import { ConfiguratorService } from "@/lib/services/configurator.service";

/**
 * POST /api/configurators/[id]/publish
 *
 * Publish a specific version of a configurator.
 * Body: { versionId: string }
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
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: "versionId is verplicht" },
        { status: 400 }
      );
    }

    const service = new ConfiguratorService({
      workspaceId,
      userId,
      role,
      permissions,
    });

    const result = await service.publishVersion(id, versionId);

    return NextResponse.json({
      success: true,
      configurator: result,
    });
  } catch (error: any) {
    if (error.statusCode === 404) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[configurator/publish]", error);
    return NextResponse.json(
      { error: "Er is een interne fout opgetreden" },
      { status: 500 }
    );
  }
}
