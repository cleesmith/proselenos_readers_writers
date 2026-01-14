// apps/proselenos-app/src/app/library/page.tsx

'use client';

import clsx from 'clsx';
import { parseOpenWithFiles, getCurrentWebview } from '@/utils/desktop-stubs';
import * as React from 'react';
import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { ReadonlyURLSearchParams, useRouter, useSearchParams } from 'next/navigation';
import { OverlayScrollbarsComponent, OverlayScrollbarsComponentRef } from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';

import { Book } from '@/types/book';
import { AppService, DeleteAction } from '@/types/system';
import { navigateToReader } from '@/utils/nav';
import { formatAuthors, formatTitle, getPrimaryLanguage, listFormater } from '@/utils/book';
import { eventDispatcher } from '@/utils/event';
import { getFilename } from '@/utils/path';
import { isWebAppPlatform } from '@/services/environment';

import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { useUICSS } from '@/hooks/useUICSS';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { SelectedFile, useFileSelector } from '@/hooks/useFileSelector';

import { BookMetadata } from '@/libs/document';
import { AboutWindow } from '@/components/AboutWindow';
import { StorageWindow } from '@/components/StorageWindow';
import { BookDetailModal } from '@/components/metadata';
import { useDragDropImport } from './hooks/useDragDropImport';
import { Toast } from '@/components/Toast';
import WelcomeModal from '@/components/WelcomeModal';
import { getTheme } from '@/app/shared/theme';
import Spinner from '@/components/Spinner';
import LibraryHeader from './components/LibraryHeader';
import Bookshelf from './components/Bookshelf';
import ReaderModal from './components/ReaderModal';
import useShortcuts from '@/hooks/useShortcuts';
import DropIndicator from '@/components/DropIndicator';
import SettingsDialog from '@/components/settings/SettingsDialog';
import Dialog from '@/components/Dialog';

const LibraryPageWithSearchParams = () => {
  const searchParams = useSearchParams();
  return <LibraryPageContent searchParams={searchParams} />;
};

const LibraryPageContent = ({ searchParams }: { searchParams: ReadonlyURLSearchParams | null }) => {
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const {
    library: libraryBooks,
    isSyncing,
    syncProgress,
    updateBook,
    setLibrary,
    getGroupName,
    refreshGroups,
  } = useLibraryStore();
  const _ = useTranslation();
  const { selectFiles } = useFileSelector(appService, _);
  const { safeAreaInsets: insets, isRoundedWindow, themeMode } = useThemeStore();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const { isSettingsDialogOpen, setSettingsDialogOpen } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [isSelectNone, setIsSelectNone] = useState(false);
  const [showDetailsBook, setShowDetailsBook] = useState<Book | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingNavigationBookIds, setPendingNavigationBookIds] = useState<string[] | null>(null);
  const [readerBookHash, setReaderBookHash] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isInitiating = useRef(false);

  const viewSettings = settings.globalViewSettings;

  // Theme for WelcomeModal
  const isDarkMode = themeMode === 'dark' || (themeMode === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = getTheme(isDarkMode);
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const containerRef: React.MutableRefObject<HTMLDivElement | null> = useRef(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useTheme({ systemUIVisible: true, appThemeColor: 'base-200' });
  useUICSS();


  const { isDragging } = useDragDropImport();
  useScreenWakeLock(settings.screenWakeLock);

  useShortcuts({
    onToggleFullscreen: async () => {
      // No Desktop - web-only app
    },
    onCloseWindow: async () => {
      // No Desktop - web-only app
    },
    onQuitApp: async () => {
      // No Desktop - web-only app
    },
    onOpenFontLayoutSettings: () => {
      setSettingsDialogOpen(true);
    },
    onOpenBooks: () => {
      handleImportBooks();
    },
  });

  // Clear the window name on mount. 
  // If this tab was previously the "Authors" tab (navigated here via Exit),
  // we must clear the name 'proselenos_authors_mode'.
  // This ensures that clicking "Authors" again spawns a NEW tab instead of reusing this one.
  useEffect(() => {
    if (window.name === 'proselenos_authors_mode') {
      // console.log('Clearing sticky window name to restore separate tab behavior');
      window.name = '';
    }
  }, []);

  const handleRefreshLibrary = useCallback(async () => {
    const appService = await envConfig.getAppService();
    const settings = await appService.loadSettings();
    const library = await appService.loadLibraryBooks();
    setSettings(settings);
    setLibrary(library);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envConfig, appService]);

  // Listen for Authors tab sending a new ebook
  useEffect(() => {
    const channel = new BroadcastChannel('everythingebooks-library');
    channel.onmessage = () => {
      handleRefreshLibrary();
    };
    return () => channel.close();
  }, [handleRefreshLibrary]);

  // Prefetch other routes for offline support
  useEffect(() => {
    router.prefetch('/reader');
    router.prefetch('/library/xray');
    router.prefetch('/authors');
  }, [router]);

  useEffect(() => {
    if (appService?.hasWindow) {
      const currentWebview = getCurrentWebview();
      const unlisten = currentWebview.listen('close-reader-window', async () => {
        handleRefreshLibrary();
      });
      return () => {
        unlisten.then((fn) => fn());
      };
    }
    return;
  }, [appService, handleRefreshLibrary]);

  const handleImportBookFiles = useCallback(async (event: CustomEvent) => {
    const selectedFiles: SelectedFile[] = event.detail.files;
    const groupId: string = event.detail.groupId || '';
    if (selectedFiles.length === 0) return;
    await importBooks(selectedFiles, groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    eventDispatcher.on('import-book-files', handleImportBookFiles);
    return () => {
      eventDispatcher.off('import-book-files', handleImportBookFiles);
    };
  }, [handleImportBookFiles]);

  useEffect(() => {
    refreshGroups();
    if (!libraryBooks.some((book) => !book.deletedAt)) {
      handleSetSelectMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryBooks]);

  const processOpenWithFiles = useCallback(
    async (appService: AppService, openWithFiles: string[], libraryBooks: Book[]) => {
      const settings = await appService.loadSettings();
      const bookIds: string[] = [];
      for (const file of openWithFiles) {
        console.log('Open with book:', file);
        try {
          const temp = appService.isMobile ? false : !settings.autoImportBooksOnOpen;
          const book = await appService.importBook(file, libraryBooks, true, true, false, temp);
          if (book) {
            bookIds.push(book.hash);
          }
        } catch (error) {
          console.log('Failed to import book:', file, error);
        }
      }
      setLibrary(libraryBooks);
      appService.saveLibraryBooks(libraryBooks);

      console.log('Opening books:', bookIds);
      if (bookIds.length > 0) {
        setPendingNavigationBookIds(bookIds);
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleOpenLastBooks = async (
    appService: AppService,
    lastBookIds: string[],
    libraryBooks: Book[],
  ) => {
    if (lastBookIds.length === 0) return false;
    const bookIds: string[] = [];
    for (const bookId of lastBookIds) {
      const book = libraryBooks.find((b) => b.hash === bookId);
      if (book && (await appService.isBookAvailable(book))) {
        bookIds.push(book.hash);
      }
    }
    console.log('Opening last books:', bookIds);
    if (bookIds.length > 0) {
      setPendingNavigationBookIds(bookIds);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (pendingNavigationBookIds) {
      const bookIds = pendingNavigationBookIds;
      setPendingNavigationBookIds(null);
      if (bookIds.length > 0) {
        navigateToReader(router, bookIds);
      }
    }
  }, [pendingNavigationBookIds, appService, router]);

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    const loadingTimeout = setTimeout(() => setLoading(true), 300);
    const initLibrary = async () => {
      const appService = await envConfig.getAppService();
      const settings = await appService.loadSettings();
      setSettings(settings);

      // Reuse the library from the store when we return from the reader
      const library = libraryBooks.length > 0 ? libraryBooks : await appService.loadLibraryBooks();
      let opened = false;
      opened = await handleOpenWithBooks(appService, library);
      if (!opened && settings.openLastBooks) {
        opened = await handleOpenLastBooks(appService, settings.lastOpenBooks, library);
      }

      setLibrary(library);
      setLibraryLoaded(true);
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    };

    const handleOpenWithBooks = async (appService: AppService, library: Book[]) => {
      const openWithFiles = (await parseOpenWithFiles()) || [];

      if (openWithFiles.length > 0) {
        return await processOpenWithFiles(appService, openWithFiles, library);
      }
      return false;
    };

    initLibrary();
    return () => {
      isInitiating.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const importBooks = async (files: SelectedFile[], groupId?: string) => {
    setLoading(true);
    const { library } = useLibraryStore.getState();
    const failedImports: Array<{ filename: string; errorMessage: string }> = [];
    const errorMap: [string, string][] = [
      ['No chapters detected', _('No chapters detected')],
      ['Failed to parse EPUB', _('Failed to parse the EPUB file')],
      ['Unsupported format', _('This book format is not supported')],
      ['Failed to open file', _('Failed to open the book file')],
      ['Invalid or empty book file', _('The book file is empty')],
      ['Unsupported or corrupted book file', _('The book file is corrupted')],
      ['QuotaExceeded', _('Not enough storage space on device')],
    ];

    const processFile = async (selectedFile: SelectedFile) => {
      const file = selectedFile.file || selectedFile.path;
      if (!file) return;
      try {
        const book = await appService?.importBook(
          file,
          library,
          true,
          true,
          false,
          false,
          selectedFile.importSource,
        );
        if (book && groupId) {
          book.groupId = groupId;
          book.groupName = getGroupName(groupId);
          await updateBook(envConfig, book);
        }
      } catch (error) {
        const filename = typeof file === 'string' ? file : file.name;
        const baseFilename = getFilename(filename);
        const errorMessage =
          error instanceof Error
            ? errorMap.find(([str]) => error.message.includes(str))?.[1] || error.message
            : '';
        failedImports.push({ filename: baseFilename, errorMessage });
        console.error('Failed to import book:', filename, error);
      }
    };

    const concurrency = 4;
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      await Promise.all(batch.map(processFile));
    }

    if (failedImports.length > 0) {
      const filenames = failedImports.map((f) => f.filename);
      const errorMessage = failedImports.find((f) => f.errorMessage)?.errorMessage || '';

      eventDispatcher.dispatch('toast', {
        message:
          _('Failed to import book(s): {{filenames}}', {
            filenames: listFormater(false).format(filenames),
          }) + (errorMessage ? `\n${errorMessage}` : ''),
        type: 'error',
      });
    }

    setLibrary([...library]);
    appService?.saveLibraryBooks(library);
    setLoading(false);
  };

  const handleBookDownload = useCallback(
    async (_book: Book, _redownload = false) => {
      // Your Library disabled
      eventDispatcher.dispatch('toast', {
        type: 'info',
        message: _('Your Library is disabled'),
      });
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appService],
  );

  const handleBookDelete = (deleteAction: DeleteAction) => {
    return async (book: Book, _syncBooks = true) => {
      const deletionMessages = {
        both: _('Book deleted: {{title}}', { title: book.title }),
        cloud: _('Deleted Your Library backup of the book: {{title}}', { title: book.title }),
        local: _('Deleted local copy of the book: {{title}}', { title: book.title }),
      };
      const deletionFailMessages = {
        both: _('Failed to delete book: {{title}}', { title: book.title }),
        cloud: _('Failed to delete Your Library backup of the book: {{title}}', { title: book.title }),
        local: _('Failed to delete local copy of the book: {{title}}', { title: book.title }),
      };
      try {
        await appService?.deleteBook(book, deleteAction);

        // Hard-delete: always remove book from library entirely
        const updatedLibrary = libraryBooks.filter((b) => b.hash !== book.hash);
        setLibrary(updatedLibrary);
        await appService?.saveLibraryBooks(updatedLibrary);

        eventDispatcher.dispatch('toast', {
          type: 'info',
          timeout: 2000,
          message: deletionMessages[deleteAction],
        });
        return true;
      } catch {
        eventDispatcher.dispatch('toast', {
          message: deletionFailMessages[deleteAction],
          type: 'error',
        });
        return false;
      }
    };
  };

  const handleUpdateMetadata = async (book: Book, metadata: BookMetadata) => {
    book.metadata = metadata;
    book.title = formatTitle(metadata.title);
    book.author = formatAuthors(metadata.author);
    book.primaryLanguage = getPrimaryLanguage(metadata.language);
    book.updatedAt = Date.now();
    if (metadata.coverImageBlobUrl || metadata.coverImageUrl || metadata.coverImageFile) {
      book.coverImageUrl = metadata.coverImageBlobUrl || metadata.coverImageUrl;
      try {
        await appService?.updateCoverImage(
          book,
          metadata.coverImageBlobUrl || metadata.coverImageUrl,
          metadata.coverImageFile,
        );
      } catch (error) {
        console.warn('Failed to update cover image:', error);
      }
    }
    if (isWebAppPlatform()) {
      // Clear HTTP cover image URL if cover is updated with a local file
      if (metadata.coverImageBlobUrl) {
        metadata.coverImageUrl = undefined;
      }
    } else {
      metadata.coverImageUrl = undefined;
    }
    metadata.coverImageBlobUrl = undefined;
    metadata.coverImageFile = undefined;
    await updateBook(envConfig, book);
  };

  const handleImportBooks = async () => {
    setIsSelectMode(false);
    setShowImportModal(true);
  };

  const handleImportFromLocalFile = () => {
    setShowImportModal(false);
    console.log('Importing books...');
    selectFiles({ type: 'books', multiple: true }).then((result) => {
      if (result.files.length === 0 || result.error) return;
      const groupId = searchParams?.get('group') || '';
      // Set import source for each file (use path for desktop, filename for web)
      const filesWithSource = result.files.map((f) => ({
        ...f,
        importSource: f.path || f.file?.name,
      }));
      importBooks(filesWithSource, groupId);
    });
  };

  const handleSetSelectMode = (selectMode: boolean) => {
    // No Desktop - haptic feedback removed
    setIsSelectMode(selectMode);
    setIsSelectAll(false);
    setIsSelectNone(false);
  };

  const handleSelectAll = () => {
    setIsSelectAll(true);
    setIsSelectNone(false);
  };

  const handleDeselectAll = () => {
    setIsSelectNone(true);
    setIsSelectAll(false);
  };

  const handleShowDetailsBook = (book: Book) => {
    setShowDetailsBook(book);
  };

  const handleOpenReader = useCallback((bookHash: string) => {
    setReaderBookHash(bookHash);
  }, []);

  const handleCloseReader = useCallback(() => {
    setReaderBookHash(null);
    // Refresh library in case book progress changed
    handleRefreshLibrary();
  }, [handleRefreshLibrary]);

  if (!appService || !insets) {
    return <div className={clsx('h-[100vh]', !appService?.isLinuxApp && 'bg-base-200')} />;
  }

  const showBookshelf = libraryLoaded || libraryBooks.length > 0;

  return (
    <div
      ref={pageRef}
      aria-label='Your Library'
      className={clsx(
        'library-page text-base-content flex h-[100vh] select-none flex-col overflow-hidden',
        viewSettings?.isEink ? 'bg-base-100' : 'bg-base-200',
        appService?.hasRoundedWindow && isRoundedWindow && 'window-border rounded-window',
      )}
    >
      <div
        className='top-0 z-40 w-full'
        role='banner'
        tabIndex={-1}
        aria-label={_('Library Header')}
      >
        <LibraryHeader
          isSelectMode={isSelectMode}
          isSelectAll={isSelectAll}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onImportBooks={handleImportBooks}
          onToggleSelectMode={() => handleSetSelectMode(!isSelectMode)}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
      </div>
      {(loading || isSyncing) && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )}
      {showBookshelf &&
        (libraryBooks.some((book) => !book.deletedAt) ? (
          <OverlayScrollbarsComponent
            defer
            aria-label=''
            ref={osRef}
            className='flex-grow'
            options={{ scrollbars: { autoHide: 'scroll' } }}
            events={{
              initialized: (instance) => {
                const { content } = instance.elements();
                if (content) {
                  containerRef.current = content as HTMLDivElement;
                }
              },
            }}
          >
            <div
              className={clsx('scroll-container drop-zone flex-grow', isDragging && 'drag-over')}
              style={{
                paddingTop: '0px',
                paddingRight: `${insets.right}px`,
                paddingBottom: `${insets.bottom}px`,
                paddingLeft: `${insets.left}px`,
              }}
            >
              <progress
                className={clsx(
                  'progress progress-success absolute left-0 right-0 top-[2px] z-30 h-1 transition-opacity duration-200',
                  isSyncing ? 'opacity-100' : 'opacity-0',
                )}
                value={syncProgress * 100}
                max='100'
              ></progress>
              <DropIndicator />
              <Bookshelf
                libraryBooks={libraryBooks}
                isSelectMode={isSelectMode}
                isSelectAll={isSelectAll}
                isSelectNone={isSelectNone}
                searchQuery={searchQuery}
                handleImportBooks={handleImportBooks}
                handleBookDownload={handleBookDownload}
                handleBookDelete={handleBookDelete('local')}
                handleSetSelectMode={handleSetSelectMode}
                handleShowDetailsBook={handleShowDetailsBook}
                onOpenReader={handleOpenReader}
              />
            </div>
          </OverlayScrollbarsComponent>
        ) : (
          <div className='hero drop-zone h-screen items-center justify-center'>
            <DropIndicator />
            <div className='hero-content text-neutral-content text-center'>
              <div className='max-w-md'>
                <h1 className='mb-5 text-5xl font-bold'>{_('Your Library')}</h1>
                <p className='mb-5'>
                  {_(
                    'Welcome to your library. You can import your books here and read them anytime.',
                  )}
                </p>
                <button className='btn btn-primary rounded-xl' onClick={handleImportBooks}>
                  {_('Import Books')}
                </button>
              </div>
            </div>
          </div>
        ))}
      {showDetailsBook && (
        <BookDetailModal
          isOpen={!!showDetailsBook}
          book={showDetailsBook}
          onClose={() => setShowDetailsBook(null)}
          handleBookDelete={handleBookDelete('local')}
          handleBookMetadataUpdate={handleUpdateMetadata}
        />
      )}
      <AboutWindow />
      <StorageWindow />
      {isSettingsDialogOpen && <SettingsDialog bookKey={''} />}
      <Dialog
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={_('Import Ebook')}
        boxClassName='sm:!h-auto sm:!w-auto sm:!max-w-sm'
      >
        <div className='flex flex-col gap-4 p-4'>
          <div className='flex flex-col gap-1'>
            <h3 className='text-base font-semibold'>{_('from Local .epub file')}</h3>
            <p className='text-sm text-base-content/70'>
              {_('Select an EPUB file from your device')}
            </p>
            <button
              className='btn btn-xs btn-primary'
              onClick={handleImportFromLocalFile}
            >
              {_('Choose File')}
            </button>
          </div>
        </div>
      </Dialog>
      {!settings.hideWelcomeModal && (
        <WelcomeModal
          isDarkMode={isDarkMode}
          theme={theme}
          onHideForever={() => {
            const newSettings = { ...settings, hideWelcomeModal: true };
            setSettings(newSettings);
            saveSettings(envConfig, newSettings);
          }}
        />
      )}
      <Toast />
      <ReaderModal
        bookHash={readerBookHash}
        onClose={handleCloseReader}
      />
    </div>
  );
};

const LibraryPage = () => {
  return (
    <Suspense fallback={<div className='h-[100vh]' />}>
      <LibraryPageWithSearchParams />
    </Suspense>
  );
};

export default LibraryPage;
