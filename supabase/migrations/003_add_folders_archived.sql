-- Add is_archived column to folders table
alter table folders add column if not exists is_archived boolean default false;
