-- storage RLS for portfolio_videos bucket
-- public read; authenticated users (freelancers) can upload their own files
-- file path convention: <freelancer_id>/<filename>

drop policy if exists "portfolio_videos: public read"        on storage.objects;
drop policy if exists "portfolio_videos: auth upload own"    on storage.objects;
drop policy if exists "portfolio_videos: auth update own"    on storage.objects;
drop policy if exists "portfolio_videos: auth delete own"    on storage.objects;

create policy "portfolio_videos: public read" on storage.objects
  for select using (bucket_id = 'portfolio_videos');

create policy "portfolio_videos: auth upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'portfolio_videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portfolio_videos: auth update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'portfolio_videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portfolio_videos: auth delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'portfolio_videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
