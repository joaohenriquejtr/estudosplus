ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.chapters(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS chapters_parent_id_idx ON public.chapters(parent_id);
ALTER TABLE public.content_cards ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS content_cards_touch_updated_at ON public.content_cards;
CREATE TRIGGER content_cards_touch_updated_at BEFORE UPDATE ON public.content_cards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();