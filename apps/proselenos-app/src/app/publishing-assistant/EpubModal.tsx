// EpubModal.tsx - Local-first EPUB generation and import to library

'use client';

import { useRef } from 'react';
import { useEpubActions } from './useEpubActions';
import StyledSmallButton from '@/components/StyledSmallButton';

interface EpubModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
  isDarkMode: boolean;
}

export default function EpubModal({
  isOpen,
  onClose,
  theme,
  isDarkMode
}: EpubModalProps) {
  const { state, actions } = useEpubActions();
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Handle cover file selection
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      actions.setCoverImage(file);
    }
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };

  // Open modal when isOpen changes
  if (isOpen && !state.isOpen) {
    actions.openModal();
  }

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    actions.closeModal();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <div
        style={{
          backgroundColor: isDarkMode ? '#2c3035' : '#ffffff',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          borderRadius: '12px',
          padding: '0',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden file input for cover */}
        <input
          ref={coverInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          onChange={handleCoverFileChange}
          style={{ display: 'none' }}
        />

        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: theme.text }}>
            EPUB to Library
          </h3>
          <StyledSmallButton onClick={handleClose} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Modal Content */}
        <div
          style={{
            padding: '20px',
            maxHeight: 'calc(90vh - 80px)',
            overflowY: 'auto'
          }}
        >
          {/* Section 1: Generate EPUB from manuscript */}
          <div
            style={{
              padding: '16px',
              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'}`,
              borderRadius: '8px',
              marginBottom: '16px',
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: theme.text, marginBottom: '8px' }}>
              GENERATE FROM MANUSCRIPT
            </div>
            <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '12px' }}>
              Create an EPUB from your manuscript.txt and add it to your e-reader library.
            </div>

            {!state.hasManuscript ? (
              <div
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  color: theme.textSecondary,
                  fontSize: '12px',
                  border: `1px dashed ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                  borderRadius: '4px'
                }}
              >
                No manuscript found. Import a manuscript.txt file first.
              </div>
            ) : (
              <>
                {/* Cover image picker */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                    Cover Image (optional):
                  </label>
                  {state.coverImage.previewUrl ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <img
                        src={state.coverImage.previewUrl}
                        alt="Cover preview"
                        style={{
                          width: '50px',
                          height: 'auto',
                          maxHeight: '75px',
                          objectFit: 'contain',
                          borderRadius: '3px',
                          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                        }}
                      />
                      <div>
                        {state.coverImage.width && (
                          <div style={{ fontSize: '11px', color: theme.textSecondary, marginBottom: '4px' }}>
                            {state.coverImage.width} x {state.coverImage.height} px
                          </div>
                        )}
                        <button
                          onClick={actions.clearCoverImage}
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            borderRadius: '3px',
                            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                            backgroundColor: 'transparent',
                            color: theme.textSecondary,
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => coverInputRef.current?.click()}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: `1px dashed ${isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}`,
                        backgroundColor: 'transparent',
                        color: theme.textSecondary,
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    >
                      Select cover image (JPG or PNG)
                    </button>
                  )}
                </div>

                {/* Error/Success messages */}
                {state.generateError && (
                  <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>
                    {state.generateError}
                  </div>
                )}
                {state.generateSuccess && (
                  <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '8px' }}>
                    EPUB generated and added to your library!
                  </div>
                )}

                {/* Generate button */}
                <button
                  onClick={actions.generateEpub}
                  disabled={state.isGenerating}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: state.isGenerating ? '#6b7280' : '#3b82f6',
                    color: '#ffffff',
                    cursor: state.isGenerating ? 'not-allowed' : 'pointer'
                  }}
                >
                  {state.isGenerating ? 'Generating...' : 'Generate & Add to Library'}
                </button>
              </>
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              textAlign: 'center',
              margin: '5px 0',
              position: 'relative'
            }}
          >
            <div
              style={{
                borderTop: `2px solid ${isDarkMode ? 'rgba(255, 140, 0, 0.4)' : 'rgba(255, 140, 0, 0.5)'}`,
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0
              }}
            />
            <span
              style={{
                backgroundColor: isDarkMode ? '#2c3035' : '#ffffff',
                padding: '0 8px',
                fontSize: '8px',
                fontWeight: 'bold',
                color: '#FF8C00',
                position: 'relative'
              }}
            >
              or
            </span>
          </div>

          {/* Section 2: Use Uploaded EPUB */}
          <div
            style={{
              padding: '16px',
              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'}`,
              borderRadius: '8px',
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: theme.text, marginBottom: '8px' }}>
              USE UPLOADED EPUB
            </div>
            <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '12px' }}>
              Add an EPUB you uploaded via Files (e.g., created with Vellum) to your e-reader library.
            </div>

            {!state.hasUploadedEpub ? (
              <div
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  color: theme.textSecondary,
                  fontSize: '12px',
                  border: `1px dashed ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                  borderRadius: '4px'
                }}
              >
                No EPUB found. Upload an .epub file via Files first.
              </div>
            ) : (
              <>
                {/* Error/Success messages */}
                {state.importError && (
                  <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>
                    {state.importError}
                  </div>
                )}
                {state.importSuccess && (
                  <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '8px' }}>
                    EPUB added to your library!
                  </div>
                )}

                {/* Import button */}
                <button
                  onClick={actions.importUploadedEpub}
                  disabled={state.isImporting}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: state.isImporting ? '#6b7280' : '#FF8C00',
                    color: '#ffffff',
                    cursor: state.isImporting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {state.isImporting ? 'Adding...' : 'Add to Library'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
