CREATE TABLE IF NOT EXISTS public.exam_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  topic_name text NOT NULL CHECK (length(trim(topic_name)) > 0),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, subject_id, topic_name)
);

CREATE INDEX IF NOT EXISTS idx_exam_topics_exam ON public.exam_topics (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_topics_subject ON public.exam_topics (subject_id);

ALTER TABLE public.exam_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own exam topics" ON public.exam_topics
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = exam_topics.exam_id AND e.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = exam_topics.exam_id AND e.user_id = auth.uid()
  ) AND EXISTS (
    SELECT 1 FROM public.event_subjects es
    WHERE es.event_id = exam_topics.exam_id AND es.subject_id = exam_topics.subject_id
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_topics TO authenticated;
