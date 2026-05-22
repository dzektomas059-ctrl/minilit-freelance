-- MiniLIT cover photos storage
insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict (id) do nothing;

create policy "covers: select for all" on storage.objects for select using (bucket_id = 'covers');
create policy "covers: insert for authenticated" on storage.objects for insert with check (bucket_id = 'covers' and auth.role() = 'authenticated');
create policy "covers: update for owner" on storage.objects for update using (bucket_id = 'covers' and auth.uid() = owner);
create policy "covers: delete for owner" on storage.objects for delete using (bucket_id = 'covers' and auth.uid() = owner);
