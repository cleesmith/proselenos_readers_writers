// Store Page - Server Component
// Displays books from the public bookstore catalog

import { Metadata } from 'next';
import { getSupabaseCatalog } from '@/app/actions/publish-actions';
import StoreContent from './StoreContent';

export const metadata: Metadata = {
  title: 'Ebooks - Proselenos Ebooks',
  description: 'Browse and download ebooks from authors',
};

export const dynamic = 'force-dynamic';

export default async function StorePage() {
  const result = await getSupabaseCatalog();
  const entries = result.success ? result.books || [] : [];

  return <StoreContent entries={entries} />;
}
