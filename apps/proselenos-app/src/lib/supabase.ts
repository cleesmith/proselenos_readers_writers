/**
 * Supabase Server Client
 *
 * This client uses the service_role key for server-side operations only.
 * All Supabase calls should go through Server Actions - never expose to client.
 *
 * Security: The service_role key bypasses RLS, so security is enforced
 * at the application level (Server Actions verify user session).
 */

import { createClient } from '@supabase/supabase-js';

// These env vars must be set in .env.local (and later in Vercel)
const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

// Only create client if credentials are available
// This allows the app to run without Supabase during transition
function getSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export const supabase = getSupabaseClient();

/**
 * Check if Supabase is configured and available
 */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

/**
 * Upsert user on sign-in
 *
 * Called from NextAuth signIn event to create/update user in Supabase.
 * Uses google_id as the unique identifier.
 *
 * @param user - User object from NextAuth (Google OAuth)
 * @returns Promise that resolves on success, throws on error
 */
export async function upsertSupabaseUser(user: {
  id: string; // Google OAuth sub (unique identifier) → maps to google_id
  email?: string | null;
  name?: string | null;
  image?: string | null;
}): Promise<void> {
  if (!supabase) {
    console.log('Supabase not configured, skipping user upsert');
    return;
  }

  const { error } = await supabase.from('users').upsert(
    {
      google_id: user.id,
      email: user.email,
      display_name: user.name,
      avatar_url: user.image,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'google_id' }
  );

  if (error) {
    throw new Error(`Failed to upsert database user: ${error.message}`);
  }
}

/**
 * Get user by Google ID
 *
 * @param googleId - Google OAuth sub identifier
 * @returns User record or null if not found
 */
export async function getSupabaseUserByGoogleId(googleId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('google_id', googleId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - user doesn't exist
      return null;
    }
    throw new Error(`Failed to get database user: ${error.message}`);
  }

  return data;
}
