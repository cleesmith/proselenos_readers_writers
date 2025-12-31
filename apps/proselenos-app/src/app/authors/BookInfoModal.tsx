// BookInfoModal Component
// Full-screen modal for book metadata settings

'use client';

import { useState, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

export interface BookMetadata {
  title: string;
  author: string;
  publisher: string;
  buyUrl: string;
  aboutAuthor: string;
}

interface BookInfoModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  isLoading?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (metadata: BookMetadata) => void;
  initialMetadata?: BookMetadata;
}

const defaultMetadata: BookMetadata = {
  title: '',
  author: '',
  publisher: '',
  buyUrl: '',
  aboutAuthor: ''
};

export default function BookInfoModal({
  isOpen,
  theme,
  isDarkMode: _isDarkMode,
  isLoading = false,
  isSaving = false,
  onClose,
  onSave,
  initialMetadata
}: BookInfoModalProps) {
  const [metadata, setMetadata] = useState<BookMetadata>(defaultMetadata);
  const [hasChanges, setHasChanges] = useState(false);

  // Update metadata when initialMetadata changes
  useEffect(() => {
    if (initialMetadata) {
      setMetadata(initialMetadata);
      setHasChanges(false);
    }
  }, [initialMetadata]);

  // Track changes
  const handleChange = (field: keyof BookMetadata, value: string) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(metadata);
    setHasChanges(false);
  };

  const handleCancel = () => {
    if (initialMetadata) {
      setMetadata(initialMetadata);
    }
    setHasChanges(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.modalBg,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold',
            color: theme.text
          }}>
            Book Info
          </h2>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <StyledSmallButton onClick={handleCancel} disabled={isLoading || isSaving} theme={theme}>
              Cancel
            </StyledSmallButton>
            <StyledSmallButton onClick={handleSave} disabled={isLoading || isSaving || !hasChanges} theme={theme}>
              {isSaving ? 'Saving...' : 'Save'}
            </StyledSmallButton>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px'
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '16px'
          }}>
            {/* Title */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.text
              }}>
                Title
              </label>
              <textarea
                value={metadata.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={isLoading ? "Loading data..." : "Enter title..."}
                disabled={isLoading || isSaving}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </div>

            {/* Author */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.text
              }}>
                Author
              </label>
              <input
                type="text"
                value={metadata.author}
                onChange={(e) => handleChange('author', e.target.value)}
                placeholder={isLoading ? "Loading data..." : "Enter author name..."}
                disabled={isLoading || isSaving}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            {/* Publisher */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.text
              }}>
                Publisher
              </label>
              <input
                type="text"
                value={metadata.publisher}
                onChange={(e) => handleChange('publisher', e.target.value)}
                placeholder={isLoading ? "Loading data..." : "Enter publisher..."}
                disabled={isLoading || isSaving}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            {/* Buy URL */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.text
              }}>
                Buy URL
              </label>
              <input
                type="url"
                value={metadata.buyUrl}
                onChange={(e) => handleChange('buyUrl', e.target.value)}
                placeholder={isLoading ? "Loading data..." : "Enter purchase URL..."}
                disabled={isLoading || isSaving}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            {/* About Author */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '600',
                color: theme.text
              }}>
                About Author
              </label>
              <textarea
                value={metadata.aboutAuthor}
                onChange={(e) => handleChange('aboutAuthor', e.target.value)}
                placeholder={isLoading ? "Loading data..." : "Enter author bio..."}
                disabled={isLoading || isSaving}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </div>

          </div>
        </div>

        {/* Footer Status */}
        {(isLoading || isSaving) && (
          <div style={{
            padding: '12px 20px',
            borderTop: `1px solid ${theme.border}`,
            backgroundColor: theme.statusBg,
            color: theme.textMuted,
            fontSize: '12px',
            textAlign: 'center'
          }}>
            {isLoading ? 'Loading book info...' : 'Saving book info...'}
          </div>
        )}
    </div>
  );
}
