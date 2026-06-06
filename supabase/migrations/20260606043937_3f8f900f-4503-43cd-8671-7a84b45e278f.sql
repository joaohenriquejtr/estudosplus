CREATE TABLE public.event_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(event_id, subject_id)
);

GRANT SELECT, INSERT, DELETE ON public.event_subjects TO authenticated;
GRANT ALL ON public.event_subjects TO service_role;

ALTER TABLE public.event_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own event_subjects"
  ON public.event_subjects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);