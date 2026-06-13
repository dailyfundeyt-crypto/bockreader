
CREATE POLICY "books read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "books insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "books update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "books delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'books' AND auth.uid()::text = (storage.foldername(name))[1]);

ALTER TABLE public.books ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.books ALTER COLUMN drive_file_id DROP NOT NULL;
