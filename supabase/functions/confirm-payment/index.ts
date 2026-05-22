import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { paymentIntentId } = await req.json();

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({ error: "paymentIntentId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return new Response(
        JSON.stringify({ error: "Payment not completed", status: paymentIntent.status }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const amount = paymentIntent.amount;
    const fee = Math.round(amount * 0.03);
    const platformFee = Math.round(fee * 0.5);
    const freelancerAmount = amount - fee;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const newBalance = (profile.balance || 0) + (amount - fee);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", user.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update balance" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: amount - fee,
      fee: fee,
      platform_fee: platformFee,
      type: "deposit",
      status: "completed",
      stripe_payment_id: paymentIntentId,
      description: "Пополнение баланса",
    });

    if (txError) {
      console.error("Failed to insert transaction:", txError);
    }

    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "payment",
      title: "Баланс пополнен",
      body: `Ваш баланс пополнен на ${((amount - fee) / 100).toFixed(2)}₽`,
      data: { amount: amount - fee, paymentId: paymentIntentId },
      link: "/me",
    });

    return new Response(
      JSON.stringify({
        success: true,
        newBalance,
        amount: amount - fee,
        fee,
        platformFee,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
