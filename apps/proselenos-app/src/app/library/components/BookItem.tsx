import clsx from 'clsx';
import { MdCheckCircle, MdCheckCircleOutline, MdOutlineAutoStories, MdOutlineStorefront } from 'react-icons/md';


import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { LibraryCoverFitType, LibraryViewModeType } from '@/types/settings';
import { formatAuthors } from '@/utils/book';
import ReadingProgress from './ReadingProgress';
import BookCover from '@/components/BookCover';

interface BookItemProps {
  book: Book;
  mode: LibraryViewModeType;
  coverFit: LibraryCoverFitType;
  isSelectMode: boolean;
  bookSelected: boolean;
  transferProgress: number | null;
  showBookDetailsModal: (book: Book) => void;
  onReadBook?: (book: Book) => void;
  onReadBookseller?: (book: Book) => void;
}

const BookItem: React.FC<BookItemProps> = ({
  book,
  mode,
  coverFit,
  isSelectMode,
  bookSelected,
  transferProgress,
  showBookDetailsModal,
  onReadBook,
  onReadBookseller,
}) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const iconSize15 = useResponsiveSize(15);

  return (
    <div
      role='none'
      className={clsx(
        'book-item flex',
        mode === 'grid' && 'h-full flex-col justify-end',
        mode === 'list' && 'h-28 flex-row gap-4 overflow-hidden',
        appService?.hasContextMenu ? 'cursor-pointer' : '',
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={clsx(
          'relative flex aspect-[28/41] justify-center',
          coverFit === 'crop' && 'overflow-hidden shadow-md',
          mode === 'grid' && 'items-end',
          mode === 'list' && 'min-w-20 items-center',
        )}
      >
        <BookCover mode={mode} book={book} coverFit={coverFit} showSpine={false} />
        {bookSelected && (
          <div className='absolute inset-0 bg-black opacity-30 transition-opacity duration-300'></div>
        )}
        {isSelectMode && (
          <div className='absolute bottom-1 right-1'>
            {bookSelected ? (
              <MdCheckCircle className='fill-blue-500' />
            ) : (
              <MdCheckCircleOutline className='fill-gray-300 drop-shadow-sm' />
            )}
          </div>
        )}
      </div>
      <div
        className={clsx(
          'flex w-full flex-col p-0',
          mode === 'grid' && 'pt-2',
          mode === 'list' && 'py-2',
        )}
      >
        <div className={clsx('min-w-0 flex-1', mode === 'list' && 'flex flex-col gap-2')}>
          <h4
            className={clsx(
              'overflow-hidden text-ellipsis font-semibold',
              mode === 'grid' && 'block whitespace-nowrap text-[0.6em] text-xs',
              mode === 'list' && 'line-clamp-2 text-base',
            )}
          >
            {book.title}
          </h4>
          {mode === 'list' && (
            <p className='text-neutral-content line-clamp-1 text-sm'>
              {formatAuthors(book.author, book.primaryLanguage) || ''}
            </p>
          )}
        </div>
        <div>
          <div className='flex items-center justify-center gap-x-3'>
            {book.progress && <ReadingProgress book={book} />}
            {onReadBook && (
              <button
                aria-label={_('Read Ebook')}
                title={_('Read Ebook')}
                className='-m-2 p-2'
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onReadBook(book);
                }}
              >
                <div className='pt-[2px] sm:pt-[1px]'>
                  <MdOutlineAutoStories size={iconSize15} className='fill-blue-500' />
                </div>
              </button>
            )}
            {onReadBookseller && (
              <button
                aria-label={_('Read Bookseller Ebook')}
                title={_('Read Bookseller Ebook')}
                className='-m-2 p-2'
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onReadBookseller(book);
                }}
              >
                <div className='pt-[2px] sm:pt-[1px]'>
                  <MdOutlineStorefront size={iconSize15} className='fill-orange-500' />
                </div>
              </button>
            )}
            <button
              aria-label={_('Show Ebook Plus')}
              title={_('Ebook Plus')}
              className='show-detail-button -m-2 p-2'
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                showBookDetailsModal(book);
              }}
            >
              <span className='rounded-full bg-base-300 px-[5px] py-[1px] text-[9px] font-semibold leading-tight text-base-content/70 hover:text-base-content'>
                {_('Plus')}
              </span>
            </button>
            {transferProgress !== null && transferProgress !== 100 && (
              <div
                className='radial-progress'
                style={
                  {
                    '--value': transferProgress,
                    '--size': `${iconSize15}px`,
                    '--thickness': '2px',
                  } as React.CSSProperties
                }
                role='progressbar'
              ></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookItem;
