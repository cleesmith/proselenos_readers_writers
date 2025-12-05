-- Proselenos Supabase Setup Script
-- Run this in Supabase SQL Editor to set up the database
--
-- This script is idempotent - safe to run multiple times
-- (uses IF NOT EXISTS where possible)

-- ============================================
-- TABLES
-- ============================================

-- Users table (only for signed-in users)
-- Stores basic profile info from Google OAuth
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id text UNIQUE NOT NULL,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup by Google ID (used on every sign-in)
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);


-- Private ebook backups metadata
-- Tracks what ebooks a user has backed up to Storage
-- The actual files (epub, config.json, cover) are in the storage bucket
CREATE TABLE IF NOT EXISTS user_ebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  book_hash text NOT NULL,
  title text,
  author_name text,
  uploaded_at timestamptz DEFAULT now(),
  UNIQUE(user_id, book_hash)
);

-- Index for listing a user's backed-up ebooks
CREATE INDEX IF NOT EXISTS idx_user_ebooks_user ON user_ebooks(user_id);


-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Private ebooks bucket (not public)
-- Files are stored at: private-ebooks/{google_id}/{book_hash}/
--   - {title}.epub
--   - config.json
--   - cover.png (optional)
--
-- Note: This INSERT will fail if bucket already exists, which is fine
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-ebooks', 'private-ebooks', false)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Supabase Storage uses RLS on storage.objects table by default.
-- We need policies to allow our server actions to upload/download files.
-- Even with service_role key, storage operations need explicit policies.

-- Drop existing policies first (makes script re-runnable)
DROP POLICY IF EXISTS "private_ebooks_insert" ON storage.objects;
DROP POLICY IF EXISTS "private_ebooks_select" ON storage.objects;
DROP POLICY IF EXISTS "private_ebooks_update" ON storage.objects;
DROP POLICY IF EXISTS "private_ebooks_delete" ON storage.objects;

-- Policy: Allow INSERT (upload) to private-ebooks bucket
-- Authenticated users can upload (service_role bypasses this anyway)
CREATE POLICY "private_ebooks_insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'private-ebooks');

-- Policy: Allow SELECT (download/list) from private-ebooks bucket
CREATE POLICY "private_ebooks_select" ON storage.objects
FOR SELECT USING (bucket_id = 'private-ebooks');

-- Policy: Allow UPDATE (overwrite) in private-ebooks bucket
CREATE POLICY "private_ebooks_update" ON storage.objects
FOR UPDATE USING (bucket_id = 'private-ebooks');

-- Policy: Allow DELETE from private-ebooks bucket
CREATE POLICY "private_ebooks_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'private-ebooks');


-- ============================================
-- NOTES
-- ============================================

-- Row Level Security (RLS) on TABLES is NOT enabled.
-- Security is handled at the application level:
--   1. All database access is via Server Actions (server-side only)
--   2. Server Actions use service_role key
--   3. Server Actions verify user session before any operation
--
-- Row Level Security (RLS) on STORAGE is enabled by default in Supabase.
-- The policies above allow operations on the private-ebooks bucket.
-- The service_role key bypasses these policies, but they're needed
-- for the storage operations to work correctly.
