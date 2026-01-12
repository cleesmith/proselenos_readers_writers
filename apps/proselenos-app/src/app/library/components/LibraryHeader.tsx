import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSearch } from 'react-icons/fa';
import { PiBooks, PiArrowClockwise, PiPencil, PiDotsThreeCircle } from 'react-icons/pi';
import { MdOutlineMenu, MdArrowBackIosNew } from 'react-icons/md';
import { IoMdCloseCircle } from 'react-icons/io';

import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { showAlert } from '@/app/shared/alerts';
import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { navigateToLibrary } from '@/utils/nav';
import { debounce } from '@/utils/debounce';
import useShortcuts from '@/hooks/useShortcuts';
import Dropdown from '@/components/Dropdown';
import SettingsMenu from './SettingsMenu';
import ViewMenu from './ViewMenu';

interface LibraryHeaderProps {
  isSelectMode: boolean;
  isSelectAll: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onImportBooks: () => void;
  onToggleSelectMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const LibraryHeader: React.FC<LibraryHeaderProps> = ({
  isSelectMode,
  isSelectAll,
  searchQuery,
  onSearchChange,
  onImportBooks,
  onToggleSelectMode,
  onSelectAll,
  onDeselectAll,
}) => {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { appService } = useEnv();
  const { systemUIVisible, statusBarHeight, themeMode } = useThemeStore();
  const { currentBookshelf } = useLibraryStore();
  const {
    isTrafficLightVisible,
    initializeTrafficLightStore,
    initializeTrafficLightListeners,
    setTrafficLightVisibility,
    cleanupTrafficLightListeners,
  } = useTrafficLightStore();
  // Local state for input value, synced with parent via onSearchChange
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  const headerRef = useRef<HTMLDivElement>(null);
  const iconSize18 = useResponsiveSize(18);
  const iconSize20 = useResponsiveSize(20);
  const { safeAreaInsets: insets } = useThemeStore();

  useShortcuts({
    onToggleSelectMode,
  });

  // Sync local state when parent searchQuery changes
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedOnSearchChange = useCallback(
    debounce((value: string) => {
      onSearchChange(value);
    }, 500),
    [onSearchChange],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setLocalSearchQuery(newQuery);
    debouncedOnSearchChange(newQuery);
  };

  const switchToAuthorsMode = () => {
    // If Authors tab that opened this Library is still open, just show message
    if (window.opener && !window.opener.closed) {
      const isDark = themeMode === 'dark' || (themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      showAlert('Authors is already open in another tab', 'info', undefined, isDark);
      return;
    }
    // Otherwise navigate to Authors in this tab
    router.push('/authors');
  };

  useEffect(() => {
    if (!appService?.hasTrafficLight) return;

    initializeTrafficLightStore(appService);
    initializeTrafficLightListeners();
    setTrafficLightVisibility(true);
    return () => {
      cleanupTrafficLightListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService?.hasTrafficLight]);

  const windowButtonVisible = appService?.hasWindowBar && !isTrafficLightVisible;
  const isInGroupView = !!searchParams?.get('group');
  const currentBooksCount = currentBookshelf.reduce(
    (acc, item) => acc + ('books' in item ? item.books.length : 1),
    0,
  );

  if (!insets) return null;

  return (
    <div
      ref={headerRef}
      className={clsx(
        'titlebar z-10 flex h-[52px] w-full items-center py-2 pr-4 sm:h-[48px]',
        windowButtonVisible ? 'sm:pr-4' : 'sm:pr-6',
        isTrafficLightVisible ? 'pl-16' : 'pl-0 sm:pl-2',
      )}
      style={{
        marginTop: appService?.hasSafeAreaInset
          ? `max(${insets.top}px, ${systemUIVisible ? statusBarHeight : 0}px)`
          : '0px',
      }}
    >
      <div className='flex w-full items-center justify-between space-x-6 sm:space-x-12'>
        <div className='exclude-title-bar-mousedown relative flex w-full items-center pl-4'>
          {isInGroupView && (
            <button
              onClick={() => {
                navigateToLibrary(router);
              }}
              className='ml-[-6px] mr-4 flex h-7 min-h-7 w-7 items-center p-0'
            >
              <div className='lg:tooltip lg:tooltip-bottom' data-tip={_('Go Back')}>
                <MdArrowBackIosNew size={iconSize20} />
              </div>
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            aria-label={_('Reload Page')}
            title={_('Reload Page')}
            className='mr-4 flex h-6 w-6 items-center justify-center text-gray-500 hover:text-gray-400'
          >
            <PiArrowClockwise className='h-5 w-5' />
          </button>
          <button
            onClick={onImportBooks}
            aria-label={_('Add Ebook')}
            title={_('Add Ebook')}
            className='mr-4 flex items-center gap-0 text-gray-500 hover:text-gray-400'
          >
            <PiBooks className='h-5 w-5' />
            <span className='text-lg'>+</span>
            <span className='text-sm'>Ebook</span>
          </button>
          <button
            onClick={switchToAuthorsMode}
            aria-label={_('Authors')}
            title={_('Write Ebook')}
            className='mr-4 flex items-center gap-0 text-gray-500 hover:text-gray-400'
          >
            <PiPencil className='h-5 w-5' />
            <span className='text-sm'>Authors</span>
          </button>
          <div className='relative flex h-9 max-w-sm flex-1 items-center sm:h-7'>
            <span className='absolute left-3 text-gray-500'>
              <FaSearch className='h-4 w-4' />
            </span>
            <input
              type='text'
              value={localSearchQuery}
              placeholder={
                currentBooksCount > 1
                  ? _('Search ebook metadata...', {
                      count: currentBooksCount,
                    })
                  : _('Search ebook metadata...')
              }
              onChange={handleSearchChange}
              spellCheck='false'
              className={clsx(
                'input rounded-badge bg-base-300/45 h-9 w-full pl-10 pr-8 sm:h-7',
                'font-sans text-sm font-light',
                'placeholder:text-base-content/50',
                'border-none focus:outline-none focus:ring-0',
              )}
            />
          </div>
          {localSearchQuery && (
            <button
              type='button'
              onClick={() => {
                setLocalSearchQuery('');
                onSearchChange('');
              }}
              className='ml-2 text-gray-400 hover:text-gray-600'
              aria-label={_('Clear Search')}
            >
              <IoMdCloseCircle className='h-4 w-4' />
            </button>
          )}
        </div>
        {isSelectMode ? (
          <div
            className={clsx(
              'flex h-full items-center',
              'w-max-[72px] w-min-[72px] sm:w-max-[80px] sm:w-min-[80px]',
            )}
          >
            <button
              onClick={isSelectAll ? onDeselectAll : onSelectAll}
              className='btn btn-ghost text-base-content/85 h-8 min-h-8 w-[72px] p-0 sm:w-[80px]'
              aria-label={isSelectAll ? _('Deselect') : _('Select All')}
            >
              <span className='font-sans text-base font-normal sm:text-sm'>
                {isSelectAll ? _('Deselect') : _('Select All')}
              </span>
            </button>
          </div>
        ) : (
          <div className='flex h-full items-center gap-x-2 sm:gap-x-4'>
            <Dropdown
              label={_('View Menu')}
              className='exclude-title-bar-mousedown dropdown-bottom dropdown-end'
              buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
              toggleButton={<PiDotsThreeCircle role='none' size={iconSize18} />}
            >
              <ViewMenu />
            </Dropdown>
            <Dropdown
              label={_('Menu')}
              className='exclude-title-bar-mousedown dropdown-bottom dropdown-end'
              buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
              toggleButton={<MdOutlineMenu role='none' size={iconSize18} />}
            >
              <SettingsMenu />
            </Dropdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryHeader;
