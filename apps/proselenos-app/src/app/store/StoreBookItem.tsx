'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { FaBookOpen } from 'react-icons/fa';
import { BookstoreEntry, importBookFromSupabase } from '@/app/actions/supabase-publish-actions';
import { useEnv } from '@/context/EnvContext';

interface StoreBookItemProps {
  entry: BookstoreEntry;
}

export default function StoreBookItem({ entry }: StoreBookItemProps) {
  const { appService } = useEnv();
  const [isImporting, setIsImporting] = useState(false);
  const [coverImageError, setCoverImageError] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Format published date
  const publishedDate = new Date(entry.publishedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Cover background color: use stored color or fallback to blue
  const coverBgColor = entry.coverColor || '#00517b';

  // Cover image URL (only if hasCover is true and no error loading)
  const showCoverImage = entry.hasCover && !coverImageError;
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] || '';
  const coverImageUrl = `${supabaseUrl}/storage/v1/object/public/bookstore-covers/${entry.bookHash}.jpg`;

  const handleImport = async () => {
    if (isImporting) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const result = await importBookFromSupabase(entry.bookHash);

      if (result.success && result.epubBase64 && result.filename) {
        const { epubBase64, filename } = result;
        // Decode base64 to binary
        const binaryString = atob(epubBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const file = new File([bytes], filename, { type: 'application/epub+zip' });

        if (appService) {
          const library = await appService.loadLibraryBooks();
          await appService.importBook(file, library);
          await appService.saveLibraryBooks(library);
        }

        window.location.href = '/library';
      } else {
        console.error('Failed to import book:', result.error);
        setImportError(result.error || 'Failed to import. The book may have been removed by the author.');
      }
    } catch (error) {
      console.error('Error importing book:', error);
      setImportError('Failed to import. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className='group relative flex h-full flex-col px-0 py-4 sm:px-4'>
      <div
        className={clsx(
          'relative flex aspect-[28/41] justify-center',
          'overflow-visible shadow-md items-end cursor-pointer'
        )}
      >
        {/* Cover display: actual image or colored fallback */}
        {showCoverImage ? (
          /* Actual cover image from Supabase Storage */
          <img
            src={coverImageUrl}
            alt={`Cover of ${entry.title}`}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setCoverImageError(true)}
          />
        ) : (
          /* Fallback: colored background with title/author */
          <>
            <div
              className="absolute inset-0 flex flex-col items-center justify-between p-3 text-center"
              style={{ backgroundColor: coverBgColor }}
            >
              <span className="text-white font-serif text-sm font-semibold leading-tight line-clamp-3">
                {entry.title}
              </span>
              <span className="text-white/80 text-xs line-clamp-2">
                {entry.author}
              </span>
            </div>

            {/* Centered book icon (only on fallback) */}
            <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
              <div className='bg-black/30 rounded-full p-3'>
                <FaBookOpen className='text-white/80 text-2xl' />
              </div>
            </div>
          </>
        )}

        {/* Hover overlay - expands beyond cover */}
        <div
          className={clsx(
            'absolute -inset-2 bg-black/90 rounded-lg flex flex-col justify-between p-4 z-20',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
            'min-w-[140px]'
          )}
          onClick={handleImport}
        >
          {/* Title by Author */}
          <div className='flex-1 flex items-center'>
            <p className='text-white text-sm font-medium leading-tight'>
              &ldquo;{entry.title}&rdquo;
              <span className='text-white/70 font-normal'> by {entry.author}</span>
            </p>
          </div>

          {/* Published date */}
          <div className='text-white/60 text-[10px] mt-2'>
            Published: {publishedDate}
          </div>

          {/* Import button */}
          <button
            className={clsx(
              'mt-2 w-full py-1.5 rounded text-xs font-medium',
              'bg-green-600 hover:bg-green-500 text-white',
              'transition-colors duration-150'
            )}
            disabled={isImporting}
          >
            {isImporting ? 'Importing...' : 'Import to Library'}
          </button>

          {/* Error message */}
          {importError && (
            <div className='mt-2 text-red-400 text-xs text-center'>
              {importError}
            </div>
          )}
        </div>

        {/* Loading spinner overlay */}
        {isImporting && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/50 z-10'>
            <span className='loading loading-spinner loading-md text-white'></span>
          </div>
        )}
      </div>
    </div>
  );
}
