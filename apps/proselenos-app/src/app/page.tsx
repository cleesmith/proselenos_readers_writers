// app/page.tsx
// Root page - redirects to library (ereader) as the public landing page

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/library');
}
