import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

async function refreshAccessToken(token: any) {
  try {
    const url = 'https://oauth2.googleapis.com/token?' + new URLSearchParams({
      client_id: process.env['GOOGLE_CLIENT_ID']!,
      client_secret: process.env['GOOGLE_CLIENT_SECRET']!,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken as string,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const refreshedTokens = await response.json();
    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + (refreshedTokens.expires_in * 1000),
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('refreshAccessToken error', error);
    return { ...token, error: 'RefreshAccessTokenError' as const };
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 90 * 24 * 60 * 60 },
  providers: [
    GoogleProvider({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        token['accessToken'] = (account as any).access_token;
        token['refreshToken'] = (account as any).refresh_token;
        const expiresIn = (account as any).expires_in
          ? Number((account as any).expires_in) * 1000
          : 60 * 60 * 1000;
        token['accessTokenExpires'] = Date.now() + expiresIn;
        token['userId'] = (user as any).id;
        return token;
      }
      if (Date.now() < (token['accessTokenExpires'] as number)) return token;
      return await refreshAccessToken(token);
    },
    async session({ session, token }) {
      (session as any).accessToken = token['accessToken'];
      (session as any).refreshToken = token['refreshToken'];
      (session as any).error = token['error'];
      if (token['userId']) (session.user as any).id = token['userId'];
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
