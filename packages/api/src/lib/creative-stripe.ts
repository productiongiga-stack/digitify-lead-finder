import Stripe from "stripe";
import { prisma } from "@digitify/db";
import { TRPCError } from "@trpc/server";

export function creativeStripe() {
  const key = (process.env.CREATIVE_STRIPE_TEST_SECRET_KEY || process.env.CREATIVE_STRIPE_SECRET_KEY)?.trim();
  if (!key?.startsWith("sk_test_"))
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe-testbetalingen zijn nog niet ingesteld. Voeg CREATIVE_STRIPE_TEST_SECRET_KEY en CREATIVE_STRIPE_WEBHOOK_SECRET server-side toe in Vercel.",
    });
  return new Stripe(key);
}
export async function fulfillCreativeCheckout(
  session: Stripe.Checkout.Session,
) {
  if (session.livemode || session.payment_status !== "paid") return;
  if (session.mode === "subscription") {
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const priceId = process.env.CREATIVE_STRIPE_SUBSCRIPTION_PRICE_ID?.trim();
    const userId = session.metadata?.userId;
    const workspaceId = session.metadata?.workspaceId;
    if (!subscriptionId || !priceId || !userId || !workspaceId) throw new Error("Abonnement komt niet overeen met de checkout.");
    await prisma.creativeSubscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      create: { userId, workspaceId, stripeSubscriptionId: subscriptionId, stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id, priceId, status: "ACTIVE" },
      update: { status: "ACTIVE", stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id },
    });
    return;
  }
  if (session.mode !== "payment") return;
  const purchaseId = session.metadata?.creativePurchaseId;
  if (!purchaseId) return;
  await prisma.$transaction(async (tx) => {
    const purchase = await tx.creativePurchase.findUnique({
      where: { id: purchaseId },
    });
    if (
      !purchase ||
      purchase.sessionId !== session.id ||
      session.amount_total !== purchase.priceCents ||
      session.currency !== "eur"
    )
      throw new Error("Creditbetaling komt niet overeen met bestelling.");
    const changed = await tx.creativePurchase.updateMany({
      where: { id: purchase.id, status: "PENDING" },
      data: { status: "PAID" },
    });
    if (!changed.count) return;
    await tx.creativeWallet.upsert({
      where: { userId: purchase.userId },
      create: { userId: purchase.userId, available: purchase.credits },
      update: { available: { increment: purchase.credits } },
    });
    await tx.creativeLedger.create({
      data: {
        userId: purchase.userId,
        workspaceId: purchase.workspaceId,
        kind: "PURCHASE",
        amount: purchase.credits,
        reference: `purchase:${session.id}`,
      },
    });
  });
}

export async function syncCreativeSubscription(subscription: Stripe.Subscription) {
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
  return prisma.creativeSubscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: subscription.status.toUpperCase(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
}
