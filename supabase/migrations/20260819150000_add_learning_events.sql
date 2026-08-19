CREATE TABLE IF NOT EXISTS public.learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'NOTE_VIEWED',
    'NOTE_REVIEWED',
    'FLASHCARD_CORRECT',
    'FLASHCARD_INCORRECT',
    'SOCRATIC_SESSION',
    'EXERCISE_COMPLETED',
    'STUDY_SESSION_COMPLETED',
    'PLAN_ITEM_COMPLETED',
    'PLAN_ITEM_SKIPPED',
    'PLAN_ITEM_DEFERRED',
    'PLAN_ITEM_REPLACED'
  )),
  note_id uuid REFERENCES public.content_cards(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_events_user_occurred_idx
  ON public.learning_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS learning_events_note_occurred_idx
  ON public.learning_events (note_id, occurred_at DESC)
  WHERE note_id IS NOT NULL;

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own learning events read" ON public.learning_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own learning events insert" ON public.learning_events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      note_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.content_cards card
        WHERE card.id = learning_events.note_id
          AND card.user_id = auth.uid()
      )
    )
    AND (
      subject_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.subjects subject
        WHERE subject.id = learning_events.subject_id
          AND subject.user_id = auth.uid()
      )
    )
  );

GRANT SELECT, INSERT ON public.learning_events TO authenticated;
