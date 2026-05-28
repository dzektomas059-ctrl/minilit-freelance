-- ============================================================
-- MiniLIT — полный SQL для Supabase SQL Editor
-- Выполните ВСЁ содержимое этого файла в Supabase Dashboard > SQL Editor
-- ============================================================

-- 0. Создаём основные таблицы (если не существуют)
CREATE TABLE IF NOT EXISTS chats (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  freelancer_id uuid not null references profiles(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  last_text text,
  last_at timestamptz,
  created_at timestamptz default now(),
  unique (client_id, freelancer_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  read boolean not null default false,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at);

-- 0a. Добавляем image_url в messages (для отправки картинок в чат)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE messages ADD COLUMN image_url text;
  END IF;
END $$;
-- 0b. Добавляем file_name/file_type в messages (для любых файлов в чат)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE messages ADD COLUMN file_name text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN file_type text;
  END IF;
END $$;
-- 0c. Добавляем notif_prefs в profiles (настройки уведомлений)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'notif_prefs'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notif_prefs jsonb default '{"order":true,"proposal":true,"message":true,"review":true,"system":true}'::jsonb;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_chats_client ON chats (client_id);
CREATE INDEX IF NOT EXISTS idx_chats_freelancer ON chats (freelancer_id);

-- 1. Добавляем cover_url в profiles (если ещё нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN cover_url text;
  END IF;
END $$;

-- 2. Создаём таблицу portfolio (если не существует)
CREATE TABLE IF NOT EXISTS portfolio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  project_url text,
  created_at timestamptz default now()
);

-- добавляем project_url, если колонки нет (для существующих БД)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfolio' AND column_name='project_url') THEN
    ALTER TABLE portfolio ADD COLUMN project_url text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio (user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_created ON portfolio (created_at desc);

-- 3. Включаем RLS
ALTER TABLE portfolio enable row level security;

-- 4. RLS политики для portfolio
DROP POLICY IF EXISTS "portfolio: select for all" ON portfolio;
CREATE POLICY "portfolio: select for all" ON portfolio FOR SELECT USING (true);

DROP POLICY IF EXISTS "portfolio: insert for owner" ON portfolio;
CREATE POLICY "portfolio: insert for owner" ON portfolio FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "portfolio: update for owner" ON portfolio;
CREATE POLICY "portfolio: update for owner" ON portfolio FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "portfolio: delete for owner" ON portfolio;
CREATE POLICY "portfolio: delete for owner" ON portfolio FOR DELETE USING (auth.uid() = user_id);

-- 4a. Создаём таблицу proposals (если не существует)
CREATE TABLE IF NOT EXISTS proposals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references jobs(id) on delete cascade,
  freelancer_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  price int not null,
  deadline int,
  image_urls jsonb default '[]'::jsonb,
  video_url text,
  status text default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz default now(),
  unique (task_id, freelancer_id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_task ON proposals (task_id);
CREATE INDEX IF NOT EXISTS idx_proposals_freelancer ON proposals (freelancer_id);

ALTER TABLE proposals enable row level security;

DROP POLICY IF EXISTS "public read proposals" ON proposals;
CREATE POLICY "public read proposals" ON proposals FOR SELECT USING (true);

DROP POLICY IF EXISTS "own insert proposal" ON proposals;
CREATE POLICY "own insert proposal" ON proposals FOR INSERT WITH CHECK (
  auth.uid() = freelancer_id AND
  exists (select 1 from jobs where id = task_id and status = 'open')
);

DROP POLICY IF EXISTS "own update proposal" ON proposals;
CREATE POLICY "own update proposal" ON proposals FOR UPDATE USING (auth.uid() = freelancer_id);

DROP POLICY IF EXISTS "client update proposal status" ON proposals;
CREATE POLICY "client update proposal status" ON proposals FOR UPDATE
  USING (auth.uid() in (select client_id from jobs where id = task_id));

-- 5. Создаём бакет covers (если нет)
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- 5a. Создаём бакет avatars (если нет)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 6. RLS политики для бакета covers
DROP POLICY IF EXISTS "covers: select for all" ON storage.objects;
CREATE POLICY "covers: select for all" ON storage.objects FOR SELECT USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "covers: insert for authenticated" ON storage.objects;
CREATE POLICY "covers: insert for authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'covers' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "covers: update for owner" ON storage.objects;
CREATE POLICY "covers: update for owner" ON storage.objects FOR UPDATE USING (bucket_id = 'covers' AND auth.uid() = owner);

DROP POLICY IF EXISTS "covers: delete for owner" ON storage.objects;
CREATE POLICY "covers: delete for owner" ON storage.objects FOR DELETE USING (bucket_id = 'covers' AND auth.uid() = owner);

-- 7. Создаём бакет portfolio (если нет)
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- 8. RLS политики для бакета portfolio
DROP POLICY IF EXISTS "portfolio images: select for all" ON storage.objects;
CREATE POLICY "portfolio images: select for all" ON storage.objects FOR SELECT USING (bucket_id = 'portfolio');

DROP POLICY IF EXISTS "portfolio images: insert for authenticated" ON storage.objects;
CREATE POLICY "portfolio images: insert for authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'portfolio' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "portfolio images: update for owner" ON storage.objects;
CREATE POLICY "portfolio images: update for owner" ON storage.objects FOR UPDATE USING (bucket_id = 'portfolio' AND auth.uid() = owner);

DROP POLICY IF EXISTS "portfolio images: delete for owner" ON storage.objects;
CREATE POLICY "portfolio images: delete for owner" ON storage.objects FOR DELETE USING (bucket_id = 'portfolio' AND auth.uid() = owner);

-- 8a. Создаём бакет portfolio_videos (если нет)
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio_videos', 'portfolio_videos', true)
ON CONFLICT (id) DO NOTHING;

-- 8b. RLS политики для бакета portfolio_videos
DROP POLICY IF EXISTS "portfolio_videos: public read" ON storage.objects;
CREATE POLICY "portfolio_videos: public read" ON storage.objects FOR SELECT USING (bucket_id = 'portfolio_videos');

DROP POLICY IF EXISTS "portfolio_videos: auth upload own" ON storage.objects;
CREATE POLICY "portfolio_videos: auth upload own" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'portfolio_videos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "portfolio_videos: auth update own" ON storage.objects;
CREATE POLICY "portfolio_videos: auth update own" ON storage.objects FOR UPDATE USING (bucket_id = 'portfolio_videos' AND auth.uid() = owner);

DROP POLICY IF EXISTS "portfolio_videos: auth delete own" ON storage.objects;
CREATE POLICY "portfolio_videos: auth delete own" ON storage.objects FOR DELETE USING (bucket_id = 'portfolio_videos' AND auth.uid() = owner);

-- ============================================================
-- 9. Таблица уведомлений
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  body text,
  data jsonb,
  link text,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at desc);

ALTER TABLE notifications enable row level security;

DROP POLICY IF EXISTS "notifications: read own" ON notifications;
CREATE POLICY "notifications: read own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications: update own" ON notifications;
CREATE POLICY "notifications: update own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications: insert service" ON notifications;
CREATE POLICY "notifications: insert service" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 10. Добавляем поля доставки и прочтения в messages
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN delivered_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN read_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- 11. Включаем realtime для уведомлений
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ============================================================
-- 12. Добавляем is_admin и banned в profiles
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean not null default false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'banned'
  ) THEN
    ALTER TABLE profiles ADD COLUMN banned boolean not null default false;
  END IF;
END $$;

-- ============================================================
-- 13. Добавляем moderation_status в jobs и services
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE jobs ADD COLUMN moderation_status text default 'approved';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE services ADD COLUMN moderation_status text default 'approved';
  END IF;
END $$;

-- ============================================================
-- 14. Таблица жалоб
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
  id uuid primary key default gen_random_uuid(),
  complainant_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('job','service','user')),
  target_id uuid not null,
  reason text not null,
  status text default 'pending' check (status in ('pending','resolved','dismissed')),
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_complainant ON complaints (complainant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints (status);

ALTER TABLE complaints enable row level security;

DROP POLICY IF EXISTS "complaints: insert own" ON complaints;
CREATE POLICY "complaints: insert own" ON complaints
  FOR INSERT WITH CHECK (auth.uid() = complainant_id);

DROP POLICY IF EXISTS "complaints: read own or admin" ON complaints;
CREATE POLICY "complaints: read own or admin" ON complaints
  FOR SELECT USING (auth.uid() = complainant_id OR public.is_admin());

DROP POLICY IF EXISTS "complaints: update admin" ON complaints;
CREATE POLICY "complaints: update admin" ON complaints
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 15. Таблица запросов на вывод средств
-- ============================================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount int not null check (amount > 0),
  payment_details text not null,
  status text default 'pending' check (status in ('pending','approved','rejected','paid')),
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals (user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals (status);

ALTER TABLE withdrawals enable row level security;

DROP POLICY IF EXISTS "withdrawals: insert own" ON withdrawals;
CREATE POLICY "withdrawals: insert own" ON withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "withdrawals: read own or admin" ON withdrawals;
CREATE POLICY "withdrawals: read own or admin" ON withdrawals
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "withdrawals: update admin" ON withdrawals;
CREATE POLICY "withdrawals: update admin" ON withdrawals
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 16. RLS: admin override для profiles/jobs/services
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS
$$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true); $$;

DROP POLICY IF EXISTS "admin update profiles" ON profiles;
CREATE POLICY "admin update profiles" ON profiles
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin update jobs" ON jobs;
CREATE POLICY "admin update jobs" ON jobs
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin update services" ON services;
CREATE POLICY "admin update services" ON services
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 17a. Bookmarks
-- ============================================================
CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('job','service','freelancer')),
  target_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks (user_id);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own bookmarks" ON bookmarks;
CREATE POLICY "Users can read own bookmarks" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own bookmarks" ON bookmarks;
CREATE POLICY "Users can insert own bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;
CREATE POLICY "Users can delete own bookmarks" ON bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 18. target_role для двусторонних отзывов
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'target_role'
  ) THEN
    ALTER TABLE reviews ADD COLUMN target_role text default 'freelancer' check (target_role in ('freelancer', 'client'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_order_id_key' AND table_name = 'reviews'
  ) THEN
    ALTER TABLE reviews DROP CONSTRAINT reviews_order_id_key;
    ALTER TABLE reviews ADD CONSTRAINT reviews_order_role_unique UNIQUE (order_id, target_role);
  END IF;
END $$;

-- ============================================================
-- 19. payment_proof для заказов + payment_details для профилей
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_proof'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_proof text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'payment_details'
  ) THEN
    ALTER TABLE profiles ADD COLUMN payment_details text;
  END IF;
END $$;

-- 20. Обеспечиваем realtime для всех таблиц с подпиской
-- ============================================================
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['notifications','complaints','withdrawals','messages','reviews','orders','chats','jobs','services','applications','profiles','proposals','bookmarks','portfolio'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', tbl);
    END IF;
  END LOOP;
END $$;

-- Add new tables to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tavern_projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tavern_projects;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tavern_proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tavern_proposals;
  END IF;
END $$;

-- ============================================================
-- 21. Таверна — Таблица проектов (биржи заказов)
-- ============================================================
CREATE TABLE IF NOT EXISTS tavern_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  budget int,
  category text not null,
  client_id uuid not null references profiles(id) on delete cascade,
  status text default 'open' check (status in ('open','closed','cancelled')),
  proposal_count int default 0,
  created_at timestamptz default now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tavern_projects_category ON tavern_projects (category);
CREATE INDEX IF NOT EXISTS idx_tavern_projects_client ON tavern_projects (client_id);
CREATE INDEX IF NOT EXISTS idx_tavern_projects_status ON tavern_projects (status);
CREATE INDEX IF NOT EXISTS idx_tavern_projects_created ON tavern_projects (created_at desc);

ALTER TABLE tavern_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tavern_projects: select all" ON tavern_projects;
CREATE POLICY "tavern_projects: select all" ON tavern_projects
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tavern_projects: insert auth" ON tavern_projects;
CREATE POLICY "tavern_projects: insert auth" ON tavern_projects
  FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "tavern_projects: update owner" ON tavern_projects;
CREATE POLICY "tavern_projects: update owner" ON tavern_projects
  FOR UPDATE USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "tavern_projects: delete owner" ON tavern_projects;
CREATE POLICY "tavern_projects: delete owner" ON tavern_projects
  FOR DELETE USING (auth.uid() = client_id);

-- ============================================================
-- 22. Таверна — Таблица откликов на проекты
-- ============================================================
CREATE TABLE IF NOT EXISTS tavern_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references tavern_projects(id) on delete cascade,
  freelancer_id uuid not null references profiles(id) on delete cascade,
  cover_letter text not null,
  price int not null,
  status text default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz default now(),
  unique (project_id, freelancer_id)
);

CREATE INDEX IF NOT EXISTS idx_tavern_proposals_project ON tavern_proposals (project_id);
CREATE INDEX IF NOT EXISTS idx_tavern_proposals_freelancer ON tavern_proposals (freelancer_id);

ALTER TABLE tavern_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tavern_proposals: select all" ON tavern_proposals;
CREATE POLICY "tavern_proposals: select all" ON tavern_proposals
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tavern_proposals: insert freelancer" ON tavern_proposals;
CREATE POLICY "tavern_proposals: insert freelancer" ON tavern_proposals
  FOR INSERT WITH CHECK (
    auth.uid() = freelancer_id AND
    exists (select 1 from tavern_projects where id = project_id and status = 'open')
  );

DROP POLICY IF EXISTS "tavern_proposals: update freelancer" ON tavern_proposals;
CREATE POLICY "tavern_proposals: update freelancer" ON tavern_proposals
  FOR UPDATE USING (auth.uid() = freelancer_id);

DROP POLICY IF EXISTS "tavern_proposals: update client" ON tavern_proposals;
CREATE POLICY "tavern_proposals: update client" ON tavern_proposals
  FOR UPDATE USING (auth.uid() in (select client_id from tavern_projects where id = project_id));

-- ============================================================
-- 23. Добавляем connects_remaining в profiles
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'connects_remaining'
  ) THEN
    ALTER TABLE profiles ADD COLUMN connects_remaining int not null default 50;
  END IF;
END $$;

-- ============================================================
-- 24. Эскроу-система (Safe Deal)
-- ============================================================

-- Добавляем escrow_amount в orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'escrow_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN escrow_amount int default 0;
  END IF;
END $$;

-- Добавляем dispute_reason в orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'dispute_reason'
  ) THEN
    ALTER TABLE orders ADD COLUMN dispute_reason text;
  END IF;
END $$;

-- Обновляем статус orders — добавляем 'disputed'
-- (существующий check constraint нужно пересоздать)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'orders' AND c.conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_payment','paid','in_progress','waiting_for_approval','completed','cancelled','disputed'));

-- Обновляем триггер check_order_transition для эскроу
CREATE OR REPLACE FUNCTION public.check_order_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  allowed text[];
  who text;
begin
  if old.status = new.status then return new; end if;

  allowed := case old.status
    when 'pending_payment'    then array['paid','cancelled']
    when 'paid'               then array['in_progress','cancelled','disputed']
    when 'in_progress'        then array['waiting_for_approval','cancelled','disputed']
    when 'waiting_for_approval' then array['completed','in_progress','cancelled','disputed']
    when 'disputed'           then array['completed','cancelled']
    when 'completed'          then array[]::text[]
    when 'cancelled'          then array[]::text[]
    else array[]::text[]
  end;

  if not (new.status = any(allowed)) then
    raise exception 'Invalid order status transition: % -> %', old.status, new.status;
  end if;

  who := case
    when old.status = 'pending_payment' and new.status = 'paid' then 'client'
    when old.status = 'paid' and new.status = 'in_progress' then 'freelancer'
    when old.status = 'in_progress' and new.status = 'waiting_for_approval' then 'freelancer'
    when old.status = 'waiting_for_approval' and new.status = 'completed' then 'client'
    when old.status = 'waiting_for_approval' and new.status = 'in_progress' then 'client'
    when old.status = 'in_progress' and new.status = 'disputed' then 'both'
    when old.status = 'waiting_for_approval' and new.status = 'disputed' then 'both'
    when old.status = 'paid' and new.status = 'disputed' then 'both'
    when old.status = 'disputed' and new.status = 'completed' then 'admin'
    when old.status = 'disputed' and new.status = 'cancelled' then 'admin'
    else 'any'
  end;

  if who <> 'any' and who <> 'admin' then
    if who = 'both' then
      -- both client and freelancer can dispute
      if new.status = 'disputed' then
        if auth.uid() is distinct from old.client_id and auth.uid() is distinct from old.freelancer_id then
          raise exception 'Only order participants can dispute';
        end if;
      end if;
    else
      if auth.uid() is distinct from (case who when 'client' then old.client_id else old.freelancer_id end) then
        -- allow admin override
        if not public.is_admin() then
          raise exception 'Only % can perform this transition', who;
        end if;
      end if;
    end if;
  end if;

  -- prevent freelancer from changing price, client_id, freelancer_id
  if new.price is distinct from old.price
     or new.freelancer_id is distinct from old.freelancer_id
     or new.client_id is distinct from old.client_id
  then
    raise exception 'Cannot change order price or participants';
  end if;

  return new;
end;
$$;

-- RPC: эскроу-оплата — списать с баланса заказчика, записать escrow_amount (клиент или админ)
CREATE OR REPLACE FUNCTION public.escrow_pay(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_order record;
  v_client_balance int;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status != 'pending_payment' then raise exception 'Order is not pending_payment'; end if;
  if auth.uid() != v_order.client_id and not public.is_admin() then
    raise exception 'Only the client or admin can pay';
  end if;

  select balance into v_client_balance from profiles where id = v_order.client_id;
  if v_client_balance < v_order.price then raise exception 'Insufficient balance'; end if;

  update profiles set balance = balance - v_order.price where id = v_order.client_id and balance >= v_order.price;
  if not found then raise exception 'Insufficient balance (race condition)'; end if;

  update orders set
    status = 'paid',
    escrow_amount = v_order.price,
    payment_proof = 'escrow',
    updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;

-- RPC: эскроу-возврат — вернуть заказчику при отмене (клиент или админ)
CREATE OR REPLACE FUNCTION public.escrow_refund(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_order record;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_order.escrow_amount is null or v_order.escrow_amount = 0 then
    raise exception 'No escrow to refund';
  end if;
  if auth.uid() != v_order.client_id and not public.is_admin() then
    raise exception 'Only the client or admin can refund';
  end if;

  update profiles set balance = balance + v_order.escrow_amount where id = v_order.client_id;
  update orders set
    escrow_amount = 0,
    updated_at = now()
  where id = p_order_id;
  return true;
end;
$$;

-- RPC: зачислить фрилансеру при завершении заказа (только админ)
CREATE OR REPLACE FUNCTION public.credit_freelancer(p_user_id uuid, p_amount int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  if not public.is_admin() then
    raise exception 'Доступ только администратору';
  end if;
  update profiles set balance = balance + p_amount
  where id = p_user_id;
  return found;
end;
$$;

-- Триггер: автовыплата escrow при завершении или возврат при отмене
CREATE OR REPLACE FUNCTION public.auto_escrow_release() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  if new.status = 'completed' and old.status != 'completed' and new.escrow_amount > 0 then
    update profiles set balance = balance + new.escrow_amount where id = new.freelancer_id;
    update orders set escrow_amount = 0 where id = new.id;
  end if;
  if new.status = 'cancelled' and old.status != 'cancelled' and new.escrow_amount > 0 then
    update profiles set balance = balance + new.escrow_amount where id = new.client_id;
    update orders set escrow_amount = 0 where id = new.id;
  end if;
  return null;
end;
$$;
DROP TRIGGER IF EXISTS trg_escrow_release ON orders;
CREATE TRIGGER trg_escrow_release
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_escrow_release();

-- Публичное view для профилей (без sensitive полей)
CREATE OR REPLACE VIEW public_profiles AS
SELECT id, name, role, bio, avatar_url, cover_url, specialization, rating, reviews_count,
       orders_done, orders_total, last_seen, notif_prefs, created_at
FROM profiles;

-- Добавляем orders в realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

-- 11. Таблица учёта времени time_entries
CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time_entries_participants" ON public.time_entries
  FOR ALL USING (
    user_id = auth.uid()
    OR order_id IN (
      SELECT id FROM public.orders WHERE client_id = auth.uid() OR freelancer_id = auth.uid()
    )
  );

-- Добавляем время в realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'time_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE time_entries;
  END IF;
END $$;

-- ============================================================
-- 25. Исправления безопасности (v2)
-- ============================================================

-- Защищаем connects_remaining в own update profile (если политика существует)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'own update profile' AND tablename = 'profiles') THEN
    DROP POLICY IF EXISTS "own update profile" ON profiles;
    CREATE POLICY "own update profile" ON profiles FOR UPDATE USING (auth.uid() = id)
      WITH CHECK (
        auth.uid() = id
        AND (is_admin is not distinct from (select is_admin from profiles where id = id))
        AND (banned is not distinct from (select banned from profiles where id = id))
        AND (balance is not distinct from (select balance from profiles where id = id))
        AND (connects_remaining is not distinct from (select connects_remaining from profiles where id = id))
      );
  END IF;
END $$;

-- Исправляем политику messages insert — проверяем членство в чате
DROP POLICY IF EXISTS "sender insert message" ON messages;
CREATE POLICY "sender insert message" ON messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND auth.uid() IN (
    SELECT client_id FROM chats WHERE id = chat_id
    UNION
    SELECT freelancer_id FROM chats WHERE id = chat_id
  )
);

-- Safe HTML escape helper (для email_triggers)
CREATE OR REPLACE FUNCTION public.esc_html(s text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(replace(replace(replace(s, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;
