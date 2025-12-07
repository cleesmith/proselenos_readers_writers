import React, { useEffect } from 'react';
import { useSupabaseBookRepo } from '@/hooks/useSupabaseBookRepo';
import { useTranslation } from '@/hooks/useTranslation';
import Dialog from '@/components/Dialog';
import Spinner from '@/components/Spinner';

interface BookRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BookRepoModal: React.FC<BookRepoModalProps> = ({ isOpen, onClose }) => {
  const _ = useTranslation();
  const {
    availableBooks,
    loading,
    downloading,
    error,
    fetchAvailableBooks,
    downloadBook,
  } = useSupabaseBookRepo();

  useEffect(() => {
    if (isOpen) {
      fetchAvailableBooks();
    }
  }, [isOpen, fetchAvailableBooks]);

  const handleDownloadBook = async (book: (typeof availableBooks)[number]) => {
    const result = await downloadBook(book);
    if (result.success) {
      // Reload page to ensure cover images load correctly
      window.location.reload();
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} className='w-[90vw] max-w-6xl h-[80vh]'>
      <div className='border-b border-base-200 p-4'>
        <h2 className='text-xl font-semibold'>
          {_('Your Library')}
          <span className='text-sm font-normal italic text-base-content/50 ml-2'>(private ebooks)</span>
        </h2>
      </div>

      <div className='p-4 overflow-y-auto' style={{ maxHeight: 'calc(80vh - 70px)' }}>
        {loading && (
          <div className='flex items-center justify-center py-8'>
            <Spinner loading={true} />
            <span className='ml-2'>{_('Loading ebooks from Your Library...')}</span>
          </div>
        )}

        {error && (
          <div className='alert alert-error mb-4'>
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && availableBooks.length === 0 && (
          <div className='text-center py-8 text-base-content/60'>
            {_('No ebooks found in Your Library')}
          </div>
        )}

        {!loading && availableBooks.length > 0 && (
          <div className='space-y-4'>
            <div className='grid gap-2'>
              {availableBooks.map((book) => (
                <button
                  key={book.hash}
                  onClick={() => handleDownloadBook(book)}
                  disabled={downloading === book.hash}
                  className='flex items-center justify-between gap-4 py-2 px-3 rounded-lg border border-base-200 hover:bg-base-200/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <div className='flex-1 min-w-0'>
                    <h3 className='font-semibold text-base line-clamp-1'>
                      {book.title}
                    </h3>
                    {book.author && (
                      <p className='text-sm text-base-content/60 line-clamp-1'>
                        {book.author}
                      </p>
                    )}
                  </div>
                  {downloading === book.hash && (
                    <div className='flex-shrink-0'>
                      <Spinner loading={true} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default BookRepoModal;
