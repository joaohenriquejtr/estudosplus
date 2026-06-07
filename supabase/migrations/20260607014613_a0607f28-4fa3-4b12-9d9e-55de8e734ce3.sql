
-- Chapters table
CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chapters" ON public.chapters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add chapter_id to content_cards (nullable so existing cards remain)
ALTER TABLE public.content_cards ADD COLUMN chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL;
ALTER TABLE public.content_cards ADD COLUMN category text NOT NULL DEFAULT 'anotacao';
-- category: anotacao | resumo | exercicio | material

-- Weekly schedule slots
CREATE TABLE public.schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_slots TO authenticated;
GRANT ALL ON public.schedule_slots TO service_role;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own schedule" ON public.schedule_slots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
