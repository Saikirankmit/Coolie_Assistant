-- Drop existing column (this will remove existing embeddings)
ALTER TABLE document_embeddings 
DROP COLUMN IF EXISTS embedding;

-- Add the new column with 1024 dimensions
ALTER TABLE document_embeddings 
ADD COLUMN embedding vector(1024);

-- Drop existing function first
DROP FUNCTION IF EXISTS match_documents(vector(1024), float, int);

-- Recreate the similarity search function for 1024 dimensions
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