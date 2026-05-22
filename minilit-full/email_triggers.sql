-- ============================================================
-- Email Notification Triggers (via Edge Function + pg_net)
-- ============================================================
-- Prerequisites:
--   1. CREATE EXTENSION IF NOT EXISTS pg_net;
--   2. Deploy Edge Function: supabase functions deploy send-email
--   3. Set secrets:
--        supabase secrets set SMTP_HOST=smtp.yandex.ru
--        supabase secrets set SMTP_PORT=465
--        supabase secrets set SMTP_USER=your@email.com
--        supabase secrets set SMTP_PASS=your-app-password
--        supabase secrets set SMTP_FROM=your@email.com
--        supabase secrets set WEBHOOK_SECRET=random-secret-string
--   4. Set the function URL and secret in this file below.
-- ============================================================

-- !! CONFIGURE ME !!
-- Replace the values below with your actual Supabase project ref and secret:
CREATE OR REPLACE FUNCTION public.notify_email(to_email text, subject text, html_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  func_url text := 'https://<project-ref>.supabase.co/functions/v1/send-email';
  secret   text := 'random-secret-string';
  resp     jsonb;
BEGIN
  SELECT content::jsonb INTO resp
  FROM net.http_post(
    url    := func_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || secret
    ),
    body   := jsonb_build_object(
      'to',      to_email,
      'subject', subject,
      'html',    html_body
    )
  );
  -- Log error silently — don't block the trigger
  IF resp ? 'error' THEN
    RAISE WARNING 'notify_email failed: %', resp->>'error';
  END IF;
END;
$$;

-- ============================================================
-- Trigger: new order → notify freelancer
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_order_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_name text;
  freelancer_email text;
BEGIN
  SELECT email INTO freelancer_email
    FROM auth.users WHERE id = NEW.freelancer_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT p.name INTO customer_name
    FROM profiles p WHERE p.id = NEW.client_id;

  PERFORM public.notify_email(
    freelancer_email,
    'Новый заказ на MiniLIT',
    '<h2>Новый заказ</h2>' ||
    '<p>Клиент <strong>' || COALESCE(customer_name, 'Пользователь') || '</strong> ' ||
    'оформил заказ <strong>' || COALESCE(NEW.title, '—') || '</strong>.</p>' ||
    '<p><a href="' || COALESCE(current_setting('app.settings.site_url', true), '') || '#order/' || NEW.id || '">Открыть заказ</a></p>'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_insert ON orders;
CREATE TRIGGER on_order_insert
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_insert();

-- ============================================================
-- Trigger: order status changed → notify both parties
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_order_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_email    text;
  freelancer_email  text;
  status_label      text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT email INTO customer_email FROM auth.users WHERE id = NEW.client_id;
  SELECT email INTO freelancer_email FROM auth.users WHERE id = NEW.freelancer_id;

  status_label := CASE NEW.status
    WHEN 'pending_payment' THEN 'Ожидает оплаты'
    WHEN 'paid'   THEN 'Оплачено'
    WHEN 'in_progress' THEN 'В работе'
    WHEN 'waiting_for_approval'   THEN 'На проверке'
    WHEN 'completed'   THEN 'Завершён'
    WHEN 'cancelled'   THEN 'Отменён'
    ELSE NEW.status
  END;

  IF customer_email IS NOT NULL THEN
    PERFORM public.notify_email(
      customer_email,
      'Статус заказа изменён — MiniLIT',
      '<h2>Статус заказа: ' || status_label || '</h2>' ||
      '<p>Статус вашего заказа <strong>#' || NEW.id || '</strong> изменён на "' || status_label || '".</p>' ||
      '<p><a href="' || COALESCE(current_setting('app.settings.site_url', true), '') || '#order/' || NEW.id || '">Открыть заказ</a></p>'
    );
  END IF;

  IF freelancer_email IS NOT NULL AND freelancer_email <> customer_email THEN
    PERFORM public.notify_email(
      freelancer_email,
      'Статус заказа изменён — MiniLIT',
      '<h2>Статус заказа: ' || status_label || '</h2>' ||
      '<p>Статус заказа <strong>#' || NEW.id || '</strong> изменён на "' || status_label || '".</p>' ||
      '<p><a href="' || COALESCE(current_setting('app.settings.site_url', true), '') || '#order/' || NEW.id || '">Перейти к заказу</a></p>'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_update ON orders;
CREATE TRIGGER on_order_status_update
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status_update();

-- ============================================================
-- Trigger: new message → notify recipient
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_message_insert_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recipient_id    uuid;
  recipient_email text;
  sender_name     text;
  chat_order_id   uuid;
BEGIN
  SELECT order_id INTO chat_order_id
    FROM chats WHERE id = NEW.chat_id;

  SELECT
    CASE WHEN NEW.sender_id = c.client_id THEN c.freelancer_id ELSE c.client_id END
  INTO recipient_id
    FROM chats c WHERE c.id = NEW.chat_id;

  IF recipient_id IS NULL THEN RETURN NEW; END IF;

  SELECT email INTO recipient_email
    FROM auth.users WHERE id = recipient_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT p.name INTO sender_name
    FROM profiles p WHERE p.id = NEW.sender_id;

  PERFORM public.notify_email(
    recipient_email,
    'Новое сообщение на MiniLIT',
    '<h2>Новое сообщение</h2>' ||
    '<p><strong>' || COALESCE(sender_name, 'Пользователь') || '</strong>:</p>' ||
    '<blockquote>' || LEFT(NEW.text, 200) || '</blockquote>' ||
    CASE WHEN chat_order_id IS NOT NULL
      THEN '<p><a href="' || COALESCE(current_setting('app.settings.site_url', true), '') || '#order/' || chat_order_id || '">Перейти к чату</a></p>'
      ELSE ''
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_insert ON messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_insert_email();

-- ============================================================
-- Set site URL (change to your actual domain)
-- ============================================================
DO $$
BEGIN
  PERFORM set_config('app.settings.site_url',
    'https://<your-domain>.vercel.app/', true);
END $$;
