
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Storage policies: users access only their own folder
CREATE POLICY "users read own files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'study-materials' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users upload own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'study-materials' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'study-materials' AND auth.uid()::text = (storage.foldername(name))[1]);
