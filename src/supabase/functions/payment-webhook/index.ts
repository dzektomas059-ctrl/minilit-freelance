import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const WEBHOOK_SECRET = Deno.env.get('PAYMENT_WEBHOOK_SECRET') || '';

serve(async (req) => {
  try {
    const signature = req.headers.get('x-webhook-signature') || '';
    const body = await req.text();

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    );
    const signatureBytes = hexToBytes(signature);
    const valid = await crypto.subtle.verify(
      'HMAC', key, signatureBytes, encoder.encode(body)
    );

    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = JSON.parse(body);
    const { event, data } = payload;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    if (event === 'payment.succeeded') {
      const { userId, amount, transactionId } = data;

      if (!userId || !amount || !transactionId) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
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
          metadata: { transactionId, paymentSystem: 'yookassa' }
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

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (event === 'payment.refunded') {
      const { userId, amount, transactionId } = data;

      if (!userId || !amount || !transactionId) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }

      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      const newBalance = Math.max(0, (profile?.balance || 0) - amount);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId);

      if (updateError) throw updateError;

      await supabase.from('transactions').insert({
        from_user_id: userId,
        to_user_id: null,
        amount,
        type: 'withdrawal',
        status: 'completed',
        metadata: { transactionId, paymentSystem: 'yookassa', refund: true }
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown event type' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
