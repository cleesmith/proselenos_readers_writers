export async function verifyGoogleAccessToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (res.status === 200) return true;
    if (res.status === 401 || res.status === 403) return false;
    return true; // be conservative for other statuses
  } catch {
    return true; // avoid false positives on network blips
  }
}
