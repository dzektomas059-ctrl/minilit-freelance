-- MiniLIT portfolio schema
drop table if exists portfolio cascade;

create table portfolio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  category text,
  created_at timestamptz default now()
);

create index on portfolio (user_id);
create index on portfolio (created_at desc);

alter table portfolio enable row level security;

create policy "portfolio: select for all" on portfolio for select using (true);
create policy "portfolio: insert for owner" on portfolio for insert with check (auth.uid() = user_id);
create policy "portfolio: update for owner" on portfolio for update using (auth.uid() = user_id);
create policy "portfolio: delete for owner" on portfolio for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true) on conflict (id) do nothing;

create policy "portfolio images: select for all" on storage.objects for select using (bucket_id = 'portfolio');
create policy "portfolio images: insert for authenticated" on storage.objects for insert with check (bucket_id = 'portfolio' and auth.role() = 'authenticated');
create policy "portfolio images: update for owner" on storage.objects for update using (bucket_id = 'portfolio' and auth.uid() = owner);
create policy "portfolio images: delete for owner" on storage.objects for delete using (bucket_id = 'portfolio' and auth.uid() = owner);
