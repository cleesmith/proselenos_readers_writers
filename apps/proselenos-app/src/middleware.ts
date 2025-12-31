import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const start = Date.now();
  const response = NextResponse.next();

  // ONLY log on localhost - skip in production/deployed environments
  const host = request.headers.get('host') || '';
  const isLocalhost = host.startsWith('localhost:') || host.startsWith('127.0.0.1:');

  if (isLocalhost) {
    const duration = Date.now() - start;
    const method = request.method.padEnd(6);
    const path = request.nextUrl.pathname;

    // Skip noisy static asset requests
    if (!path.startsWith('/_next/') && !path.endsWith('.ico')) {
      console.log(`${method} ${path} ${duration}ms`);
    }
  }

  return response;
}

// Run middleware on all routes
export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
