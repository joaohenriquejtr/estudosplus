CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.content_cards ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS idx_content_cards_embedding
  ON public.content_cards USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  WHERE embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION public.match_content_cards(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_subject_id uuid,
  p_user_id uuid
) RETURNS TABLE(id uuid, title text, content text, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.id, c.title, c.text_content AS content,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM public.content_cards c
  WHERE c.subject_id = p_subject_id
    AND c.user_id = p_user_id
    AND c.content_type = 'text'
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_content_cards(vector, float, int, uuid, uuid) TO authenticated;
