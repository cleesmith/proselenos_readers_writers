// Store Page - Server Component
// Displays books from the public bookstore catalog

import { Metadata } from 'next';
import { getPublicCatalog } from '@/app/actions/store-catalog';
import { getGitHubOwner } from '@/lib/github-storage';
import StoreContent from './StoreContent';

export const metadata: Metadata = {
  title: 'Free Ebooks - Proselenos Bookstore',
  description: 'Browse and download free ebooks from indie authors',
};

export const dynamic = 'force-dynamic';

export default async function StorePage() {
  const result = await getPublicCatalog();
  const entries = result.success ? result.data || [] : [];
  const githubOwner = getGitHubOwner();

  return <StoreContent entries={entries} githubOwner={githubOwner} />;
}
