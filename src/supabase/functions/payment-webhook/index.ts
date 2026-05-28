import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac, timingSafeEqual } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const YOOKASSA_SECRET_KEY = Deno.env.get('YOOKASSA_SECRET_KEY') || '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const WEBHOOK_SHARED_SECRET = Deno.env.get('PAYMENT_WEBHOOK_SECRET') || '';

serve(async (req) => {
  try {
    const body = await req.text();
    const userAgent = req.headers.get('user-agent') || '';
    const contentType = req.headers.get('content-type') || '';

    let verified = false;
    let paymentSystem = 'unknown';
    let parsedBody: any;

    if (contentType.includes('application/json') && body.includes('object') && body.includes('payment')) {
      try {
        parsedBody = JSON.parse(body);
        if (parsedBody.event && parsedBody.object) {
          paymentSystem = 'yookassa';
          const signature = req.headers.get('Authorization')?.replace('Basic ', '') || '';
          if (YOOKASSA_SECRET_KEY) {
            const key = new TextEncoder().encode(YOOKASSA_SECRET_KEY);
            const hmac = await createHmac('SHA-256', key);
            hmac.update(new TextEncoder().encode(body));
            const expectedSig = btoa(String.fromCharCode(...new Uint8Array(hmac.digest())));
            verified = signature === expectedSig;
          }
        }
      } catch { /* not ЮKassa */ }
    }

    if (!verified && body.includes('id') && body.includes('type')) {
      try {
        parsedBody = JSON.parse(body);
        if (parsedBody.type && parsedBody.data?.object) {
          paymentSystem = 'stripe';
          const sigHeader = req.headers.get('stripe-signature') || '';
          if (STRIPE_WEBHOOK_SECRET && sigHeader) {
            const payload = `${sigHeader.split(',')[0]?.split('=')[1] || ''}.${body}`;
            const key = new TextEncoder().encode(STRIPE_WEBHOOK_SECRET);
            const hmac = await createHmac('SHA-256', key);
            hmac.update(new TextEncoder().encode(payload));
            const expected = btoa(String.fromCharCode(...new Uint8Array(hmac.digest())));
            const provided = sigHeader.split(',')[1]?.split('=')[1] || '';
            verified = provided === expected;
          }
        }
      } catch { /* not Stripe */ }
    }

    if (!verified && WEBHOOK_SHARED_SECRET) {
      const customSig = req.headers.get('x-webhook-signature') || '';
      if (customSig) {
        const key = new TextEncoder().encode(WEBHOOK_SHARED_SECRET);
        const hmac = await createHmac('SHA-256', key);
        hmac.update(new TextEncoder().encode(body));
        const expected = btoa(String.fromCharCode(...new Uint8Array(hmac.digest())));
        verified = customSig === expected;
        if (verified) paymentSystem = 'custom';
      }
    }

    if (!verified) {
      return new Response(JSON.stringify({ error: 'Invalid or missing signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!parsedBody) parsedBody = JSON.parse(body);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    let userId: string;
    let amount: number;
    let transactionId: string;

    if (paymentSystem === 'yookassa') {
      const payment = parsedBody.object;
      transactionId = payment.id;
      amount = Math.round(parseFloat(payment.amount?.value || '0') * 100) / 100;
      userId = payment.metadata?.userId || '';

      if (parsedBody.event !== 'payment.succeeded' && parsedBody.event !== 'payment.waiting_for_capture') {
        return new Response(JSON.stringify({ status: 'skipped', event: parsedBody.event }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    } else if (paymentSystem === 'stripe') {
      const session = parsedBody.data?.object;
      transactionId = session.id;
      amount = Math.round((session.amount_total || 0) / 100);
      userId = session.metadata?.userId || session.client_reference_id || '';

      if (!parsedBody.type?.includes('completed') && !parsedBody.type?.includes('succeeded')) {
        return new Response(JSON.stringify({ status: 'skipped', event: parsedBody.type }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      const data = parsedBody.data || parsedBody;
      transactionId = data.transactionId || `tx_${Date.now()}`;
      amount = Math.round(parseFloat(data.amount || '0') * 100) / 100;
      userId = data.userId || '';
    }

    if (!userId || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid payment data' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('metadata->>transactionId', transactionId)
      .single();

    if (existingTx) {
      return new Response(JSON.stringify({ status: 'duplicate', transactionId }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const newBalance = (profile?.balance || 0) + amount;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId);

    if (updateError) throw updateError;

    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        from_user_id: null,
        to_user_id: userId,
        amount,
        type: 'deposit',
        status: 'completed',
        metadata: { transactionId, paymentSystem }
      });

    if (txError) throw txError;

    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'payment',
      title: 'Баланс пополнен',
      body: `Ваш баланс пополнен на ${amount} ₽`,
      data: { amount, transactionId },
      is_read: false
    });

    return new Response(JSON.stringify({ success: true, balance: newBalance }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
