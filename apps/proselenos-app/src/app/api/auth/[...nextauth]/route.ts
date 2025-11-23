// proselenosebooks/apps/proselenosebooks-app/api/auth/[...nextauth]/route.ts

import NextAuth from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { updateUserInfo } from '@/lib/github-config-storage';
import { updateUserRepoInfo } from '@proselenosebooks/master-tracker';

const handler = NextAuth({
  ...authOptions,
  events: {
    ...authOptions.events,
    async signIn({ user }) {
      // Update user info on every sign in
      if (user?.id) {
        // Update proselenos-config.json in user's repo
        try {
          await updateUserInfo(user.id, {
            name: user.name,
            email: user.email,
            id: user.id,
          });
        } catch (error) {
          // Log but don't block sign-in if config update fails
          console.error('Failed to update user info in config:', error);
        }

        // Update user_repos.json in master_proselenosebooks
        try {
          await updateUserRepoInfo(user.id, {
            name: user.name,
            email: user.email,
          });
        } catch (error) {
          // Log but don't block sign-in if master tracker update fails
          console.error('Failed to update user info in master tracker:', error);
        }
      }
    },
  },
});

export { handler as GET, handler as POST };
