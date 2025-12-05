# Supabase Migration Status

## Current State: Phase 3-4 Complete, Testing Upload

### Branch: `supabase-migration`

### What's Done:
- [x] Supabase project created (ksoqlupmhsaalivklxgf)
- [x] Tables created: `users`, `user_ebooks`
- [x] Storage bucket: `private-ebooks`
- [x] .env.local configured
- [x] @supabase/supabase-js installed
- [x] `src/lib/supabase.ts` - Supabase client
- [x] `src/app/api/auth/[...nextauth]/route.ts` - user upsert on sign-in
- [x] `src/app/actions/supabase-ebook-actions.ts` - upload/download server actions
- [x] `src/hooks/useSupabaseBookUpload.ts` - client hook
- [x] `src/app/library/page.tsx` - wired to use Supabase upload

### BLOCKER: Storage RLS Policies Needed

Run this SQL in Supabase SQL Editor:

```sql
DROP POLICY IF EXISTS "private_ebooks_insert" ON storage.objects;
DROP POLICY IF EXISTS "private_ebooks_select" ON storage.objects;
DROP POLICY IF EXISTS "private_ebooks_update" ON storage.objects;
DROP POLICY IF EXISTS "private_ebooks_delete" ON storage.objects;

CREATE POLICY "private_ebooks_insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'private-ebooks');

CREATE POLICY "private_ebooks_select" ON storage.objects
FOR SELECT USING (bucket_id = 'private-ebooks');

CREATE POLICY "private_ebooks_update" ON storage.objects
FOR UPDATE USING (bucket_id = 'private-ebooks');

CREATE POLICY "private_ebooks_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'private-ebooks');
```

### After Policies Are Added:
1. Test upload: click cloud icon on a book
2. Check Supabase Storage for uploaded files
3. Check `user_ebooks` table for metadata

### Still TODO:
- [ ] Phase 5: Download from "Private Ebooks" UI
- [ ] Remove GitHub repo check on page load (optional cleanup)

### Key Files:
- `apps/proselenos-app/supabase/supabase-setup.sql` - full setup script
- `supabase_journey.txt` - detailed plan
