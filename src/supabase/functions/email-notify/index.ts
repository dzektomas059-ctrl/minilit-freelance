import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

serve(async (req) => {
  try {
    const payload = await req.json();

    const { type, table, record } = payload;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (table === 'messages' && type === 'INSERT') {
      const chatId = record.chat_id;

      const { data: chat } = await supabase
        .from('chats')
        .select('*, client:client_id(name, email), freelancer:freelancer_id(name, email)')
        .eq('id', chatId)
        .single();

      if (!chat) return new Response('Chat not found', { status: 404 });

      const senderId = record.sender_id;
      const recipient = chat.client_id === senderId ? chat.freelancer : chat.client;

      if (!recipient?.email) return new Response('No email', { status: 200 });

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'MiniLIT <notifications@minilit.dev>',
          to: recipient.email,
          subject: `Новое сообщение от ${senderId === chat.client_id ? chat.client?.name : chat.freelancer?.name || 'пользователя'}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#1DBF73">MiniLIT — Новое сообщение</h2>
              <p>Вы получили новое сообщение в чате:</p>
              <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0">
                ${esc_html(record.text || '(без текста)')}
              </div>
              <p style="color:#666;font-size:13px">
                <a href="https://dzektomas059-ctrl.github.io/minilit-freelance/#messages?chat=${chatId}" style="color:#1DBF73">Перейти к чату</a>
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
              <p style="color:#999;font-size:12px">Вы получили это письмо, потому что у вас включены уведомления о новых сообщениях в MiniLIT.</p>
            </div>
          `
        })
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error('Email send failed:', errText);
      }
    }

    if (table === 'orders' && type === 'UPDATE') {
      const orderId = record.id;
      const newStatus = record.status;
      const oldStatus = payload.old_record?.status;

      if (newStatus === oldStatus) return new Response('No change', { status: 200 });

      const { data: order } = await supabase
        .from('orders')
        .select('*, client:client_id(name, email), freelancer:freelancer_id(name, email)')
        .eq('id', orderId)
        .single();

      if (!order) return new Response('Order not found', { status: 404 });

      const statusLabels = {
        'pending_payment': 'Ожидает оплаты',
        'paid': 'Оплачен',
        'in_progress': 'В работе',
        'completed': 'Завершён',
        'cancelled': 'Отменён',
        'disputed': 'Спор'
      };

      const recipients = [
        { email: order.client?.email, name: order.client?.name, role: 'Заказчик' },
        { email: order.freelancer?.email, name: order.freelancer?.name, role: 'Исполнитель' }
      ];

      for (const recipient of recipients) {
        if (!recipient.email) continue;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'MiniLIT <notifications@minilit.dev>',
            to: recipient.email,
            subject: `Статус заказа изменён: ${statusLabels[newStatus] || newStatus}`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <h2 style="color:#1DBF73">MiniLIT — Статус заказа</h2>
                <p>${recipient.role}, статус вашего заказа «${esc_html(order.title || '')}» изменён:</p>
                <div style="display:inline-block;padding:8px 16px;border-radius:6px;font-weight:600;margin:12px 0;background:#eaf8f0;color:#159b5b">
                  ${statusLabels[newStatus] || newStatus}
                </div>
                <p style="color:#666;font-size:13px">
                  <a href="https://dzektomas059-ctrl.github.io/minilit-freelance/#me?tab=orders" style="color:#1DBF73">Перейти к заказам</a>
                </p>
              </div>
            `
          })
        });
      }
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Email notification error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});

function esc_html(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
