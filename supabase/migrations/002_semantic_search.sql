-- Migration: Add semantic search function
-- Created: 2026-01-30

-- Function for semantic search using vector embeddings
create or replace function semantic_search(
  query_embedding vector(1536),
  user_uuid uuid,
  match_count int default 20,
  similarity_threshold float default 0.7
)
returns table (
  id uuid,
  title text,
  excerpt text,
  url text,
  image_url text,
  site_name text,
  author text,
  created_at timestamp with time zone,
  similarity float
) as $$
begin
  return query
  select
    s.id,
    s.title,
    s.excerpt,
    s.url,
    s.image_url,
    s.site_name,
    s.author,
    s.created_at,
    1 - (s.content_embedding <=> query_embedding) as similarity
  from saves s
  where s.user_id = user_uuid
    and s.content_embedding is not null
    and s.is_archived = false
    and 1 - (s.content_embedding <=> query_embedding) > similarity_threshold
  order by s.content_embedding <=> query_embedding
  limit match_count;
end;
$$ language plpgsql;

-- Function for finding similar images based on visual embeddings
create or replace function find_similar_images(
  query_embedding vector(1536),
  user_uuid uuid,
  match_count int default 12,
  similarity_threshold float default 0.7
)
returns table (
  id uuid,
  title text,
  image_url text,
  image_aesthetic_description text,
  similarity float
) as $$
begin
  return query
  select
    s.id,
    s.title,
    s.image_url,
    s.image_aesthetic_description,
    1 - (s.image_embedding <=> query_embedding) as similarity
  from saves s
  where s.user_id = user_uuid
    and s.image_embedding is not null
    and s.is_archived = false
    and s.image_url is not null
    and 1 - (s.image_embedding <=> query_embedding) > similarity_threshold
  order by s.image_embedding <=> query_embedding
  limit match_count;
end;
$$ language plpgsql;

-- Note: Comments skipped to avoid function name uniqueness issues
-- semantic_search: Find saves semantically similar to a query using content embeddings
-- find_similar_images: Find visually similar images using aesthetic embeddings
