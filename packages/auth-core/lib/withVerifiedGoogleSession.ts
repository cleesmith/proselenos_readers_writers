import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { verifyGoogleAccessToken } from './googleVerify';
import { redirect } from 'next/navigation';

export async function withVerifiedGoogleSession(opts?: { redirectIfMissing?: boolean }) {
  const redirectIfMissing = opts?.redirectIfMissing ?? true;
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    if (redirectIfMissing) redirect('/');
    return null;
  }
  const ok = await verifyGoogleAccessToken(session.accessToken);
  if (!ok) redirect('/api/auth/signout?callbackUrl=/');
  return session;
}
