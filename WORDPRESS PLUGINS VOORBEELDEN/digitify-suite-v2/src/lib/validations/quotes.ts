import { z } from "zod";

const quoteItemSchema = z.object({
  description: z.string().min(1, "Omschrijving is verplicht"),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
});

const quoteSectionSchema = z.object({
  title: z.string().min(1, "Sectie titel is verplicht"),
  items: z.array(quoteItemSchema).min(1, "Minstens één regel nodig"),
});

export const createQuoteSchema = z.object({
  title: z.string().max(200).optional(),
  contactId: z.string().cuid().optional(),
  organizationId: z.string().cuid().optional(),
  dealId: z.string().cuid().optional(),
  taxRate: z.coerce.number().min(0).max(100).default(21),
  discount: z.coerce.number().min(0).default(0),
  currency: z.string().length(3).default("EUR"),
  introText: z.string().max(5000).optional(),
  footerText: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  validUntil: z.coerce.date().optional(),
  sections: z.array(quoteSectionSchema).min(1, "Minstens één sectie nodig"),
});

export const updateQuoteSchema = createQuoteSchema.partial();

export const sendQuoteSchema = z.object({
  quoteId: z.string().cuid(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().max(5000).optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type SendQuoteInput = z.infer<typeof sendQuoteSchema>;
