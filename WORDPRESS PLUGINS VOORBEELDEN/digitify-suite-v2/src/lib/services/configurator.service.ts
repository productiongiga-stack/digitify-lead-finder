import { BaseService } from "./base.service";
import { Permission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { NotFoundError } from "@/lib/errors";
import { calculatePrice } from "./pricing-engine.service";
import type {
  CreateConfiguratorInput,
  UpdateConfiguratorInput,
  CreateVersionInput,
  ConfiguratorSubmissionInput,
} from "@/lib/validations/configurator";
import { Prisma } from "@prisma/client";

// ============================================================================
// Configurator Service
//
// Manages the full configurator lifecycle:
// DRAFT → build steps/blocks/pricing → PUBLISHED → collect submissions
//
// Key responsibilities:
// - CRUD for configurators and versions
// - Publishing (swap active version)
// - Submission processing (calculate price, create CRM entities)
// ============================================================================

export class ConfiguratorService extends BaseService {
  /**
   * List all configurators for this workspace.
   */
  async list(filter?: { status?: string; page?: number; perPage?: number }) {
    this.assertPermission(Permission.CONFIGURATOR_VIEW);

    const page = filter?.page ?? 1;
    const perPage = filter?.perPage ?? 25;

    const where: Prisma.ConfiguratorWhereInput = {
      ...this.where,
      ...(filter?.status ? { status: filter.status as any } : {}),
    };

    const [configurators, total] = await Promise.all([
      this.db.configurator.findMany({
        where,
        include: {
          _count: { select: { submissions: true, versions: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.db.configurator.count({ where }),
    ]);

    return {
      configurators,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Get a configurator with its active version (steps, blocks, pricing rules).
   */
  async getById(id: string) {
    this.assertPermission(Permission.CONFIGURATOR_VIEW);

    const configurator = await this.db.configurator.findFirst({
      where: { id, ...this.where },
      include: {
        versions: {
          include: {
            steps: {
              include: {
                blocks: { orderBy: { position: "asc" } },
              },
              orderBy: { position: "asc" },
            },
            pricingRules: { orderBy: { position: "asc" } },
          },
          orderBy: { versionNumber: "desc" },
        },
        embedSettings: true,
        _count: { select: { submissions: true } },
      },
    });

    if (!configurator) throw new NotFoundError("Configurator", id);
    return configurator;
  }

  /**
   * Create a new configurator (starts as DRAFT, no version yet).
   */
  async create(input: CreateConfiguratorInput) {
    this.assertPermission(Permission.CONFIGURATOR_CREATE);

    const configurator = await this.db.configurator.create({
      data: {
        workspaceId: this.ctx.workspaceId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        brandColor: input.brandColor,
        brandLogoUrl: input.brandLogoUrl || undefined,
        backgroundColor: input.backgroundColor,
        accentColor: input.accentColor,
        fontFamily: input.fontFamily,
        settings: input.settings as any,
      },
    });

    await logActivity({
      workspaceId: this.ctx.workspaceId,
      userId: this.ctx.userId,
      type: "configurator.created",
      summary: `Configurator "${input.name}" aangemaakt`,
      entityType: "configurator",
      entityId: configurator.id,
    });

    return configurator;
  }

  /**
   * Update configurator metadata (name, branding, settings).
   */
  async update(id: string, input: UpdateConfiguratorInput) {
    this.assertPermission(Permission.CONFIGURATOR_EDIT);

    const existing = await this.db.configurator.findFirst({
      where: { id, ...this.where },
    });
    if (!existing) throw new NotFoundError("Configurator", id);

    const updated = await this.db.configurator.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.brandColor !== undefined && {
          brandColor: input.brandColor,
        }),
        ...(input.brandLogoUrl !== undefined && {
          brandLogoUrl: input.brandLogoUrl || null,
        }),
        ...(input.backgroundColor !== undefined && {
          backgroundColor: input.backgroundColor,
        }),
        ...(input.accentColor !== undefined && {
          accentColor: input.accentColor,
        }),
        ...(input.fontFamily !== undefined && {
          fontFamily: input.fontFamily,
        }),
        ...(input.settings !== undefined && {
          settings: input.settings as any,
        }),
      },
    });

    return updated;
  }

  /**
   * Create a new version of a configurator with steps, blocks, and pricing rules.
   * Automatically assigns the next version number.
   */
  async createVersion(configuratorId: string, input: CreateVersionInput) {
    this.assertPermission(Permission.CONFIGURATOR_EDIT);

    const configurator = await this.db.configurator.findFirst({
      where: { id: configuratorId, ...this.where },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!configurator) throw new NotFoundError("Configurator", configuratorId);

    const nextVersion =
      (configurator.versions[0]?.versionNumber ?? 0) + 1;

    const version = await this.db.configuratorVersion.create({
      data: {
        configuratorId,
        versionNumber: nextVersion,
        label: input.label ?? `v${nextVersion}`,
        steps: {
          create: input.steps.map((step, sIdx) => ({
            title: step.title,
            description: step.description,
            position: sIdx,
            icon: step.icon,
            condition: step.condition as any,
            blocks: {
              create: step.blocks.map((block, bIdx) => ({
                blockType: block.blockType as any,
                fieldKey: block.fieldKey,
                label: block.label,
                helpText: block.helpText,
                position: bIdx,
                config: block.config as any,
                isRequired: block.isRequired,
                validation: block.validation as any,
                condition: block.condition as any,
                pricingKeys: block.pricingKeys,
              })),
            },
          })),
        },
        pricingRules: {
          create: input.pricingRules.map((rule, rIdx) => ({
            key: rule.key,
            label: rule.label,
            ruleType: rule.ruleType as any,
            position: rIdx,
            config: rule.config as any,
            isOptional: rule.isOptional,
          })),
        },
      },
      include: {
        steps: {
          include: { blocks: { orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        },
        pricingRules: { orderBy: { position: "asc" } },
      },
    });

    return version;
  }

  /**
   * Publish a version: sets it as the active version and marks configurator as PUBLISHED.
   */
  async publishVersion(configuratorId: string, versionId: string) {
    this.assertPermission(Permission.CONFIGURATOR_EDIT);

    const configurator = await this.db.configurator.findFirst({
      where: { id: configuratorId, ...this.where },
    });
    if (!configurator) throw new NotFoundError("Configurator", configuratorId);

    // Verify version belongs to this configurator
    const version = await this.db.configuratorVersion.findFirst({
      where: { id: versionId, configuratorId },
    });
    if (!version) throw new NotFoundError("Version", versionId);

    const [updated] = await Promise.all([
      this.db.configurator.update({
        where: { id: configuratorId },
        data: {
          activeVersionId: versionId,
          status: "PUBLISHED",
          isPublic: true,
        },
      }),
      this.db.configuratorVersion.update({
        where: { id: versionId },
        data: { publishedAt: new Date() },
      }),
    ]);

    await logActivity({
      workspaceId: this.ctx.workspaceId,
      userId: this.ctx.userId,
      type: "configurator.published",
      summary: `Configurator "${configurator.name}" v${version.versionNumber} gepubliceerd`,
      entityType: "configurator",
      entityId: configuratorId,
    });

    return updated;
  }

  /**
   * Process a public submission: calculate price, create contact/lead, log activity.
   */
  async processSubmission(
    configuratorId: string,
    input: ConfiguratorSubmissionInput
  ) {
    // Get the configurator with active version's pricing rules
    const configurator = await this.db.configurator.findFirst({
      where: { id: configuratorId },
      include: {
        versions: {
          where: { id: undefined }, // We'll handle this below
          include: { pricingRules: { orderBy: { position: "asc" } } },
        },
      },
    });
    if (!configurator) throw new NotFoundError("Configurator", configuratorId);

    // Get the active version with pricing rules
    let pricingRules: any[] = [];
    if (configurator.activeVersionId) {
      const activeVersion = await this.db.configuratorVersion.findUnique({
        where: { id: configurator.activeVersionId },
        include: { pricingRules: { orderBy: { position: "asc" } } },
      });
      pricingRules = activeVersion?.pricingRules ?? [];
    }

    // Calculate price using the pricing engine
    const pricingResult = calculatePrice(
      pricingRules.map((r) => ({
        key: r.key,
        label: r.label,
        ruleType: r.ruleType,
        config: r.config as Record<string, any>,
        isOptional: r.isOptional,
        position: r.position,
      })),
      input.selections as Record<string, any>
    );

    // Find or create contact
    let contactId: string | undefined;
    try {
      const existingContact = await this.db.contact.findFirst({
        where: {
          workspaceId: configurator.workspaceId,
          email: input.contactEmail,
        },
      });

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const newContact = await this.db.contact.create({
          data: {
            workspaceId: configurator.workspaceId,
            email: input.contactEmail,
            firstName: input.contactName.split(" ")[0],
            lastName: input.contactName.split(" ").slice(1).join(" ") || undefined,
            phone: input.contactPhone,
            source: "configurator",
          },
        });
        contactId = newContact.id;
      }
    } catch {
      // Contact creation is best-effort
    }

    // Create lead
    let leadId: string | undefined;
    try {
      const lead = await this.db.lead.create({
        data: {
          workspaceId: configurator.workspaceId,
          email: input.contactEmail,
          name: input.contactName,
          phone: input.contactPhone,
          company: input.contactCompany,
          source: "configurator",
          sourceId: configuratorId,
          contactId,
          budget: pricingResult.total,
          notes: input.contactNotes,
          services: JSON.stringify(input.selections),
        },
      });
      leadId = lead.id;
    } catch {
      // Lead creation is best-effort
    }

    // Create submission record
    const submission = await this.db.configuratorSubmission.create({
      data: {
        configuratorId,
        selections: input.selections as any,
        pricingBreakdown: pricingResult.lineItems as any,
        subtotal: pricingResult.subtotal,
        taxAmount: pricingResult.taxAmount,
        total: pricingResult.total,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        contactCompany: input.contactCompany,
        contactNotes: input.contactNotes,
        contactId,
        leadId,
        source: input.source,
        referrer: input.referrer,
        utmSource: input.utmSource,
      },
    });

    await logActivity({
      workspaceId: configurator.workspaceId,
      userId: null as any, // Public submission, no user
      type: "configurator.submission",
      summary: `Nieuwe configurator aanvraag van ${input.contactName} (€${pricingResult.total.toFixed(2)})`,
      entityType: "configurator",
      entityId: configuratorId,
      contactId,
      metadata: {
        submissionId: submission.id,
        total: pricingResult.total,
        email: input.contactEmail,
      },
    });

    return { submission, pricing: pricingResult };
  }

  /**
   * List submissions for a configurator.
   */
  async listSubmissions(
    configuratorId: string,
    filter?: { status?: string; page?: number; perPage?: number }
  ) {
    this.assertPermission(Permission.CONFIGURATOR_VIEW);

    const page = filter?.page ?? 1;
    const perPage = filter?.perPage ?? 25;

    const where: Prisma.ConfiguratorSubmissionWhereInput = {
      configuratorId,
      configurator: { workspaceId: this.ctx.workspaceId },
      ...(filter?.status ? { status: filter.status as any } : {}),
    };

    const [submissions, total] = await Promise.all([
      this.db.configuratorSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.db.configuratorSubmission.count({ where }),
    ]);

    return {
      submissions,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Get a configurator by slug for public access (no auth required).
   * Returns only published configurators with their active version.
   */
  static async getPublicBySlug(slug: string, workspaceSlug?: string) {
    const { db } = await import("@/lib/db");

    const where: any = {
      slug,
      status: "PUBLISHED",
      isPublic: true,
    };

    const configurator = await db.configurator.findFirst({
      where,
      include: {
        workspace: {
          select: {
            name: true,
            slug: true,
            brandColor: true,
            logo: true,
            brandProfile: {
              select: {
                companyName: true,
                logoUrl: true,
                primaryColor: true,
                website: true,
              },
            },
          },
        },
      },
    });

    if (!configurator || !configurator.activeVersionId) return null;

    // Load the active version with full structure
    const activeVersion = await db.configuratorVersion.findUnique({
      where: { id: configurator.activeVersionId },
      include: {
        steps: {
          include: {
            blocks: { orderBy: { position: "asc" } },
          },
          orderBy: { position: "asc" },
        },
        pricingRules: { orderBy: { position: "asc" } },
      },
    });

    return { ...configurator, activeVersion };
  }
}
