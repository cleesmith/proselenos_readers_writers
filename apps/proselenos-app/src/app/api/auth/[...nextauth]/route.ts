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

        // Update user's repo: [user.id]_proselenos/proselenos-config.json
        try {
          await updateUserInfo(user.id, {
            name: user.name,
            email: user.email,
            id: user.id,
          });
        } catch (error) {
          // Log but don't block sign-in if config update fails
          console.log("\nNextAuth in: proselenosebooks/apps/proselenosebooks-app/api/auth/[...nextauth]/route.ts");
          console.error("Failed to update user info in userId_proselenos/proselenos-config.json:\n", error);
        }

        // Update master_proselenosebooks/user_repos.json
        try {
          await updateUserRepoInfo(user.id, {
            name: user.name,
            email: user.email,
          });
        } catch (error) {
          // Log but don't block sign-in if master tracker update fails
          console.log("\nNextAuth in: proselenosebooks/apps/proselenosebooks-app/api/auth/[...nextauth]/route.ts");
          console.error("Failed to update user info in master_proselenosebooks/user_repos.json:\n", error);
        }
      }
    },
  },
});

export { handler as GET, handler as POST };
