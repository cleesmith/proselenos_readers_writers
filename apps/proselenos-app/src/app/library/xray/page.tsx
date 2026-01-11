'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';
import { Book } from '@/types/book';
import { getLocalBookFilename } from '@/utils/book';
import { XrayViewer } from '@/components/xray';
import Spinner from '@/components/Spinner';

const XrayPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig } = useEnv();
  const { library: libraryBooks, setLibrary } = useLibraryStore();

  const [book, setBook] = useState<Book | null>(null);
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bookHash = searchParams?.get('book') || null;

  useEffect(() => {
    const loadBook = async () => {
      if (!bookHash) {
        setError('No book specified');
        setLoading(false);
        return;
      }

      try {
        const appService = await envConfig.getAppService();

        // Load library if not already loaded
        let books = libraryBooks;
        if (books.length === 0) {
          books = await appService.loadLibraryBooks();
          setLibrary(books);
        }

        // Find the book
        const foundBook = books.find((b) => b.hash === bookHash);
        if (!foundBook) {
          setError('Book not found in library');
          setLoading(false);
          return;
        }

        setBook(foundBook);

        // Load the epub file
        const epubFilename = getLocalBookFilename(foundBook);
        const file = await appService.openFile(epubFilename, 'Books');

        // Convert to File object
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
        const epubFileObj = new File([blob], `${foundBook.title}.epub`, {
          type: 'application/epub+zip',
        });
        setEpubFile(epubFileObj);
      } catch (err) {
        console.error('Failed to load book for X-ray:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [bookHash, envConfig, libraryBooks, setLibrary]);

  // Prefetch other routes for offline support
  useEffect(() => {
    router.prefetch('/library');
    router.prefetch('/reader');
    router.prefetch('/authors');
  }, [router]);

  // Loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-base-100">
        <Spinner loading />
      </div>
    );
  }

  // Error state
  if (error || !book || !epubFile) {
    return (
      <div className="h-screen flex items-center justify-center bg-base-100">
        <div className="text-center">
          <p className="text-error font-semibold mb-2">
            {error || 'Failed to load book'}
          </p>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.push('/library')}
          >
            Return to Library
          </button>
        </div>
      </div>
    );
  }

  return <XrayViewer bookTitle={book.title} epubFile={epubFile} />;
};

const XrayPage = () => {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-base-100">
          <Spinner loading />
        </div>
      }
    >
      <XrayPageContent />
    </Suspense>
  );
};

export default XrayPage;
