import { NextResponse } from "next/server";
import {
  creativeStripe,
  fulfillCreativeCheckout,
} from "@digitify/api/src/lib/creative-stripe";
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
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    )
      await fulfillCreativeCheckout(event.data.object);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Betaling nog niet verwerkt" },
      { status: 500 },
    );
  }
}
