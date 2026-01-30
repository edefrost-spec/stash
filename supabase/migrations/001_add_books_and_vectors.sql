-- Migration: Add book support, vector embeddings, and image auto-tagging
-- Created: 2026-01-30

-- Enable pgvector extension for semantic search
create extension if not exists vector;

-- Add book-specific fields to saves table
alter table saves add column if not exists is_book boolean default false;
alter table saves add column if not exists book_isbn text;
alter table saves add column if not exists book_publication_date date;
alter table saves add column if not exists book_page_count integer;
alter table saves add column if not exists book_publisher text;
alter table saves add column if not exists book_edition text;

-- Add vector embedding columns for semantic search
alter table saves add column if not exists content_embedding vector(1536);
alter table saves add column if not exists image_embedding vector(1536);
alter table saves add column if not exists image_aesthetic_description text;

-- Add index for book filtering
create index if not exists saves_is_book_idx on saves(is_book) where is_book = true;

-- Vector indexes for fast similarity search
-- Note: Skipping index creation for now due to memory constraints (requires >32MB maintenance_work_mem)
-- Indexes can be added later when dataset is larger or memory is increased:
-- create index saves_content_embedding_idx on saves using ivfflat (content_embedding vector_cosine_ops) with (lists = 10);
-- create index saves_image_embedding_idx on saves using ivfflat (image_embedding vector_cosine_ops) with (lists = 10);
-- Vector search will still work without indexes, just slower on large datasets

-- Add image auto-tagging preference to user_preferences table
alter table user_preferences add column if not exists enable_image_auto_tag boolean default true;

-- Comments for documentation
comment on column saves.is_book is 'True if this save is a book';
comment on column saves.book_isbn is 'ISBN number for books';
comment on column saves.book_publication_date is 'Publication date for books';
comment on column saves.book_page_count is 'Number of pages for books';
comment on column saves.book_publisher is 'Publisher name for books';
comment on column saves.book_edition is 'Edition type for books (hardcover, paperback, kindle, etc.)';
comment on column saves.content_embedding is 'Vector embedding of content for semantic search';
comment on column saves.image_embedding is 'Vector embedding of image aesthetics for visual similarity search';
comment on column saves.image_aesthetic_description is 'AI-generated description of image aesthetics';
comment on column user_preferences.enable_image_auto_tag is 'Enable automatic AI tagging of uploaded images';
