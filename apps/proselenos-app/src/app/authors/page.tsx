// app/authors/page.tsx
// Authors mode page - local-first, no auth required

'use client';

import AuthorsClient from './AuthorsClient';

export default function AuthorsPage() {
  return <AuthorsClient />;
}
