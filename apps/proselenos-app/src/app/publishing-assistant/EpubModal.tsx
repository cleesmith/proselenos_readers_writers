// EpubModal.tsx - EPUB generation (gepub) and publishing (xepub)

'use client';

import { useRef } from 'react';
import { useEpubActions } from './useEpubActions';
import StyledSmallButton from '@/components/StyledSmallButton';

interface EpubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string | null;
  theme: any;
  isDarkMode: boolean;
}

export default function EpubModal({
  isOpen,
  onClose,
  currentProjectId,
  theme,
  isDarkMode
}: EpubModalProps) {
  const { state, actions } = useEpubActions(currentProjectId);
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
          maxWidth: '550px',
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
            EPUB Options
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
          {/* GEPUB Section */}
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
              GENERATE EPUB
            </div>
            <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '12px' }}>
              Create an EPUB from your manuscript text file. Good for drafts and testing with beta readers.
            </div>

            {/* Manuscript selector */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                Manuscript:
              </label>
              <select
                value={state.selectedTxt?.path || ''}
                onChange={(e) => {
                  const selected = state.txtFiles.find((f: any) => f.path === e.target.value);
                  actions.selectTxt(selected || null);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  borderRadius: '4px',
                  border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                  backgroundColor: isDarkMode ? '#1e2227' : '#ffffff',
                  color: theme.text
                }}
              >
                <option value="">Select a .txt file...</option>
                {state.txtFiles.map((file: any) => (
                  <option key={file.id} value={file.path}>{file.name}</option>
                ))}
              </select>
            </div>

            {state.selectedTxt && (
              <>
                {/* Cover image for gepub */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                    Cover Image (optional):
                  </label>
                  {state.coverImage.previewUrl && !state.coverImage.isAutoExtracted ? (
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

                {/* Bookstore checkbox */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    border: '1px solid #FF8C00',
                    borderRadius: '4px',
                    marginBottom: '12px',
                    cursor: 'pointer'
                  }}
                  onClick={actions.togglePublishToStore}
                >
                  <input
                    type="checkbox"
                    checked={state.publishToStore}
                    onChange={() => actions.togglePublishToStore()}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', color: theme.text }}>
                    List in Proselenos Ebooks
                  </span>
                </div>

                {/* Error/Success messages */}
                {state.generateError && (
                  <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>
                    {state.generateError}
                  </div>
                )}
                {state.generateSuccess && (
                  <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '8px' }}>
                    EPUB generated successfully!
                  </div>
                )}

                {/* Generate button */}
                <button
                  onClick={actions.generateGepub}
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
                  {state.isGenerating ? 'Generating...' : 'Generate'}
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

          {/* XEPUB Section */}
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
              PUBLISH UPLOADED EPUB
            </div>
            <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '12px' }}>
              Publish an EPUB created elsewhere (Vellum, Smashwords, etc). Use this for your final, professionally formatted version.
            </div>

            {state.epubFiles.length === 0 ? (
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
                No EPUB files found. Upload an EPUB to your project first.
              </div>
            ) : (
              <>
                {/* EPUB selector */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                    EPUB:
                  </label>
                  <select
                    value={state.selectedEpub?.path || ''}
                    onChange={(e) => {
                      const selected = state.epubFiles.find((f: any) => f.path === e.target.value);
                      actions.selectEpub(selected || null);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: '4px',
                      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                      backgroundColor: isDarkMode ? '#1e2227' : '#ffffff',
                      color: theme.text
                    }}
                  >
                    <option value="">Select an .epub file...</option>
                    {state.epubFiles.map((file: any) => (
                      <option key={file.id} value={file.path}>{file.name}</option>
                    ))}
                  </select>
                </div>

                {state.selectedEpub && (
                  <>
                    {/* Auto-extracted cover preview */}
                    {state.coverImage.isProcessing ? (
                      <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '12px' }}>
                        Extracting cover...
                      </div>
                    ) : state.coverImage.previewUrl && state.coverImage.isAutoExtracted ? (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: theme.textSecondary, display: 'block', marginBottom: '4px' }}>
                          Cover (auto-extracted):
                        </label>
                        <img
                          src={state.coverImage.previewUrl}
                          alt="Cover preview"
                          style={{
                            width: '60px',
                            height: 'auto',
                            maxHeight: '90px',
                            objectFit: 'contain',
                            borderRadius: '3px',
                            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '12px' }}>
                        No cover found in EPUB (will use algorithmic color)
                      </div>
                    )}

                    {/* Error/Success messages */}
                    {state.publishError && (
                      <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>
                        {state.publishError}
                      </div>
                    )}
                    {state.publishSuccess && (
                      <div style={{ fontSize: '12px', color: '#22c55e', marginBottom: '8px' }}>
                        Published to Proselenos Ebooks successfully!
                      </div>
                    )}

                    {/* Publish button */}
                    <button
                      onClick={actions.publishXepub}
                      disabled={state.isPublishing}
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: state.isPublishing ? '#6b7280' : '#FF8C00',
                        color: '#ffffff',
                        cursor: state.isPublishing ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {state.isPublishing ? 'Publishing...' : 'Publish to Proselenos Ebooks'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Warning */}
          <div
            style={{
              fontSize: '11px',
              color: '#f59e0b',
              padding: '10px',
              backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              borderRadius: '4px',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}
          >
            Only ONE epub per project can be listed in the Proselenos Ebooks. Publishing replaces any existing listing.
          </div>
        </div>
      </div>
    </div>
  );
}
