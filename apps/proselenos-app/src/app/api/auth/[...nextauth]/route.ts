// apps/proselenos-app/api/auth/[...nextauth]/route.ts
// NextAuth handler - creates/updates user in Supabase on sign-in

import NextAuth from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { upsertSupabaseUser } from '@/lib/supabase';

const handler = NextAuth({
  ...authOptions,
  events: {
    ...authOptions.events,
    async signIn({ user }) {
      // Update user info on every sign in
      if (user?.id) {
        // Upsert user to Supabase
        try {
          await upsertSupabaseUser({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          });
        } catch (error) {
          // Log but don't block sign-in if Supabase update fails
          console.error("Failed to upsert user to Supabase:", error);
        }
      }
    },
  },
});

export { handler as GET, handler as POST };
