import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { configuratorSubmissionSchema } from "@/lib/validations/configurator";
import { ConfiguratorService } from "@/lib/services/configurator.service";

/**
 * POST /api/public/configurator/submit
 *
 * Public endpoint for configurator submissions. No authentication required.
 * Rate-limited in production (via middleware or Vercel edge config).
 *
 * Flow:
 * 1. Validate input
 * 2. Verify configurator exists and is published
 * 3. Calculate pricing via pricing engine
 * 4. Create submission + contact + lead
 * 5. Return confirmation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parsed = configuratorSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Ongeldige invoer",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { configuratorId, ...input } = body;

    if (!configuratorId) {
      return NextResponse.json(
        { error: "Configurator ID is verplicht" },
        { status: 400 }
      );
    }

    // Verify the configurator exists and is published
    const configurator = await db.configurator.findFirst({
      where: {
        id: configuratorId,
        status: "PUBLISHED",
        isPublic: true,
      },
    });

    if (!configurator) {
      return NextResponse.json(
        { error: "Configurator niet gevonden of niet gepubliceerd" },
        { status: 404 }
      );
    }

    // Process submission using a system-level service context
    const service = new ConfiguratorService({
      workspaceId: configurator.workspaceId,
      userId: "system",
      role: "OWNER" as any,
      permissions: null,
    });

    const result = await service.processSubmission(configuratorId, parsed.data);

    return NextResponse.json(
      {
        success: true,
        submissionId: result.submission.id,
        pricing: {
          subtotal: result.pricing.subtotal,
          taxAmount: result.pricing.taxAmount,
          total: result.pricing.total,
          lineItems: result.pricing.lineItems,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[configurator/submit]", error);
    return NextResponse.json(
      { error: "Er is een interne fout opgetreden" },
      { status: 500 }
    );
  }
}
