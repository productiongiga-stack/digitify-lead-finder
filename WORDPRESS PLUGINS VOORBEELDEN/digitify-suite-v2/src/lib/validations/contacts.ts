import { z } from "zod";

export const createContactSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  firstName: z.string().min(1, "Voornaam is verplicht").max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  jobTitle: z.string().max(100).optional(),
  organizationId: z.string().cuid().optional(),
  source: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  tagIds: z.array(z.string().cuid()).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const contactFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  organizationId: z.string().cuid().optional(),
  tagId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["name", "email", "createdAt", "lastActivityAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ContactFilter = z.infer<typeof contactFilterSchema>;
