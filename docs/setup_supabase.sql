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
  FOR INSERT WITH CHECK (true);

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
