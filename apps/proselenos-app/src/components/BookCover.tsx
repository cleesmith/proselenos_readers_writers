// apps/proselenos-app/src/components/BookCover.tsx

import clsx from 'clsx';
import { memo, useRef, useState } from 'react';
import { Book } from '@/types/book';
import { LibraryCoverFitType, LibraryViewModeType } from '@/types/settings';
import { formatAuthors, formatTitle } from '@/utils/book';

interface BookCoverProps {
  book: Book;
  mode?: LibraryViewModeType;
  coverFit?: LibraryCoverFitType;
  className?: string;
  imageClassName?: string;
  showSpine?: boolean;
  isPreview?: boolean;
}

const BookCover: React.FC<BookCoverProps> = memo<BookCoverProps>(
  ({
    book,
    mode = 'grid',
    coverFit = 'crop',
    showSpine = false,
    className,
    imageClassName,
    isPreview,
  }) => {
    const coverRef = useRef<HTMLDivElement>(null);
    
    // FIX: Ensure coverUrl is strictly 'string | undefined' (never null).
    // The '|| undefined' converts any falsy value (null, empty string) to undefined.
    const coverUrl = book.metadata?.coverImageUrl || book.coverImageUrl || undefined;

    // Check URL validity.
    const hasValidCoverUrl = coverUrl && coverUrl.trim().length > 0 && coverUrl !== 'undefined' && coverUrl !== 'null';
    
    // Initialize state based on whether we have a valid URL
    const [showFallback, setShowFallback] = useState(!hasValidCoverUrl);

    const shouldShowSpine = showSpine && !showFallback;

    const handleImageLoad = () => {
      setShowFallback(false);
    };

    const handleImageError = () => {
      setShowFallback(true);
    };

    // 1. If we know there is no valid cover, render the fallback directly.
    if (showFallback) {
      return (
        <div className={clsx('book-cover-container relative flex h-full w-full', className)}>
          <div
            className={clsx(
              'fallback-cover absolute inset-0 rounded-none p-2',
              'text-white text-center font-serif font-medium',
              'bg-[#00517b]',
            )}
          >
            <div className='flex h-1/2 items-center justify-center'>
              <span
                className={clsx(
                  isPreview ? 'text-[0.5em]' : mode === 'grid' ? 'text-lg' : 'text-sm',
                )}
              >
                {formatTitle(book.title).split('\n').map((line, i) => (
                  <span key={i} className="block">{line}</span>
                ))}
              </span>
            </div>
            <div className='h-1/6'></div>
            <div className='flex h-1/3 items-center justify-center'>
              <span
                className={clsx(
                  'text-white/70 line-clamp-1',
                  isPreview ? 'text-[0.4em]' : mode === 'grid' ? 'text-base' : 'text-xs',
                )}
              >
                {formatAuthors(book.author)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // 2. If we have a URL, render the image.
    return (
      <div
        ref={coverRef}
        className={clsx('book-cover-container relative flex h-full w-full', className)}
      >
        {coverFit === 'crop' ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={book.title}
              className={clsx(
                'cover-image crop-cover-img object-cover absolute inset-0 w-full h-full',
                imageClassName,
                showFallback && 'hidden',
              )}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            <div
              className={`book-spine absolute inset-0 ${shouldShowSpine ? 'visible' : 'invisible'}`}
            />
          </>
        ) : (
          <div
            className={clsx(
              'flex h-full w-full justify-center',
              mode === 'grid' ? 'items-end' : 'items-center',
            )}
          >
            <div className='relative inline-block'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt={book.title}
                className={clsx(
                  'cover-image fit-cover-img h-auto max-h-full w-auto max-w-full shadow-md',
                  imageClassName,
                  showFallback && 'hidden',
                )}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
              <div
                className={`book-spine absolute inset-0 ${shouldShowSpine ? 'visible' : 'invisible'}`}
              />
            </div>
          </div>
        )}
        
        {/* Render hidden fallback for DOM consistency if image errors out later */}
        <div
          className={clsx(
            'fallback-cover absolute inset-0 rounded-none p-2',
            'text-white text-center font-serif font-medium',
            'bg-[#00517b]',
            !showFallback && 'hidden',
          )}
        >
          <div className='flex h-1/2 items-center justify-center'>
            <span
              className={clsx(
                isPreview ? 'text-[0.5em]' : mode === 'grid' ? 'text-lg' : 'text-sm',
              )}
            >
              {formatTitle(book.title).split('\n').map((line, i) => (
                <span key={i} className="block">{line}</span>
              ))}
            </span>
          </div>
          <div className='h-1/6'></div>
          <div className='flex h-1/3 items-center justify-center'>
            <span
              className={clsx(
                'text-white/70 line-clamp-1',
                isPreview ? 'text-[0.4em]' : mode === 'grid' ? 'text-base' : 'text-xs',
              )}
            >
              {formatAuthors(book.author)}
            </span>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.book.title === nextProps.book.title &&
      prevProps.book.author === nextProps.book.author &&
      prevProps.book.updatedAt === nextProps.book.updatedAt &&
      prevProps.mode === nextProps.mode &&
      prevProps.coverFit === nextProps.coverFit &&
      prevProps.isPreview === nextProps.isPreview &&
      prevProps.showSpine === nextProps.showSpine &&
      prevProps.className === nextProps.className &&
      prevProps.imageClassName === nextProps.imageClassName
    );
  },
);

BookCover.displayName = 'BookCover';

export default BookCover;
