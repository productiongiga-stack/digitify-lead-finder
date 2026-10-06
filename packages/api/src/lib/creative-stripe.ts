import Stripe from "stripe";
import { prisma } from "@digitify/db";
import { TRPCError } from "@trpc/server";

export function creativeStripe() {
  const key = process.env.CREATIVE_STRIPE_TEST_SECRET_KEY?.trim();
  if (!key?.startsWith("sk_test_"))
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe-testbetalingen zijn nog niet ingesteld.",
    });
  return new Stripe(key);
}
export async function fulfillCreativeCheckout(
  session: Stripe.Checkout.Session,
) {
  if (
    session.livemode ||
    session.payment_status !== "paid" ||
    session.mode !== "payment"
  )
    return;
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
