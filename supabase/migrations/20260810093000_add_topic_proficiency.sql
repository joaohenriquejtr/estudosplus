CREATE TABLE IF NOT EXISTS public.topic_proficiency (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  note_id uuid REFERENCES public.content_cards(id) ON DELETE CASCADE NOT NULL,
  score integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  streak integer DEFAULT 0,
  last_reviewed timestamptz,
  next_review timestamptz,
  total_attempts integer DEFAULT 0,
  correct_attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, note_id)
);

ALTER TABLE public.topic_proficiency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own proficiency" ON public.topic_proficiency FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_proficiency TO authenticated;

CREATE OR REPLACE FUNCTION public.record_flashcard_attempt(p_note_id uuid, p_correct boolean)
RETURNS public.topic_proficiency
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE result public.topic_proficiency;
BEGIN
  INSERT INTO public.topic_proficiency (user_id, note_id, score, streak, last_reviewed, total_attempts, correct_attempts)
  VALUES (auth.uid(), p_note_id, CASE WHEN p_correct THEN 15 ELSE 0 END, CASE WHEN p_correct THEN 1 ELSE 0 END, now(), 1, CASE WHEN p_correct THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, note_id) DO UPDATE SET
    total_attempts = topic_proficiency.total_attempts + 1,
    correct_attempts = topic_proficiency.correct_attempts + CASE WHEN p_correct THEN 1 ELSE 0 END,
    score = LEAST(100, GREATEST(0, topic_proficiency.score + CASE WHEN p_correct THEN 15 ELSE -10 END)),
    streak = CASE WHEN p_correct THEN topic_proficiency.streak + 1 ELSE 0 END,
    last_reviewed = now()
  RETURNING * INTO result;

  UPDATE public.topic_proficiency SET next_review = now() + CASE
    WHEN result.score < 40 THEN interval '1 day'
    WHEN result.score <= 70 THEN interval '3 days'
    ELSE interval '7 days'
  END WHERE id = result.id RETURNING * INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_weak_topics(p_subject_id uuid, p_limit int DEFAULT 10)
RETURNS TABLE(note_id uuid, title text, score int, next_review timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.note_id, c.title, p.score, p.next_review
  FROM public.topic_proficiency p JOIN public.content_cards c ON c.id = p.note_id
  WHERE p.user_id = auth.uid() AND c.subject_id = p_subject_id AND (p.score < 60 OR p.next_review <= now())
  ORDER BY p.score ASC, p.next_review ASC NULLS FIRST LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.get_proficiency_stats(p_subject_id uuid)
RETURNS TABLE(avg_score numeric, total_topics bigint, weak_topics bigint, max_streak int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(avg(p.score), 0), count(*), count(*) FILTER (WHERE p.score < 60 OR p.next_review <= now()), COALESCE(max(p.streak), 0)
  FROM public.topic_proficiency p JOIN public.content_cards c ON c.id = p.note_id
  WHERE p.user_id = auth.uid() AND c.subject_id = p_subject_id;
$$;

GRANT EXECUTE ON FUNCTION public.record_flashcard_attempt(uuid, boolean), public.get_weak_topics(uuid, int), public.get_proficiency_stats(uuid) TO authenticated;
