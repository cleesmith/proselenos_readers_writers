import clsx from 'clsx';
import React from 'react';
import Image from 'next/image';

import { MdCheck } from 'react-icons/md';
import { useReaderStore } from '@/store/readerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useParallelViewStore } from '@/store/parallelViewStore';
import { eventDispatcher } from '@/utils/event';
import { FIXED_LAYOUT_FORMATS } from '@/types/book';
import useBooksManager from '../../hooks/useBooksManager';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';

interface BookMenuProps {
  menuClassName?: string;
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

const BookMenu: React.FC<BookMenuProps> = ({ menuClassName, setIsDropdownOpen }) => {
  const _ = useTranslation();
  const { bookKeys } = useReaderStore();
  const { getVisibleLibrary } = useLibraryStore();
  const { openParallelView } = useBooksManager();
  const { sideBarBookKey } = useSidebarStore();
  const { parallelViews, setParallel, unsetParallel } = useParallelViewStore();

  const handleParallelView = (id: string) => {
    openParallelView(id);
    setIsDropdownOpen?.(false);
  };
  const handleExportAnnotations = () => {
    eventDispatcher.dispatch('export-annotations', { bookKey: sideBarBookKey });
    setIsDropdownOpen?.(false);
  };
  const handleSetParallel = () => {
    setParallel(bookKeys);
    setIsDropdownOpen?.(false);
  };
  const handleUnsetParallel = () => {
    unsetParallel(bookKeys);
    setIsDropdownOpen?.(false);
  };

  return (
    <Menu
      className={clsx('book-menu dropdown-content border-base-100 z-20 shadow-2xl', menuClassName)}
    >
      <MenuItem
        label={_('Parallel Read')}
        buttonClass={bookKeys.length > 1 ? 'lg:tooltip lg:tooltip-bottom' : ''}
        tooltip={parallelViews.length > 0 ? _('Disable') : bookKeys.length > 1 ? _('Enable') : ''}
        Icon={parallelViews.length > 0 && bookKeys.length > 1 ? MdCheck : undefined}
        onClick={
          parallelViews.length > 0
            ? handleUnsetParallel
            : bookKeys.length > 1
              ? handleSetParallel
              : undefined
        }
      >
        <ul className='max-h-60 overflow-y-auto'>
          {getVisibleLibrary()
            .filter((book) => !FIXED_LAYOUT_FORMATS.has(book.format))
            .filter((book) => !!book.downloadedAt)
            .slice(0, 20)
            .map((book) => (
              <MenuItem
                key={book.hash}
                Icon={
                  <Image
                    src={book.coverImageUrl!}
                    alt={book.title}
                    width={56}
                    height={80}
                    className='aspect-auto max-h-8 max-w-4 rounded-sm shadow-md'
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                }
                label={book.title}
                labelClass='max-w-36'
                onClick={() => handleParallelView(book.hash)}
              />
            ))}
        </ul>
      </MenuItem>
      {bookKeys.length > 1 &&
        (parallelViews.length > 0 ? (
          <MenuItem label={_('Exit Parallel Read')} onClick={handleUnsetParallel} />
        ) : (
          <MenuItem label={_('Enter Parallel Read')} onClick={handleSetParallel} />
        ))}
      <hr className='border-base-200 my-1' />
      <MenuItem label={_('Export Annotations')} onClick={handleExportAnnotations} />
    </Menu>
  );
};

export default BookMenu;
