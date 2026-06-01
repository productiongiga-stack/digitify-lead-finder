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
import { registrationRouter } from "./routers/registration.router";
import { crmRouter } from "./routers/crm.router";
import { taskRouter } from "./routers/task.router";
import { invoiceRouter } from "./routers/invoice.router";
import { auditRouter } from "./routers/audit.router";
import { templateRouter } from "./routers/template.router";
import { socialRouter } from "./routers/social.router";
import { metaAdsRouter } from "./routers/meta-ads.router";
import { googleAdsRouter } from "./routers/google-ads.router";

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
  registration: registrationRouter,
  crm: crmRouter,
  task: taskRouter,
  invoice: invoiceRouter,
  audit: auditRouter,
  template: templateRouter,
  social: socialRouter,
  metaAds: metaAdsRouter,
  googleAds: googleAdsRouter,
});

export type AppRouter = typeof appRouter;
