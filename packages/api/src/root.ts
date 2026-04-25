import { router } from "./trpc";
import { dashboardRouter } from "./routers/dashboard.router";
import { leadRouter } from "./routers/lead.router";
import { campaignRouter } from "./routers/campaign.router";
import { tagRouter } from "./routers/tag.router";
import { pipelineRouter } from "./routers/pipeline.router";
import { settingsRouter } from "./routers/settings.router";
import { userRouter } from "./routers/user.router";
import { contactRouter } from "./routers/contact.router";
import { scoringRouter } from "./routers/scoring.router";
import { openclawRouter } from "./routers/openclaw.router";
import { searchRouter } from "./routers/search.router";
import { reportRouter } from "./routers/report.router";
import { inboxRouter } from "./routers/inbox.router";
import { bookingRouter } from "./routers/booking.router";
import { domainRouter } from "./routers/domain.router";
import { reviewRouter } from "./routers/review.router";
import { quoteRouter } from "./routers/quote.router";
import { chatbotRouter } from "./routers/chatbot.router";

export const appRouter = router({
  dashboard: dashboardRouter,
  lead: leadRouter,
  campaign: campaignRouter,
  tag: tagRouter,
  pipeline: pipelineRouter,
  settings: settingsRouter,
  user: userRouter,
  contact: contactRouter,
  scoring: scoringRouter,
  openclaw: openclawRouter,
  search: searchRouter,
  report: reportRouter,
  inbox: inboxRouter,
  booking: bookingRouter,
  domain: domainRouter,
  review: reviewRouter,
  quote: quoteRouter,
  chatbot: chatbotRouter,
});

export type AppRouter = typeof appRouter;
