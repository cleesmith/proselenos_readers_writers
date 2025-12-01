// app/authors/page.tsx
// Authors mode page - only accessible when logged in

export const revalidate = 0;
export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { fastInitForUser } from '@/lib/github/fastInitServer';
import { cleanupOldBlobsAction } from '@/lib/blob-cleanup-action';
import ClientBoot from '@/components/ClientBoot';
import { redirect } from 'next/navigation';

export default async function AuthorsPage() {
  const session = await getServerSession(authOptions);

  // Redirect to library if not logged in
  if (!session?.accessToken) {
    redirect('/library');
  }

  // Opportunistic cleanup of old Vercel Blob files (fire-and-forget, don't block page load)
  cleanupOldBlobsAction().catch(() => {});

  if (session?.user?.email) {
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    console.log(`>>> [${timestamp} ET] user email=`, session.user.email);
  }

  // Prepare init data for authors mode
  const authorsInit = await fastInitForUser();

  return <ClientBoot init={authorsInit} />;
}
