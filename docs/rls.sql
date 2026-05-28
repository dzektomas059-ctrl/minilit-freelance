-- enable RLS
alter table profiles enable row level security;
alter table jobs enable row level security;
alter table services enable row level security;
alter table applications enable row level security;
alter table orders enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;
alter table bookmarks enable row level security;

-- drop old policies if any
do $$ declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname='public' and tablename in
             ('profiles','jobs','services','applications','orders','chats','messages','reviews','notifications','complaints','withdrawals','bookmarks','portfolio','proposals')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- public read profiles (non-sensitive fields only via view)
create view public_profiles as
select id, name, role, bio, avatar_url, cover_url, specialization, rating, reviews_count,
       orders_done, orders_total, last_seen, notif_prefs, created_at
from profiles;
create policy "public read profiles" on profiles for select using (true);
create policy "public read jobs"     on jobs     for select using (true);
create policy "public read services" on services for select using (true);
create policy "public read reviews"  on reviews  for select using (true);

-- profiles: each user can insert/update own row (but NOT is_admin/banned/balance)
create policy "own insert profile"  on profiles for insert with check (auth.uid() = id);
create policy "own update profile"  on profiles for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (is_admin is not distinct from (select is_admin from profiles where id = id))
    and (banned is not distinct from (select banned from profiles where id = id))
    and (balance is not distinct from (select balance from profiles where id = id))
    and (connects_remaining is not distinct from (select connects_remaining from profiles where id = id))
  );

-- jobs: client owns
create policy "own insert job" on jobs for insert with check (auth.uid() = client_id);
create policy "own update job" on jobs for update using (auth.uid() = client_id);
create policy "own delete job" on jobs for delete using (auth.uid() = client_id);

-- services: freelancer owns
create policy "own insert service" on services for insert with check (auth.uid() = freelancer_id);
create policy "own update service" on services for update using (auth.uid() = freelancer_id);
create policy "own delete service" on services for delete using (auth.uid() = freelancer_id);

-- applications: freelancer creates; both parties read
create policy "own insert application" on applications for insert with check (auth.uid() = freelancer_id);
create policy "members read application" on applications for select
  using (
    auth.uid() = freelancer_id or
    auth.uid() in (select client_id from jobs where id = job_id)
  );
create policy "client update application" on applications for update
  using (auth.uid() in (select client_id from jobs where id = job_id));

-- orders: client creates; both parties read & update status; admin can resolve disputes
create policy "own insert order" on orders for insert with check (auth.uid() = client_id);
create policy "members read order"  on orders for select using (auth.uid() in (client_id, freelancer_id) or public.is_admin());
create policy "members update order" on orders for update using (auth.uid() in (client_id, freelancer_id) or public.is_admin());

-- chats: members create/read
create policy "members insert chat" on chats for insert with check (auth.uid() in (client_id, freelancer_id));
create policy "members read chat"   on chats for select using (auth.uid() in (client_id, freelancer_id));
create policy "members update chat" on chats for update using (auth.uid() in (client_id, freelancer_id));

-- messages: members read; sender insert; members update (delivery/read)
create policy "members read messages" on messages for select
  using (auth.uid() in (
    select client_id from chats where id = chat_id
    union
    select freelancer_id from chats where id = chat_id
  ));
create policy "sender insert message" on messages for insert with check (
  auth.uid() = sender_id
  and auth.uid() in (
    select client_id from chats where id = chat_id
    union
    select freelancer_id from chats where id = chat_id
  )
);
create policy "members update message status" on messages for update
  using (auth.uid() in (
    select client_id from chats where id = chat_id
    union
    select freelancer_id from chats where id = chat_id
  ));

-- reviews: client (reviewer) inserts
create policy "own insert review" on reviews for insert with check (auth.uid() = reviewer_id);

-- bookmarks: owner-only
create policy "Users can read own bookmarks"
  on bookmarks for select using (auth.uid() = user_id);
create policy "Users can insert own bookmarks"
  on bookmarks for insert with check (auth.uid() = user_id);
create policy "Users can delete own bookmarks"
  on bookmarks for delete using (auth.uid() = user_id);

-- notifications: enable RLS
alter table notifications enable row level security;

create policy "notifications: read own" on notifications
  for select using (auth.uid() = user_id);

create policy "notifications: update own" on notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications: insert service" on notifications
  for insert with check (auth.uid() = user_id);

-- portfolio: owner manages; public reads
alter table portfolio enable row level security;

create policy "public read portfolio" on portfolio for select using (true);

create policy "own insert portfolio" on portfolio for insert with check (auth.uid() = user_id);

create policy "own update portfolio" on portfolio for update using (auth.uid() = user_id);

create policy "own delete portfolio" on portfolio for delete using (auth.uid() = user_id);

-- proposals: freelancer creates; both parties read; freelancer updates/withdraws
alter table proposals enable row level security;

create policy "public read proposals" on proposals for select using (true);

create policy "own insert proposal" on proposals for insert with check (
  auth.uid() = freelancer_id and
  exists (select 1 from jobs where id = task_id and status = 'open')
);

create policy "own update proposal" on proposals for update using (auth.uid() = freelancer_id);

create policy "client update proposal status" on proposals for update
  using (auth.uid() in (select client_id from jobs where id = task_id));

-- admin helper: returns true if the current user has is_admin flag
create or replace function public.is_admin() returns boolean
language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin = true);
$$;

-- complaints: enable RLS
alter table complaints enable row level security;

create policy "complaints: insert own" on complaints
  for insert with check (auth.uid() = complainant_id);

create policy "complaints: read own or admin" on complaints
  for select using (auth.uid() = complainant_id or public.is_admin());

create policy "complaints: update admin" on complaints
  for update using (public.is_admin()) with check (public.is_admin());

-- withdrawals: enable RLS
alter table withdrawals enable row level security;

create policy "withdrawals: insert own" on withdrawals
  for insert with check (auth.uid() = user_id);

create policy "withdrawals: read own or admin" on withdrawals
  for select using (auth.uid() = user_id or public.is_admin());

create policy "withdrawals: update admin" on withdrawals
  for update using (public.is_admin()) with check (public.is_admin());

-- admin override: admins can update any profile (ban/unban)
create policy "admin update profiles" on profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- admin override: admins can moderate jobs
create policy "admin update jobs" on jobs
  for update using (public.is_admin()) with check (public.is_admin());

-- admin override: admins can moderate services
create policy "admin update services" on services
  for update using (public.is_admin()) with check (public.is_admin());

-- add to realtime publication (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'complaints'
  ) then
    alter publication supabase_realtime add table complaints;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'withdrawals'
  ) then
    alter publication supabase_realtime add table withdrawals;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'portfolio'
  ) then
    alter publication supabase_realtime add table portfolio;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'proposals'
  ) then
    alter publication supabase_realtime add table proposals;
  end if;
end $$;
