import { Prisma } from "@prisma/client";
import { BaseService } from "./base.service";
import { Permission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { NotFoundError, ConflictError } from "@/lib/errors";
import type { CreateContactInput, UpdateContactInput, ContactFilter } from "@/lib/validations/contacts";

// ============================================================================
// Contacts Service
//
// All contact operations go through here. Never query contacts directly
// from components — always use this service layer.
// ============================================================================

export class ContactsService extends BaseService {

  /**
   * List contacts with filtering, search, and pagination.
   */
  async list(filter: ContactFilter) {
    this.assertPermission(Permission.CONTACTS_VIEW);

    const where: Prisma.ContactWhereInput = {
      ...this.where,
      archivedAt: filter.status === "ARCHIVED" ? { not: null } : null,
      ...(filter.status && filter.status !== "ARCHIVED"
        ? { status: filter.status }
        : {}),
      ...(filter.organizationId
        ? { organizationId: filter.organizationId }
        : {}),
      ...(filter.tagId
        ? { contactTags: { some: { tagId: filter.tagId } } }
        : {}),
      ...(filter.search
        ? {
            OR: [
              { firstName: { contains: filter.search, mode: "insensitive" } },
              { lastName: { contains: filter.search, mode: "insensitive" } },
              { email: { contains: filter.search, mode: "insensitive" } },
              { phone: { contains: filter.search } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ContactOrderByWithRelationInput =
      filter.sortBy === "name"
        ? { firstName: filter.sortOrder }
        : { [filter.sortBy]: filter.sortOrder };

    const [contacts, total] = await Promise.all([
      this.db.contact.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
          contactTags: { include: { tag: true } },
        },
        orderBy,
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.db.contact.count({ where }),
    ]);

    return {
      contacts,
      pagination: {
        page: filter.page,
        perPage: filter.perPage,
        total,
        totalPages: Math.ceil(total / filter.perPage),
      },
    };
  }

  /**
   * Get a single contact by ID with full related data.
   */
  async getById(id: string) {
    this.assertPermission(Permission.CONTACTS_VIEW);

    const contact = await this.db.contact.findFirst({
      where: { id, ...this.where, archivedAt: null },
      include: {
        organization: true,
        contactTags: { include: { tag: true } },
        deals: {
          include: { stage: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        quotes: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        bookings: {
          include: { bookingType: true },
          orderBy: { startAt: "desc" },
          take: 10,
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!contact) throw new NotFoundError("Contact", id);
    return contact;
  }

  /**
   * Create a new contact. Deduplicates by email within workspace.
   */
  async create(input: CreateContactInput) {
    this.assertPermission(Permission.CONTACTS_CREATE);

    // Check email uniqueness within workspace
    const existing = await this.db.contact.findUnique({
      where: {
        workspaceId_email: {
          workspaceId: this.ctx.workspaceId,
          email: input.email.toLowerCase().trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictError(
        `Contact met e-mail ${input.email} bestaat al in deze workspace`
      );
    }

    const { tagIds, ...data } = input;

    const contact = await this.db.contact.create({
      data: {
        ...data,
        email: input.email.toLowerCase().trim(),
        workspaceId: this.ctx.workspaceId,
        ...(tagIds?.length
          ? {
              contactTags: {
                create: tagIds.map((tagId) => ({ tagId })),
              },
            }
          : {}),
      },
      include: {
        organization: true,
        contactTags: { include: { tag: true } },
      },
    });

    await logActivity({
      workspaceId: this.ctx.workspaceId,
      userId: this.ctx.userId,
      type: "contact.created",
      summary: `Contact ${contact.firstName ?? ""} ${contact.lastName ?? ""} aangemaakt`.trim(),
      entityType: "contact",
      entityId: contact.id,
      contactId: contact.id,
    });

    return contact;
  }

  /**
   * Update a contact.
   */
  async update(id: string, input: UpdateContactInput) {
    this.assertPermission(Permission.CONTACTS_EDIT);

    const existing = await this.db.contact.findFirst({
      where: { id, ...this.where },
    });
    if (!existing) throw new NotFoundError("Contact", id);

    // If email changed, check uniqueness
    if (input.email && input.email.toLowerCase() !== existing.email) {
      const duplicate = await this.db.contact.findUnique({
        where: {
          workspaceId_email: {
            workspaceId: this.ctx.workspaceId,
            email: input.email.toLowerCase().trim(),
          },
        },
      });
      if (duplicate) {
        throw new ConflictError(`Contact met e-mail ${input.email} bestaat al`);
      }
    }

    const { tagIds, ...data } = input;

    const contact = await this.db.contact.update({
      where: { id },
      data: {
        ...data,
        ...(input.email ? { email: input.email.toLowerCase().trim() } : {}),
        ...(tagIds !== undefined
          ? {
              contactTags: {
                deleteMany: {},
                create: tagIds.map((tagId) => ({ tagId })),
              },
            }
          : {}),
      },
      include: {
        organization: true,
        contactTags: { include: { tag: true } },
      },
    });

    await logActivity({
      workspaceId: this.ctx.workspaceId,
      userId: this.ctx.userId,
      type: "contact.updated",
      summary: `Contact ${contact.firstName ?? ""} ${contact.lastName ?? ""} bijgewerkt`.trim(),
      entityType: "contact",
      entityId: contact.id,
      contactId: contact.id,
    });

    return contact;
  }

  /**
   * Soft-delete (archive) a contact.
   */
  async archive(id: string) {
    this.assertPermission(Permission.CONTACTS_DELETE);

    const contact = await this.db.contact.findFirst({
      where: { id, ...this.where },
    });
    if (!contact) throw new NotFoundError("Contact", id);

    await this.db.contact.update({
      where: { id },
      data: { archivedAt: new Date(), status: "ARCHIVED" },
    });

    await logActivity({
      workspaceId: this.ctx.workspaceId,
      userId: this.ctx.userId,
      type: "contact.archived",
      summary: `Contact ${contact.firstName ?? ""} ${contact.lastName ?? ""} gearchiveerd`.trim(),
      entityType: "contact",
      entityId: id,
      contactId: id,
    });
  }

  /**
   * Find or create a contact by email. Used by booking, forms, lead conversion.
   */
  async findOrCreate(email: string, data?: Partial<CreateContactInput>) {
    const normalized = email.toLowerCase().trim();

    const existing = await this.db.contact.findUnique({
      where: {
        workspaceId_email: {
          workspaceId: this.ctx.workspaceId,
          email: normalized,
        },
      },
    });

    if (existing) return existing;

    return this.db.contact.create({
      data: {
        workspaceId: this.ctx.workspaceId,
        email: normalized,
        firstName: data?.firstName,
        lastName: data?.lastName,
        phone: data?.phone,
        source: data?.source ?? "auto",
      },
    });
  }
}
