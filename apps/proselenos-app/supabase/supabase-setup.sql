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
-- BOOKSTORE: TABLE
-- ============================================

-- Public bookstore catalog (replaces old catalog.json)
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text UNIQUE NOT NULL,   -- stable identifier (one EPUB per project)
  book_hash text NOT NULL,           -- changes on regeneration
  title text NOT NULL,
  author_name text,
  author_id uuid REFERENCES users(id),
  description text,
  epub_path text,
  cover_color text,
  has_cover boolean DEFAULT false,
  published_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_project ON books(project_id);
CREATE INDEX IF NOT EXISTS idx_books_hash ON books(book_hash);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id);
CREATE INDEX IF NOT EXISTS idx_books_published ON books(published_at DESC);


-- ============================================
-- BOOKSTORE: STORAGE BUCKETS (PUBLIC)
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('bookstore-epubs', 'bookstore-epubs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('bookstore-covers', 'bookstore-covers', true)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- BOOKSTORE: STORAGE POLICIES
-- ============================================

-- EPUBs bucket policies (public read)
DROP POLICY IF EXISTS "bookstore_epubs_public_read" ON storage.objects;
DROP POLICY IF EXISTS "bookstore_epubs_insert" ON storage.objects;
DROP POLICY IF EXISTS "bookstore_epubs_update" ON storage.objects;
DROP POLICY IF EXISTS "bookstore_epubs_delete" ON storage.objects;

CREATE POLICY "bookstore_epubs_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'bookstore-epubs');

CREATE POLICY "bookstore_epubs_insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'bookstore-epubs');

CREATE POLICY "bookstore_epubs_update" ON storage.objects
FOR UPDATE USING (bucket_id = 'bookstore-epubs');

CREATE POLICY "bookstore_epubs_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'bookstore-epubs');

-- Covers bucket policies (public read)
DROP POLICY IF EXISTS "bookstore_covers_public_read" ON storage.objects;
DROP POLICY IF EXISTS "bookstore_covers_insert" ON storage.objects;
DROP POLICY IF EXISTS "bookstore_covers_update" ON storage.objects;
DROP POLICY IF EXISTS "bookstore_covers_delete" ON storage.objects;

CREATE POLICY "bookstore_covers_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'bookstore-covers');

CREATE POLICY "bookstore_covers_insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'bookstore-covers');

CREATE POLICY "bookstore_covers_update" ON storage.objects
FOR UPDATE USING (bucket_id = 'bookstore-covers');

CREATE POLICY "bookstore_covers_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'bookstore-covers');


-- ============================================
-- AUTHORS MODE: TABLES
-- ============================================

-- Author config (replaces proselenos-config.json AND proselenos-settings.json)
CREATE TABLE IF NOT EXISTS author_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_project text,
  current_project_id text,
  ai_provider text DEFAULT 'openrouter',
  ai_model text,
  author_name text,
  dark_mode boolean DEFAULT false,
  api_keys jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- Book metadata (replaces book-metadata.json per project)
CREATE TABLE IF NOT EXISTS book_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  title text,
  author text,
  publisher text,
  about_author text,
  buy_url text,
  updated_at timestamptz DEFAULT now()
);

-- Default tool prompts (seeded once, read-only template)
-- Populate with tool_prompts.sql after running this script
CREATE TABLE IF NOT EXISTS default_tool_prompts (
  category text NOT NULL,
  tool_name text NOT NULL,
  content text,
  PRIMARY KEY (category, tool_name)
);

-- User's tool prompts (copied from defaults on first sign-in)
CREATE TABLE IF NOT EXISTS tool_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL,
  tool_name text NOT NULL,
  content text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_tool_prompts_user ON tool_prompts(user_id);


-- ============================================
-- AUTHORS MODE: STORAGE BUCKET
-- ============================================

-- Author files bucket (private)
-- Files stored at: author-files/{google_id}/{project_name}/
--   - manuscript.txt
--   - manuscript.epub
--   - manuscript.pdf
--   - manuscript.html
--   - {uploaded_files}.*
INSERT INTO storage.buckets (id, name, public)
VALUES ('author-files', 'author-files', false)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- AUTHORS MODE: STORAGE POLICIES
-- ============================================

DROP POLICY IF EXISTS "author_files_select" ON storage.objects;
DROP POLICY IF EXISTS "author_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "author_files_update" ON storage.objects;
DROP POLICY IF EXISTS "author_files_delete" ON storage.objects;

CREATE POLICY "author_files_select" ON storage.objects
FOR SELECT USING (bucket_id = 'author-files');

CREATE POLICY "author_files_insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'author-files');

CREATE POLICY "author_files_update" ON storage.objects
FOR UPDATE USING (bucket_id = 'author-files');

CREATE POLICY "author_files_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'author-files');


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
-- The policies above allow operations on all buckets.
--
-- Buckets:
--   private-ebooks: Private reader backups (authenticated access)
--   bookstore-epubs: Public published EPUBs
--   bookstore-covers: Public cover thumbnails
--   author-files: Private author manuscripts and generated files
--
-- After running this script, run tool_prompts.sql to seed default_tool_prompts table
