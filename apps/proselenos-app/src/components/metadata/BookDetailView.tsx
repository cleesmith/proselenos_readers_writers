import React from 'react';
import {
  MdOutlineCloudDownload,
  MdOutlineCloudUpload,
  MdOutlineDelete,
  MdOutlineEdit,
  MdOutlineFileDownload,
} from 'react-icons/md';
import { GiBoxUnpacking } from 'react-icons/gi';

import { Book } from '@/types/book';
import { BookMetadata } from '@/libs/document';
import { useTranslation } from '@/hooks/useTranslation';
import {
  formatAuthors,
  formatDate,
  formatBytes,
  formatLanguage,
  formatPublisher,
  formatTitle,
} from '@/utils/book';
import BookCover from '@/components/BookCover';

interface BookDetailViewProps {
  book: Book;
  metadata: BookMetadata;
  fileSize: number | null;
  onEdit?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onUpload?: () => void;
  onDownloadLocal?: () => void;
  onXray?: () => void;
}

const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  metadata,
  fileSize,
  onEdit,
  onDelete,
  onDownload,
  onUpload,
  onDownloadLocal,
  onXray,
}) => {
  const _ = useTranslation();

  return (
    <div className='relative w-full rounded-lg'>
      <div className='mb-6 me-4 flex h-32 items-start'>
        <div className='me-10 aspect-[28/41] h-32 shadow-lg'>
          <BookCover mode='list' book={book} />
        </div>
        <div className='title-author flex h-32 flex-col justify-between'>
          <div>
            <p className='text-base-content mb-2 line-clamp-2 text-lg font-bold'>
              {formatTitle(book.title) || _('Untitled')}
            </p>
            <p className='text-neutral-content line-clamp-1'>
              {formatAuthors(book.author, book.primaryLanguage) || _('Unknown')}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-x-4'>
            {onEdit && (
              <button onClick={onEdit} title={_('Edit Ebook Metadata')}>
                <MdOutlineEdit className='fill-base-content hover:fill-blue-500' />
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} title={_('Remove ebook')}>
                <MdOutlineDelete className='fill-red-500 hover:fill-red-600' />
              </button>
            )}
            {book.uploadedAt && onDownload && (
              <button onClick={onDownload} title={_('Download from Private Ebooks')}>
                <MdOutlineCloudDownload className='fill-base-content' />
              </button>
            )}
            {book.downloadedAt && onUpload && (
              <button onClick={onUpload} title={_('Back up to Private Ebooks')}>
                <MdOutlineCloudUpload className='fill-base-content' />
              </button>
            )}
            {onDownloadLocal && (
              <button onClick={onDownloadLocal} title={_('Download ebook')}>
                <MdOutlineFileDownload className='fill-base-content hover:fill-green-500' />
              </button>
            )}
            {onXray && (
              <button onClick={onXray} title={_('X-ray: View epub structure')}>
                <GiBoxUnpacking className='fill-base-content hover:fill-purple-500' />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className='text-base-content my-4'>
        <div className='mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3'>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Publisher')}</span>
            <p className='text-neutral-content text-sm'>
              {formatPublisher(metadata.publisher || '') || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Published')}</span>
            <p className='text-neutral-content text-sm'>
              {formatDate(metadata.published, true) || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Updated')}</span>
            <p className='text-neutral-content text-sm'>{formatDate(book.updatedAt) || ''}</p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Added')}</span>
            <p className='text-neutral-content text-sm'>{formatDate(book.createdAt) || ''}</p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Language')}</span>
            <p className='text-neutral-content text-sm'>
              {formatLanguage(metadata.language) || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Subjects')}</span>
            <p className='text-neutral-content line-clamp-3 text-sm'>
              {formatAuthors(metadata.subject || '') || _('Unknown')}
            </p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('Format')}</span>
            <p className='text-neutral-content text-sm'>{book.format || _('Unknown')}</p>
          </div>
          <div className='overflow-hidden'>
            <span className='font-bold'>{_('File Size')}</span>
            <p className='text-neutral-content text-sm'>{formatBytes(fileSize) || _('Unknown')}</p>
          </div>
        </div>
        <div className='text-neutral-content text-xs font-mono break-all mb-2'>
          {book.hash}
        </div>
        <div>
          <span className='font-bold'>{_('Description')}</span>
          <p
            className='text-neutral-content prose prose-sm max-w-full text-sm'
            dangerouslySetInnerHTML={{
              __html: metadata.description || _('No description available'),
            }}
          ></p>
        </div>
      </div>
    </div>
  );
};

export default BookDetailView;
