-- MiniLIT schema
-- Drop everything first to allow re-run
drop table if exists reviews cascade;
drop table if exists messages cascade;
drop table if exists chats cascade;
drop table if exists orders cascade;
drop table if exists applications cascade;
drop table if exists services cascade;
drop table if exists jobs cascade;
drop table if exists profiles cascade;

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  role text check (role in ('freelancer', 'client')),
  bio text,
  avatar_url text,
  cover_url text,
  payment_details text,
  specialization text,
  rating numeric default 0,
  reviews_count int default 0,
  orders_done int default 0,
  orders_total int default 0,
  last_seen timestamptz default now(),
  balance int not null default 0,
  is_admin boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  budget int,
  category text,
  client_id uuid references profiles(id) on delete cascade,
  status text default 'open',
  moderation_status text default 'approved' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price int,
  category text,
  freelancer_id uuid references profiles(id) on delete cascade,
  moderation_status text default 'approved' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  freelancer_id uuid references profiles(id) on delete cascade,
  message text,
  status text default 'pending',
  created_at timestamptz default now(),
  unique (job_id, freelancer_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete set null,
  client_id uuid references profiles(id) on delete cascade,
  freelancer_id uuid references profiles(id) on delete cascade,
  status text default 'pending_payment' check (status in ('pending_payment','paid','in_progress','waiting_for_approval','completed','cancelled')),
  price int,
  title text,
  payment_proof text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table chats (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references profiles(id) on delete cascade,
  freelancer_id uuid references profiles(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  last_text text,
  last_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (client_id, freelancer_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  text text not null,
  read boolean default false,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  reviewer_id uuid references profiles(id) on delete cascade,
  freelancer_id uuid references profiles(id) on delete cascade,
  stars int check (stars between 1 and 5),
  text text,
  target_role text default 'freelancer' check (target_role in ('freelancer', 'client')),
  created_at timestamptz default now(),
  unique (order_id, target_role)
);

create table notifications (
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

create table complaints (
  id uuid primary key default gen_random_uuid(),
  complainant_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('job','service','user')),
  target_id uuid not null,
  reason text not null,
  status text default 'pending' check (status in ('pending','resolved','dismissed')),
  created_at timestamptz default now()
);

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount int not null check (amount > 0),
  payment_details text not null,
  status text default 'pending' check (status in ('pending','approved','rejected','paid')),
  created_at timestamptz default now()
);

-- helpful indexes
create index on jobs (client_id);
create index on jobs (created_at desc);
create index on services (freelancer_id);
create index on services (created_at desc);
create index on applications (job_id);
create index on applications (freelancer_id);
create index on orders (client_id);
create index on orders (freelancer_id);
create index on orders (status);
create index on chats (client_id);
create index on chats (freelancer_id);
create index on messages (chat_id, created_at);
create index on reviews (freelancer_id);
create index on notifications (user_id);
create index on notifications (created_at desc);
create index on complaints (complainant_id);
create index on complaints (status);
create index on withdrawals (user_id);
create index on withdrawals (status);

-- function & trigger to auto-create profile after signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- function to recompute freelancer stats
create or replace function public.recompute_profile_stats(uid uuid) returns void
language sql security definer as $$
  update profiles p set
    rating = coalesce((select round(avg(stars)::numeric, 2) from reviews where freelancer_id = uid and target_role = 'freelancer'), 0),
    reviews_count = coalesce((select count(*) from reviews where freelancer_id = uid and target_role = 'freelancer'), 0),
    orders_done = coalesce((select count(*) from orders where freelancer_id = uid and status = 'completed'), 0),
    orders_total = coalesce((select count(*) from orders where freelancer_id = uid), 0)
  where p.id = uid;
$$;

create or replace function public.on_review_change() returns trigger
language plpgsql security definer as $$
begin
  perform public.recompute_profile_stats(coalesce(new.freelancer_id, old.freelancer_id));
  return null;
end;
$$;

drop trigger if exists trg_review_stats on reviews;
create trigger trg_review_stats
  after insert or update or delete on reviews
  for each row execute function public.on_review_change();

create or replace function public.on_order_change() returns trigger
language plpgsql security definer as $$
begin
  perform public.recompute_profile_stats(coalesce(new.freelancer_id, old.freelancer_id));
  return null;
end;
$$;

drop trigger if exists trg_order_stats on orders;
create trigger trg_order_stats
  after insert or update or delete on orders
  for each row execute function public.on_order_change();

-- chat last_text trigger
create or replace function public.on_message_insert_chat() returns trigger
language plpgsql security definer as $$
begin
  update chats set last_text = new.text, last_at = new.created_at
  where id = new.chat_id;
  return null;
end;
$$;

drop trigger if exists trg_message_chat on messages;
create trigger trg_message_chat
  after insert on messages
  for each row execute function public.on_message_insert_chat();

-- Bookmarks
create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('job','service','freelancer')),
  target_id uuid not null,
  created_at timestamptz default now(),
  unique (user_id, target_type, target_id)
);
create index if not exists idx_bookmarks_user on bookmarks (user_id);

-- notification insert validation (prevents XSS via link field)
create or replace function public.validate_notification_insert() returns trigger
language plpgsql as $$
begin
  if new.link is not null and (new.link like '%<%' or new.link like '%"%') then
    raise exception 'Invalid notification link';
  end if;
  if new.title is not null and (new.title like '%<%' or new.title like '%"%') then
    raise exception 'Invalid notification title';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_notification on notifications;
create trigger trg_validate_notification
  before insert on notifications
  for each row execute function public.validate_notification_insert();

-- atomic withdrawal (race-condition safe)
create or replace function public.atomic_withdraw(p_user_id uuid, p_amount int)
returns boolean
language plpgsql security definer
as $$
begin
  update profiles set balance = balance - p_amount
  where id = p_user_id and balance >= p_amount;
  return found;
end;
$$;

-- atomic credit freelancer on order completion
create or replace function public.credit_freelancer(p_user_id uuid, p_amount int)
returns boolean
language plpgsql security definer
as $$
begin
  update profiles set balance = balance + p_amount
  where id = p_user_id;
  return found;
end;
$$;

-- Order state machine enforcer (server-side)
create or replace function public.check_order_transition() returns trigger
language plpgsql security definer as $$
declare
  allowed text[];
  who text;
begin
  if old.status = new.status then return new; end if;

  allowed := case old.status
    when 'pending_payment'    then array['paid','cancelled']
    when 'paid'               then array['in_progress','cancelled']
    when 'in_progress'        then array['waiting_for_approval','cancelled']
    when 'waiting_for_approval' then array['completed','in_progress','cancelled']
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
    else 'any'
  end;

  if who <> 'any' and who <> (select role from profiles where id = auth.uid()) then
    raise exception 'Only % can perform this transition', who;
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

drop trigger if exists trg_order_state on orders;
create trigger trg_order_state
  before update of status on orders
  for each row execute function public.check_order_transition();

-- prevent duplicate active orders
create unique index if not exists orders_active_unique on orders (service_id, client_id)
  where status in ('pending_payment', 'paid');