import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

import { Book } from '@/types/book';
import { BookMetadata, EXTS } from '@/libs/document';
import { getLocalBookFilename } from '@/utils/book';
import { makeSafeFilename } from '@/utils/misc';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useMetadataEdit } from './useMetadataEdit';
import { DeleteAction } from '@/types/system';
import Alert from '@/components/Alert';
import Dialog from '@/components/Dialog';
import Spinner from '@/components/Spinner';
import BookDetailView from './BookDetailView';
import BookDetailEdit from './BookDetailEdit';
import { XrayModal } from '@/components/xray';

interface BookDetailModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  handleBookUpload?: (book: Book) => void;
  handleBookDelete?: (book: Book) => void;
  handleBookMetadataUpdate?: (book: Book, updatedMetadata: BookMetadata) => void;
}

interface DeleteConfig {
  title: string;
  message: string;
  handler?: (book: Book) => void;
}

const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  handleBookUpload,
  handleBookDelete,
  handleBookMetadataUpdate,
}) => {
  const _ = useTranslation();
  const { safeAreaInsets } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [activeDeleteAction, setActiveDeleteAction] = useState<DeleteAction | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [bookMeta, setBookMeta] = useState<BookMetadata | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [showXray, setShowXray] = useState(false);
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();

  // Initialize metadata edit hook
  const {
    editedMeta,
    fieldSources,
    lockedFields,
    fieldErrors,
    handleFieldChange,
    handleToggleFieldLock,
    handleLockAll,
    handleUnlockAll,
    resetToOriginal,
  } = useMetadataEdit(bookMeta);

  const deleteConfigs: Record<DeleteAction, DeleteConfig> = {
    both: {
      title: _('Confirm Deletion'),
      message: _('Are you sure to delete the selected book?'),
      handler: handleBookDelete,
    },
    cloud: {
      title: _('Confirm Deletion'),
      message: _('Are you sure to delete the selected book?'),
      handler: undefined,
    },
    local: {
      title: _('Confirm Deletion'),
      message: _('Are you sure to delete the selected book?'),
      handler: undefined,
    },
  };

  useEffect(() => {
    const loadingTimeout = setTimeout(() => setLoading(true), 300);
    const fetchBookDetails = async () => {
      const appService = await envConfig.getAppService();
      try {
        const details = book.metadata || (await appService.fetchBookDetails(book, settings));
        // Merge book.importSource into metadata if metadata.importSource is not set
        if (book.importSource && !details.importSource) {
          details.importSource = book.importSource;
        }
        setBookMeta(details);
        const size = await appService.getBookFileSize(book);
        setFileSize(size);
      } finally {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        setLoading(false);
      }
    };
    fetchBookDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  const handleClose = () => {
    setBookMeta(null);
    setEditMode(false);
    setActiveDeleteAction(null);
    setShowXray(false);
    onClose();
  };

  const handleEditMetadata = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    resetToOriginal();
    setEditMode(false);
  };

  const handleSaveMetadata = () => {
    if (editedMeta && handleBookMetadataUpdate) {
      setBookMeta({ ...editedMeta });
      handleBookMetadataUpdate(book, editedMeta);
      setEditMode(false);
    }
  };

  const handleDeleteAction = (action: DeleteAction) => {
    setActiveDeleteAction(action);
  };

  const confirmDeleteAction = async () => {
    if (!activeDeleteAction) return;

    const config = deleteConfigs[activeDeleteAction];
    handleClose();

    if (config.handler) {
      config.handler(book);
    }
  };

  const cancelDeleteAction = () => {
    setActiveDeleteAction(null);
  };

  const handleDelete = () => handleDeleteAction('both');

  const handleReupload = async () => {
    handleClose();
    if (handleBookUpload) {
      handleBookUpload(book);
    }
  };

  const handleDownloadLocal = async () => {
    const appService = await envConfig.getAppService();
    const epubFilename = getLocalBookFilename(book);
    const epubFile = await appService.openFile(epubFilename, 'Books');
    const arrayBuffer = await epubFile.arrayBuffer();

    const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${makeSafeFilename(book.title)}.${EXTS[book.format]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleXray = () => {
    setShowXray(true);
  };

  const handleCloseXray = () => {
    setShowXray(false);
  };

  const currentDeleteConfig = activeDeleteAction ? deleteConfigs[activeDeleteAction] : null;

  if (!bookMeta)
    return (
      loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )
    );

  return (
    <>
      <div className='fixed inset-0 z-50 flex items-center justify-center'>
        <Dialog
          title={editMode ? _('Edit Ebook Metadata') : _('Ebook Details')}
          isOpen={isOpen}
          onClose={handleClose}
          boxClassName={clsx(
            editMode ? 'sm:min-w-[600px] sm:max-w-[600px]' : 'sm:min-w-[480px] sm:max-w-[480px]',
            'sm:h-auto sm:max-h-[90%]',
          )}
          contentClassName='!px-6 !py-4'
        >
          <div className='flex w-full select-text items-start justify-center'>
            {editMode ? (
              <BookDetailEdit
                book={book}
                metadata={editedMeta}
                fieldSources={fieldSources}
                lockedFields={lockedFields}
                fieldErrors={fieldErrors}
                onFieldChange={handleFieldChange}
                onToggleFieldLock={handleToggleFieldLock}
                onLockAll={handleLockAll}
                onUnlockAll={handleUnlockAll}
                onCancel={handleCancelEdit}
                onReset={resetToOriginal}
                onSave={handleSaveMetadata}
              />
            ) : (
              <BookDetailView
                book={book}
                metadata={bookMeta}
                fileSize={fileSize}
                onEdit={handleBookMetadataUpdate ? handleEditMetadata : undefined}
                onDelete={handleBookDelete ? handleDelete : undefined}
                onDownload={undefined}
                onUpload={handleBookUpload ? handleReupload : undefined}
                onDownloadLocal={handleDownloadLocal}
                onXray={handleXray}
              />
            )}
          </div>
        </Dialog>

        {activeDeleteAction && currentDeleteConfig && (
          <div
            className={clsx('fixed bottom-0 left-0 right-0 z-50 flex justify-center')}
            style={{
              paddingBottom: `${(safeAreaInsets?.bottom || 0) + 16}px`,
            }}
          >
            <Alert
              title={currentDeleteConfig.title}
              message={currentDeleteConfig.message}
              onCancel={cancelDeleteAction}
              onConfirm={confirmDeleteAction}
            />
          </div>
        )}
      </div>

      <XrayModal
        book={book}
        isOpen={showXray}
        onClose={handleCloseXray}
      />
    </>
  );
};

export default BookDetailModal;
