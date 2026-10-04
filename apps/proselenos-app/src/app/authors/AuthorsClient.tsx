// app/authors/AuthorsClient.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTheme } from '../shared/theme';
import AuthorsLayout from './AuthorsLayout';
import AboutModal from '@/components/AboutModal';
import StorageModal from '@/components/StorageModal';
import FilesModal from '@/app/projects/FilesModal';
import EditorModal from '@/app/proselenos/EditorModal';
import BookInfoModal from './BookInfoModal';
import LibraryBooksModal from './LibraryBooksModal';
import CoverModal from './CoverModal';
import ManuscriptXrayModal from '@/components/xray/ManuscriptXrayModal';
import { loadAppSettings, saveAppSettings, clearWorkingCopy, saveFullWorkingCopy, saveManuscriptImage, saveManuscriptAudio, saveWorkingCopyMeta, loadWorkingCopyMeta } from '@/services/manuscriptStorage';
import { parseEpub } from '@/services/epubService';
import { Book } from '@/types/book';
import { getLocalBookFilename } from '@/utils/book';
import environmentConfig from '@/services/environment';
import Swal from 'sweetalert2';
import { showAlert } from '../shared/alerts';

export default function AuthorsClient() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && localStorage) {
      return localStorage.getItem('authorsDarkMode') !== 'false';
    }
    return true;
  });

  // About modal state
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [hideAboutOnStartup, setHideAboutOnStartup] = useState(true); // default to hidden until we load settings

  // Storage modal state
  const [showStorageModal, setShowStorageModal] = useState(false);

  // Files modal state
  const [showFilesModal, setShowFilesModal] = useState(false);

  // Sidebar visibility state
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Editor modal state
  const [showEditor, setShowEditor] = useState(false);

  // Book Info modal state
  const [showBookInfo, setShowBookInfo] = useState(false);

  // Library Books modal state
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  // Cover modal state
  const [showCoverModal, setShowCoverModal] = useState(false);
  // X-Ray modal state
  const [showXrayModal, setShowXrayModal] = useState(false);
  const [coverTitle, setCoverTitle] = useState('');
  const [coverAuthor, setCoverAuthor] = useState('');

  // Refresh key to trigger AuthorsLayout to reload Working Copy
  const [refreshKey, setRefreshKey] = useState(0);

  const theme = getTheme(isDarkMode);
  const router = useRouter();

  // Prefetch other routes for offline support
  useEffect(() => {
    router.prefetch('/library');
    router.prefetch('/reader');
  }, [router]);

  // Show About on startup if needed
  useEffect(() => {
    loadAppSettings().then((settings) => {
      // Show About on startup if hideAboutModal is not set or false
      const shouldHide = settings?.hideAboutModal ?? false;
      setHideAboutOnStartup(shouldHide);
      if (!shouldHide) {
        setShowAboutModal(true);
      }
    });
  }, []);

  // Toggle "Don't show About on startup" setting
  const handleToggleHideAboutOnStartup = async (hide: boolean) => {
    setHideAboutOnStartup(hide);
    const settings = await loadAppSettings() || { darkMode: isDarkMode };
    settings.hideAboutModal = hide;
    await saveAppSettings(settings);
  };

  // Load book from Library handler
  const handleLoadFromLibrary = async (book: Book) => {
    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Load from Library?',
      text: 'Loading a new book will replace your current work. Continue?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Load',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      background: isDarkMode ? '#222' : '#fff',
      color: isDarkMode ? '#fff' : '#333',
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      // Get the epub file from Library database
      const appService = await environmentConfig.getAppService();
      const bookPath = getLocalBookFilename(book);
      const epubFile = await appService.openFile(bookPath, 'Books');

      // Parse the epub
      const parsed = await parseEpub(epubFile);

      // Clear existing working copy and save new one
      await clearWorkingCopy();

      // Save extracted inline images to IndexedDB
      const imageIds: string[] = [];
      if (parsed.images && parsed.images.length > 0) {
        for (const img of parsed.images) {
          await saveManuscriptImage(img.filename, img.blob);
          imageIds.push(img.filename);
        }
      }

      // Save extracted audio files to IndexedDB
      if (parsed.audios && parsed.audios.length > 0) {
        for (const aud of parsed.audios) {
          await saveManuscriptAudio(aud.filename, aud.blob);
        }
      }

      // Filter out table-of-contents - it gets auto-generated on "Publish"
      await saveFullWorkingCopy({
        title: parsed.title,
        author: parsed.author,
        language: parsed.language,
        coverImage: parsed.coverImage,
        sections: parsed.sections
          .filter((s) => s.type !== 'table-of-contents')
          .map((s) => ({
            id: s.id,
            title: s.title,
            xhtml: s.xhtml,
            type: s.type,
            sceneCraftConfig: s.sceneCraftConfig,
          })),
      });

      // Update metadata with imageIds
      if (imageIds.length > 0) {
        const existingMeta = await loadWorkingCopyMeta();
        if (existingMeta) {
          await saveWorkingCopyMeta({ ...existingMeta, imageIds });
        }
      }

      // Trigger AuthorsLayout to reload from Working Copy
      setRefreshKey(prev => prev + 1);

      showAlert(`Loaded "${parsed.title}" from Library`, 'success', undefined, isDarkMode);
    } catch (error) {
      console.error('Error loading from library:', error);
      showAlert(`Error loading book: ${(error as Error).message}`, 'error', undefined, isDarkMode);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    if (typeof window !== 'undefined' && localStorage) {
      localStorage.setItem('authorsDarkMode', String(newDarkMode));
    }
  };

  // Open cover modal (loads title/author from working copy)
  const handleOpenCoverModal = async () => {
    const meta = await loadWorkingCopyMeta();
    setCoverTitle(meta?.title ?? '');
    setCoverAuthor(meta?.author ?? '');
    setShowCoverModal(true);
  };

  // Handle cover saved (refresh to show new cover)
  const handleCoverSaved = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <>
      <AuthorsLayout
        theme={theme}
        isDarkMode={isDarkMode}
        onThemeToggle={toggleTheme}
        onAboutClick={() => setShowAboutModal(true)}
        onStorageClick={() => setShowStorageModal(true)}
        onFilesClick={() => setShowFilesModal(true)}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        onEditorClick={() => setShowEditor(true)}
        onCoverClick={handleOpenCoverModal}
        onXrayClick={() => setShowXrayModal(true)}
        onLoadFromLibraryClick={() => setShowLibraryModal(true)}
        // Working Copy refresh props
        refreshKey={refreshKey}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        isDarkMode={isDarkMode}
        theme={theme}
        hideOnStartup={hideAboutOnStartup}
        onToggleHideOnStartup={handleToggleHideAboutOnStartup}
      />

      {/* Storage Modal */}
      <StorageModal
        isOpen={showStorageModal}
        onClose={() => setShowStorageModal(false)}
        isDarkMode={isDarkMode}
        theme={theme}
      />

      {/* Files Modal */}
      <FilesModal
        isOpen={showFilesModal}
        onClose={() => setShowFilesModal(false)}
        isDarkMode={isDarkMode}
        theme={theme}
      />

      {/* Editor Modal */}
      <EditorModal
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        theme={theme}
        isDarkMode={isDarkMode}
      />

      {/* Book Info Modal */}
      <BookInfoModal
        isOpen={showBookInfo}
        onClose={() => setShowBookInfo(false)}
        onSave={() => setShowBookInfo(false)}
        theme={theme}
        isDarkMode={isDarkMode}
      />

      {/* Library Books Modal */}
      <LibraryBooksModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onSelectBook={handleLoadFromLibrary}
        theme={theme}
        isDarkMode={isDarkMode}
      />

      {/* Cover Generator Modal */}
      <CoverModal
        isOpen={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        theme={theme}
        title={coverTitle}
        author={coverAuthor}
        onCoverSaved={handleCoverSaved}
      />

      {/* Manuscript X-Ray Modal */}
      <ManuscriptXrayModal
        isOpen={showXrayModal}
        onClose={() => setShowXrayModal(false)}
        bookTitle={coverTitle || undefined}
        isDarkMode={isDarkMode}
      />
    </>
  );
}
