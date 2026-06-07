import type { trpc } from "@/lib/trpc/client";

type TrpcUtils = ReturnType<typeof trpc.useUtils>;

/** Invalidate workspace-scoped queries after a workspace switch (avoids full-cache storms). */
export async function invalidateWorkspaceScopedCache(utils: TrpcUtils) {
  await Promise.all([
    utils.user.getShellContext.invalidate(),
    utils.workspace.listMine.invalidate(),
    utils.dashboard.invalidate(),
    utils.lead.invalidate(),
    utils.campaign.invalidate(),
    utils.contact.invalidate(),
    utils.settings.invalidate(),
    utils.task.invalidate(),
    utils.domain.invalidate(),
    utils.review.invalidate(),
    utils.quote.invalidate(),
    utils.crm.invalidate(),
    utils.invoice.invalidate(),
    utils.booking.invalidate(),
    utils.inbox.invalidate(),
    utils.chatbot.invalidate(),
    utils.search.invalidate(),
    utils.report.invalidate(),
    utils.template.invalidate(),
    utils.analytics.invalidate(),
    utils.pipeline.invalidate(),
    utils.tag.invalidate(),
    utils.scoring.invalidate(),
    utils.media.invalidate(),
    utils.social.invalidate(),
    utils.metaAds.invalidate(),
    utils.googleAds.invalidate(),
  ]);
}
