import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata.user_id;
      const amount = paymentIntent.amount;
      const fee = Math.round(amount * 0.03);
      const platformFee = Math.round(fee * 0.5);
      const freelancerAmount = amount - fee;

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "No user_id in metadata" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", userId)
        .single();

      const newBalance = (profile?.balance || 0) + freelancerAmount;

      await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", userId);

      await supabase.from("transactions").insert({
        user_id: userId,
        amount: freelancerAmount,
        fee: fee,
        platform_fee: platformFee,
        type: "deposit",
        status: "completed",
        stripe_payment_id: paymentIntent.id,
        description: "Пополнение баланса (webhook)",
      });

      await supabase.from("notifications").insert({
        user_id: userId,
        type: "payment",
        title: "Баланс пополнен",
        body: `Ваш баланс пополнен на ${(freelancerAmount / 100).toFixed(2)}₽`,
        data: { amount: freelancerAmount, paymentId: paymentIntent.id },
        link: "/me",
      });
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata.user_id;

      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "payment",
          title: "Платёж не прошёл",
          body: "Пополнение баланса не удалось. Попробуйте снова.",
          data: { paymentId: paymentIntent.id, error: paymentIntent.last_payment_error?.message },
          link: "/me",
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
