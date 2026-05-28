-- ============================================================================
-- Migration 002: Storage Buckets and Policies for MiniLIT
-- ============================================================================

-- ############################################################################
-- 1. BUCKET "media" (public)
-- ############################################################################

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: INSERT by authenticated, SELECT for everyone
CREATE POLICY "media_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "media_select_public"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'media'
  );

-- ############################################################################
-- 2. BUCKET "avatars" (public)
-- ############################################################################

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: INSERT / UPDATE / DELETE by own profile match; SELECT public
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ############################################################################
-- 3. BUCKET "covers" (public)
-- ############################################################################

INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: same as avatars — own profile match; SELECT public
CREATE POLICY "covers_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

CREATE POLICY "covers_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'covers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "covers_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "covers_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ############################################################################
-- 4. BUCKET "chat-files" (public, for images and audio in chat)
-- ############################################################################

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: INSERT by any authenticated; SELECT public
CREATE POLICY "chat_files_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-files'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "chat_files_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files');

-- ############################################################################
-- 5. HELPER FUNCTION: get_public_url
-- Returns the full public URL for a given bucket and object path.
-- ############################################################################

CREATE OR REPLACE FUNCTION get_public_url(bucket TEXT, path TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN 'https://' || (SELECT decr FROM pg_settings WHERE name = 'supabase_url')
         || '/storage/v1/object/public/' || bucket || '/' || path;
END;
$$;
