// app/authors/LibraryBooksModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import { Book } from '@/types/book';
import environmentConfig from '@/services/environment';

interface LibraryBooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBook: (book: Book) => void;
  theme: ThemeConfig;
  isDarkMode: boolean;
}

export default function LibraryBooksModal({
  isOpen,
  onClose,
  onSelectBook,
  theme,
  isDarkMode,
}: LibraryBooksModalProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load library books on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadBooks = async () => {
      setLoading(true);
      setError(null);
      try {
        const appService = await environmentConfig.getAppService();
        const libraryBooks = await appService.loadLibraryBooks();
        // Filter to only show EPUB books that aren't soft-deleted (same as Library UI)
        const epubBooks = libraryBooks.filter(book =>
          book.format === 'EPUB' &&
          !book.deletedAt
        );
        setBooks(epubBooks);
      } catch (err) {
        console.error('Error loading library books:', err);
        setError('Failed to load library books');
      } finally {
        setLoading(false);
      }
    };

    loadBooks();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (book: Book) => {
    onSelectBook(book);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.bg,
          border: `1px solid ${theme.border}`,
          borderRadius: '8px',
          padding: '20px',
          minWidth: '400px',
          maxWidth: '500px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <h3 style={{ margin: 0, color: theme.text, fontSize: '16px' }}>
            Load from Library
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: theme.textMuted,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: '200px',
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 0',
              color: theme.textMuted,
              fontSize: '14px',
            }}>
              Loading books...
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 0',
              color: '#dc3545',
              fontSize: '14px',
            }}>
              {error}
            </div>
          ) : books.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 0',
              color: theme.textMuted,
              fontSize: '14px',
            }}>
              No EPUB books in your Library.
              <br />
              <span style={{ fontSize: '12px' }}>
                Add books to your Library first, then you can load them here for editing.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {books.map((book) => (
                <button
                  key={book.hash}
                  onClick={() => handleSelect(book)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    backgroundColor: 'transparent',
                    border: `1px solid transparent`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.03)';
                    e.currentTarget.style.borderColor = theme.border;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <span style={{
                    color: theme.text,
                    fontSize: '14px',
                    fontWeight: 500,
                    lineHeight: 1.3,
                  }}>
                    {book.title || 'Untitled'}
                  </span>
                  <span style={{
                    color: theme.textMuted,
                    fontSize: '12px',
                    marginTop: '2px',
                  }}>
                    {book.author || 'Unknown Author'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: `1px solid ${theme.border}`,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
