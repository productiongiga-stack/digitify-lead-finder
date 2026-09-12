import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

/**
 * POST /api/auth/register
 *
 * Creates a new user account + default workspace.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check if user exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Dit e-mailadres is al in gebruik" },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await hash(password, 12);
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        emailVerified: new Date(),
      },
    });

    // Create default workspace
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "workspace";

    // Ensure unique slug
    let finalSlug = slug;
    let attempt = 0;
    while (await db.workspace.findUnique({ where: { slug: finalSlug } })) {
      attempt++;
      finalSlug = `${slug}-${attempt}`;
    }

    const workspace = await db.workspace.create({
      data: {
        name: `${name}'s Workspace`,
        slug: finalSlug,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });

    // Create default pipeline
    await db.pipeline.create({
      data: {
        workspaceId: workspace.id,
        name: "Sales",
        isDefault: true,
        stages: {
          create: [
            { name: "Nieuw", color: "#6366f1", position: 0 },
            { name: "Contact gehad", color: "#8b5cf6", position: 1 },
            { name: "Offerte gestuurd", color: "#f59e0b", position: 2 },
            { name: "Gewonnen", color: "#10b981", position: 3, isWon: true },
            { name: "Verloren", color: "#ef4444", position: 4, isLost: true },
          ],
        },
      },
    });

    // Default availability (Mon-Fri 9-17)
    for (let day = 1; day <= 5; day++) {
      await db.availabilityRule.create({
        data: {
          workspaceId: workspace.id,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "17:00",
        },
      });
    }

    return NextResponse.json(
      { success: true, userId: user.id, workspaceSlug: workspace.slug },
      { status: 201 }
    );
  } catch (error) {
    console.error("[register]", error);
    return NextResponse.json(
      { error: "Er is een interne fout opgetreden" },
      { status: 500 }
    );
  }
}
