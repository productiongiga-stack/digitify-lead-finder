import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { assertLeadAccess, ownedChatSessionWhere } from "../lib/tenant";
import { enforceRateLimit } from "../lib/rate-limit";

async function enforceChatbotRateLimit(params: {
  userId: string;
  bucket: string;
  limit: number;
  windowMs: number;
  message: string;
}) {
  await enforceRateLimit({
    key: `chatbot:${params.bucket}:${params.userId}`,
    limit: params.limit,
    windowMs: params.windowMs,
    message: params.message,
  });
}

export const chatbotRouter = router({
  // List all chat sessions with filtering
  listSessions: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(20),
      status: z.enum(["OPEN", "WAITING", "RESOLVED", "ARCHIVED"]).optional(),
      isRead: z.boolean().optional(),
      search: z.string().optional(),
    }).default({}))
    .query(async ({ ctx, input }) => {
      await enforceChatbotRateLimit({
        userId: ctx.user.id,
        bucket: "list",
        limit: 120,
        windowMs: 60_000,
        message: "Te veel chatbot-opvragingen op korte tijd.",
      });
      const { page, perPage, status, isRead, search } = input;
      const filters: any = {};
      if (status) filters.status = status;
      if (isRead !== undefined) filters.isRead = isRead;
      if (search) {
        filters.OR = [
          { visitorName: { contains: search, mode: "insensitive" } },
          { visitorEmail: { contains: search, mode: "insensitive" } },
          { visitorCompany: { contains: search, mode: "insensitive" } },
          { summary: { contains: search, mode: "insensitive" } },
        ];
      }
      const where = {
        AND: [
          ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id),
          filters,
        ],
      };
      const [sessions, total, unreadCount] = await Promise.all([
        ctx.db.chatSession.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: {
            assignedTo: { select: { id: true, name: true } },
            lead: { select: { id: true, companyName: true } },
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
            _count: { select: { messages: true } },
          },
        }),
        ctx.db.chatSession.count({ where }),
        ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), isRead: false } }),
      ]);
      return { sessions, total, unreadCount, page, perPage, totalPages: Math.ceil(total / perPage) };
    }),

  // Get single session with all messages
  getSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id: input.id }] },
        include: {
          assignedTo: { select: { id: true, name: true } },
          lead: { select: { id: true, companyName: true, website: true, city: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessie niet gevonden" });
      // Mark as read
      if (!session.isRead) {
        await ctx.db.chatSession.update({ where: { id: input.id }, data: { isRead: true } });
      }
      return session;
    }),

  // Send agent message in a session
  sendMessage: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await enforceChatbotRateLimit({
        userId: ctx.user.id,
        bucket: "send",
        limit: 80,
        windowMs: 60_000,
        message: "Te veel chatberichten op korte tijd.",
      });
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id: input.sessionId }] },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      const message = await ctx.db.chatMessage.create({
        data: {
          sessionId: input.sessionId,
          role: "AGENT",
          content: input.content,
        },
      });

      // Update session timestamp and status
      await ctx.db.chatSession.update({
        where: { id: input.sessionId },
        data: {
          updatedAt: new Date(),
          status: session.status === "RESOLVED" || session.status === "ARCHIVED" ? "OPEN" : "WAITING",
          isRead: false,
        },
      });

      return message;
    }),

  // Update session (status, assignment, notes, tags)
  updateSession: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["OPEN", "WAITING", "RESOLVED", "ARCHIVED"]).optional(),
      assignedToId: z.string().nullable().optional(),
      internalNotes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      isRead: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id }] },
        select: { id: true },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessie niet gevonden" });
      return ctx.db.chatSession.update({ where: { id }, data });
    }),

  // Convert chat to lead
  convertToLead: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await enforceChatbotRateLimit({
        userId: ctx.user.id,
        bucket: "summary",
        limit: 20,
        windowMs: 60_000,
        message: "Te veel samenvattingen op korte tijd.",
      });
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id: input.sessionId }] },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.leadId) throw new TRPCError({ code: "BAD_REQUEST", message: "Sessie is al gekoppeld aan een lead" });

      const lead = await ctx.db.lead.create({
        data: {
          companyName: session.visitorCompany || session.visitorName || "Chatbot Lead",
          email: session.visitorEmail,
          phone: session.visitorPhone,
          source: "chatbot",
          industry: session.intent || undefined,
          createdById: ctx.user.workspaceId!,
          savedById: ctx.user.id,
          lastEditedById: ctx.user.id,
        },
      });

      await ctx.db.chatSession.update({
        where: { id: input.sessionId },
        data: { leadId: lead.id },
      });

      await ctx.db.activity.create({
        data: {
          leadId: lead.id,
          userId: ctx.user.id,
          type: "LEAD_CREATED",
          title: `Lead aangemaakt vanuit chatbot gesprek`,
          metadata: { chatSessionId: input.sessionId },
        },
      });

      return lead;
    }),

  // Convert chat to quote
  convertToQuote: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id: input.sessionId }] },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessie niet gevonden" });

      let leadId = session.leadId;
      if (!leadId) {
        const lead = await ctx.db.lead.create({
          data: {
            companyName: session.visitorCompany || session.visitorName || "Chatbot Lead",
            email: session.visitorEmail,
            phone: session.visitorPhone,
            source: "chatbot",
            industry: session.intent || undefined,
            createdById: ctx.user.workspaceId!,
            savedById: ctx.user.id,
            lastEditedById: ctx.user.id,
          },
          select: { id: true },
        });
        leadId = lead.id;
        await ctx.db.chatSession.update({
          where: { id: session.id },
          data: { leadId },
        });
      }

      const caller = await ctx.db.quote.count({ where: { createdById: ctx.user.workspaceId! } });
      const year = new Date().getFullYear();
      const quoteNumber = `OFF-${year}-${ctx.user.id.slice(-4).toUpperCase()}-${String(caller + 1).padStart(4, "0")}`;
      const quote = await ctx.db.quote.create({
        data: {
          quoteNumber,
          leadId,
          clientName: session.visitorName || session.visitorCompany || "Nieuwe aanvraag",
          clientEmail: session.visitorEmail || null,
          clientPhone: session.visitorPhone || null,
          clientCompany: session.visitorCompany || null,
          notes: `Aangemaakt vanuit chatsessie ${session.id}`,
          vatRate: 21,
          subtotal: 0,
          vatAmount: 0,
          total: 0,
          createdById: ctx.user.workspaceId!,
        },
        select: { id: true, quoteNumber: true },
      });

      await ctx.db.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "AGENT",
          content: `Ik heb een offerte-dossier opgestart (${quote.quoteNumber}).`,
          metadata: { action: "convert_to_quote", quoteId: quote.id },
        },
      });
      return quote;
    }),

  // Convert chat to booking
  convertToBooking: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        date: z.string().datetime(),
        duration: z.number().min(15).max(240).default(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id: input.sessionId }] },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessie niet gevonden" });
      const booking = await ctx.db.booking.create({
        data: {
          clientName: session.visitorName || session.visitorCompany || "Chatbot bezoeker",
          clientEmail: session.visitorEmail || null,
          date: new Date(input.date),
          duration: input.duration,
          notes: `Aangemaakt vanuit chatsessie ${session.id}`,
          status: "PENDING",
          leadId: session.leadId || null,
          createdById: ctx.user.workspaceId!,
        },
        select: { id: true, date: true, status: true },
      });
      await ctx.db.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "AGENT",
          content: `Ik heb een boeking aangemaakt voor ${new Date(booking.date).toLocaleString("nl-BE")}.`,
          metadata: { action: "convert_to_booking", bookingId: booking.id },
        },
      });
      return booking;
    }),

  // Live takeover by admin/agent
  startLiveTakeover: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id: input.sessionId }] },
        select: { id: true, tags: true },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessie niet gevonden" });
      const tags = Array.isArray(session.tags) ? session.tags : [];
      const withoutPreviousTakeover = tags.filter((tag) => !tag.startsWith("takeover:"));
      const nextTags = Array.from(new Set([...withoutPreviousTakeover, `takeover:${ctx.user.id}`]));

      await ctx.db.chatSession.update({
        where: { id: session.id },
        data: {
          assignedToId: ctx.user.id,
          status: "WAITING",
          tags: nextTags,
          isRead: false,
        },
      });
      await ctx.db.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "AGENT",
          content: "Live takeover gestart door een medewerker.",
          metadata: { action: "live_takeover_started", userId: ctx.user.id },
        },
      });
      return { success: true };
    }),

  // Link session to existing lead
  linkToLead: protectedProcedure
    .input(z.object({ sessionId: z.string(), leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id: input.sessionId }] },
        select: { id: true },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessie niet gevonden" });
      await ctx.db.chatSession.update({
        where: { id: input.sessionId },
        data: { leadId: input.leadId },
      });
      return { success: true };
    }),

  // Generate AI summary of conversation
  generateSummary: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id: input.sessionId }] },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      // Build conversation text for summary
      const conversationText = session.messages
        .map(m => `${m.role === "VISITOR" ? "Bezoeker" : m.role === "BOT" ? "Bot" : "Agent"}: ${m.content}`)
        .join("\n");

      // Detect intent from conversation using weighted scoring
      const intents: Record<string, { patterns: RegExp[]; weight: number }> = {
        quote_request: {
          patterns: [/offerte/i, /voorstel/i, /aanbieding/i, /prijsopgave/i],
          weight: 3,
        },
        price_inquiry: {
          patterns: [/prijs/i, /kost/i, /tarief/i, /budget/i, /wat kost/i, /hoeveel/i],
          weight: 2,
        },
        booking: {
          patterns: [/afspraak/i, /boeking/i, /meeting/i, /gesprek plannen/i, /inplannen/i, /beschikbaar/i, /agenda/i],
          weight: 3,
        },
        contact: {
          patterns: [/contact/i, /bellen/i, /mailen/i, /bereikbaar/i, /telefoonnummer/i, /e-mail/i],
          weight: 1,
        },
        support: {
          patterns: [/probleem/i, /help/i, /fout/i, /werkt niet/i, /kapot/i, /storing/i, /bug/i],
          weight: 2,
        },
        service_interest: {
          patterns: [/website/i, /marketing/i, /seo/i, /video/i, /foto/i, /design/i, /app/i, /software/i],
          weight: 1,
        },
        complaint: {
          patterns: [/klacht/i, /ontevreden/i, /slecht/i, /teleurgesteld/i, /niet tevreden/i],
          weight: 3,
        },
        general_info: {
          patterns: [/informatie/i, /meer weten/i, /uitleg/i, /hoe werkt/i, /wat is/i],
          weight: 1,
        },
      };

      // Score each intent based on match count and weight
      const scores: Record<string, number> = {};
      for (const [intent, config] of Object.entries(intents)) {
        let score = 0;
        for (const pattern of config.patterns) {
          const matches = conversationText.match(new RegExp(pattern.source, "gi"));
          if (matches) {
            score += matches.length * config.weight;
          }
        }
        if (score > 0) scores[intent] = score;
      }

      // Pick the highest-scoring intent
      let detectedIntent: string | null = null;
      let maxScore = 0;
      for (const [intent, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score;
          detectedIntent = intent;
        }
      }

      // Simple summary: first visitor message + detected intent
      const visitorMessages = session.messages.filter(m => m.role === "VISITOR");
      const summary = visitorMessages.length > 0
        ? visitorMessages[0].content.substring(0, 200) + (visitorMessages[0].content.length > 200 ? "..." : "")
        : "Geen berichten van bezoeker";

      await ctx.db.chatSession.update({
        where: { id: input.sessionId },
        data: { summary, intent: detectedIntent },
      });

      return { summary, intent: detectedIntent };
    }),

  // Get all chat sessions for a specific lead
  getSessionsByLead: protectedProcedure
    .input(z.object({
      leadId: z.string(),
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const { leadId, page, perPage } = input;
      const where = { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { leadId }] };

      const [sessions, total] = await Promise.all([
        ctx.db.chatSession.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: {
            assignedTo: { select: { id: true, name: true } },
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
            _count: { select: { messages: true } },
          },
        }),
        ctx.db.chatSession.count({ where }),
      ]);

      return { sessions, total, page, perPage, totalPages: Math.ceil(total / perPage) };
    }),

  // Stats for dashboard
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [total, open, waiting, unread, resolved] = await Promise.all([
      ctx.db.chatSession.count({ where: ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id) }),
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), status: "OPEN" } }),
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), status: "WAITING" } }),
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), isRead: false } }),
      ctx.db.chatSession.count({ where: { ...ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), status: "RESOLVED" } }),
    ]);
    return { total, open, waiting, unread, resolved };
  }),

  // Bulk mark as read
  bulkMarkRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.chatSession.updateMany({
        where: { id: { in: input.ids }, ...ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id) },
        data: { isRead: true },
      });
      return { success: true };
    }),

  // Delete session
  deleteSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.chatSession.findFirst({
        where: { AND: [ownedChatSessionWhere(ctx.user.workspaceId!, ctx.user.id), { id: input.id }] },
        select: { id: true },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessie niet gevonden" });
      await ctx.db.chatSession.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Create a session (admin creates test sessions or incoming webhook proxy)
  createSession: protectedProcedure
    .input(z.object({
      visitorName: z.string().optional(),
      visitorEmail: z.string().optional(),
      visitorPhone: z.string().optional(),
      visitorCompany: z.string().optional(),
      pageUrl: z.string().optional(),
      initialMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await enforceChatbotRateLimit({
        userId: ctx.user.id,
        bucket: "create",
        limit: 30,
        windowMs: 60_000,
        message: "Te veel nieuwe chatsessies op korte tijd.",
      });
      const session = await ctx.db.chatSession.create({
        data: {
          assignedToId: ctx.user.id,
          visitorName: input.visitorName,
          visitorEmail: input.visitorEmail,
          visitorPhone: input.visitorPhone,
          visitorCompany: input.visitorCompany,
          pageUrl: input.pageUrl,
          tags: [`tenant:${ctx.user.workspaceId!}`],
        },
      });

      if (input.initialMessage) {
        await ctx.db.chatMessage.create({
          data: {
            sessionId: session.id,
            role: "VISITOR",
            content: input.initialMessage,
          },
        });
      }

      return session;
    }),
});
