import React, { useEffect, useState } from 'react';
import { Book } from '@/types/book';
import { getLocalBookFilename } from '@/utils/book';
import { useEnv } from '@/context/EnvContext';
import XrayViewer from './XrayViewer';
import Spinner from '@/components/Spinner';

interface XrayModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
}

const XrayModal: React.FC<XrayModalProps> = ({ book, isOpen, onClose }) => {
  const { envConfig } = useEnv();
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEpubFile(null);
      setLoading(true);
      setError(null);
      return;
    }

    const loadEpub = async () => {
      setLoading(true);
      setError(null);
      try {
        const appService = await envConfig.getAppService();
        const epubFilename = getLocalBookFilename(book);
        const file = await appService.openFile(epubFilename, 'Books');

        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
        const epubFileObj = new File([blob], `${book.title}.epub`, {
          type: 'application/epub+zip',
        });
        setEpubFile(epubFileObj);
      } catch (err) {
        console.error('Failed to load book for X-ray:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
      } finally {
        setLoading(false);
      }
    };

    loadEpub();
  }, [isOpen, book, envConfig]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-base-100">
        <Spinner loading />
      </div>
    );
  }

  // Error state
  if (error || !epubFile) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-base-100">
        <div className="text-center">
          <p className="text-error font-semibold mb-2">
            {error || 'Failed to load book'}
          </p>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <XrayViewer
        bookTitle={book.title}
        epubFile={epubFile}
        onClose={onClose}
      />
    </div>
  );
};

export default XrayModal;
