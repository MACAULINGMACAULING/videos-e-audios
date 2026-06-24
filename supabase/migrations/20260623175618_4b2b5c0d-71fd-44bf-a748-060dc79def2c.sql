
-- Updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ ARCHIVES ============
CREATE TABLE public.archives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  format JSONB NOT NULL,
  compatible_viewers TEXT[] NOT NULL DEFAULT '{}',
  autoplay BOOLEAN NOT NULL DEFAULT false,
  loop BOOLEAN NOT NULL DEFAULT false,
  token_path TEXT,
  token_type TEXT,
  payload_path TEXT,
  payload_mime TEXT,
  payload_extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archives TO authenticated;
GRANT ALL ON public.archives TO service_role;
ALTER TABLE public.archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own archives"
ON public.archives
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX archives_owner_idx ON public.archives(owner_id, updated_at DESC);

CREATE TRIGGER archives_updated_at
BEFORE UPDATE ON public.archives
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VIEWERS ============
CREATE TABLE public.viewers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  accepts TEXT[] NOT NULL DEFAULT '{}',
  controls JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution TEXT NOT NULL DEFAULT '1280x720',
  background_path TEXT,
  background_type TEXT,
  token_path TEXT,
  token_type TEXT,
  sounds JSONB NOT NULL DEFAULT '{}'::jsonb,
  scene JSONB NOT NULL DEFAULT '{"items": []}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.viewers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewers TO authenticated;
GRANT ALL ON public.viewers TO service_role;
ALTER TABLE public.viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own viewers"
ON public.viewers
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "public viewers readable by anyone"
ON public.viewers
FOR SELECT
TO anon, authenticated
USING (is_public = true);

CREATE INDEX viewers_owner_idx ON public.viewers(owner_id, updated_at DESC);
CREATE INDEX viewers_public_id_idx ON public.viewers(public_id);

CREATE TRIGGER viewers_updated_at
BEFORE UPDATE ON public.viewers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE POLICIES ============
-- archive-files bucket (private): owner-only access by path prefix <owner_id>/...
CREATE POLICY "archive owners read own files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'archive-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "archive owners insert own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'archive-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "archive owners update own files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'archive-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "archive owners delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'archive-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- viewer-assets bucket (public read, owner write)
CREATE POLICY "viewer assets public read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'viewer-assets');

CREATE POLICY "viewer assets owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'viewer-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "viewer assets owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'viewer-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "viewer assets owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'viewer-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
