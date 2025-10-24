-- First verify the table structure exists
CREATE TABLE IF NOT EXISTS document_embeddings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    content text,
    user_id text,
    file_name text,
    page_number integer,
    metadata jsonb,
    embedding vector(1024),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Drop and recreate the search function with correct UUID type
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  user_id text,
  file_name text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    document_embeddings.user_id,
    document_embeddings.file_name,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  WHERE 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;