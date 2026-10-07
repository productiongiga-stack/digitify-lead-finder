import { NextResponse } from "next/server";
import {
  creativeStripe,
  fulfillCreativeCheckout,
  syncCreativeSubscription,
} from "@digitify/api/src/lib/creative-stripe";
import { prisma } from "@digitify/db";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.CREATIVE_STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Webhook niet geconfigureerd" },
      { status: 503 },
    );
  let event;
  try {
    event = creativeStripe().webhooks.constructEvent(
      await request.text(),
      request.headers.get("stripe-signature") || "",
      secret,
    );
  } catch {
    return NextResponse.json(
      { error: "Ongeldige handtekening" },
      { status: 400 },
    );
  }
  try {
    try {
      await prisma.creativeStripeEvent.create({ data: { eventId: event.id, type: event.type } });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002")
        return NextResponse.json({ received: true, duplicate: true });
      throw error;
    }
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    )
      await fulfillCreativeCheckout(event.data.object);
    else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted")
      await syncCreativeSubscription(event.data.object);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Betaling nog niet verwerkt" },
      { status: 500 },
    );
  }
}
