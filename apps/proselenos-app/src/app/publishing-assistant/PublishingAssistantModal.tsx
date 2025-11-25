// Publishing Assistant Modal
// Main modal component for step-by-step publishing

'use client';

import { useEffect, useRef } from 'react';
import { PublishingAssistantModalProps } from '@/lib/publishing-assistant/types';
import { usePublishingAssistant } from './usePublishingAssistant';
import ProgressStep from './ProgressStep';
import StyledSmallButton from '@/components/StyledSmallButton';

export default function PublishingAssistantModal({
  isOpen,
  onClose,
  currentProject: _currentProject,
  currentProjectId,
  theme,
  isDarkMode
}: PublishingAssistantModalProps) {

  const { state, actions } = usePublishingAssistant(currentProjectId);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Handle cover file selection
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      actions.setCoverImage(file);
    }
    // Reset input so same file can be selected again
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };

  // Handle modal open
  useEffect(() => {
    if (isOpen && !state.isModalOpen) {
      actions.openModal();
    }
  }, [isOpen, state.isModalOpen, actions.openModal]);


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
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div 
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3 
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              margin: 0,
              color: theme.text
            }}
          >
            📚 Publishing Assistant
          </h3>
          <StyledSmallButton onClick={handleClose} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Modal Content */}
        <div 
          style={{
            padding: '24px',
            maxHeight: 'calc(90vh - 120px)',
            overflowY: 'auto'
          }}
        >
          {state.showFileSelector ? (
            /* File Selection View */
            <div>
              <div 
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '16px',
                  color: theme.text
                }}
              >
                Select Manuscript to Publish
              </div>
              
              <div 
                style={{
                  fontSize: '14px',
                  color: theme.textSecondary,
                  marginBottom: '16px'
                }}
              >
                Choose the manuscript file you want to convert to HTML, EPUB, and PDF formats.
              </div>

              {state.files.length === 0 ? (
                <div 
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: theme.textSecondary,
                    fontSize: '14px'
                  }}
                >
                  No manuscript files found in this project.
                </div>
              ) : (
                <div 
                  style={{
                    border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    borderRadius: '6px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}
                >
                  {state.files.map((file: any) => (
                    <div
                      key={file.id}
                      onClick={() => actions.selectManuscript(file)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = 
                          isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ fontSize: '14px', color: theme.text, marginBottom: '2px' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                        Manuscript file
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : state.selectedManuscript ? (
            /* Publishing Progress View */
            <div>
              {/* Selected File Info */}
              <div 
                style={{
                  padding: '12px',
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  borderRadius: '6px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: theme.text, marginBottom: '4px' }}>
                  Selected Manuscript:
                </div>
                <div style={{ fontSize: '13px', color: theme.textSecondary }}>
                  {state.selectedManuscript.name}
                </div>
              </div>

              {/* Progress Steps */}
              <div style={{ marginBottom: '20px' }}>
                {state.progress.steps.map((step, index) => {
                  const getFileState = () => {
                    if (step.id === 'html') return state.fileStates.html;
                    if (step.id === 'epub') return state.fileStates.epub;
                    if (step.id === 'pdf') return state.fileStates.pdf;
                    return undefined;
                  };
                  
                  const getOnAction = () => {
                    if (step.id === 'html') return () => actions.generateFile('html');
                    if (step.id === 'epub') return () => actions.generateFile('epub');
                    if (step.id === 'pdf') return () => actions.generateFile('pdf');
                    return undefined;
                  };

                  return (
                    <div key={step.id}>
                      <ProgressStep
                        step={step}
                        isActive={index === state.progress.currentStep}
                        theme={theme}
                        fileState={getFileState()}
                        onAction={getOnAction()}
                      />
                      {/* Show cover upload and bookstore checkbox after EPUB step */}
                      {step.id === 'epub' && (
                        <>
                          {/* Cover Image Upload Section */}
                          <div
                            style={{
                              padding: '12px',
                              marginLeft: '20px',
                              marginTop: '-10px',
                              marginBottom: '8px',
                              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'}`,
                              borderRadius: '6px',
                              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'
                            }}
                          >
                            <div style={{ fontSize: '13px', color: theme.text, marginBottom: '8px', fontWeight: 500 }}>
                              Cover Image (optional)
                            </div>

                            {/* Hidden file input */}
                            <input
                              ref={coverInputRef}
                              type="file"
                              accept=".jpg,.jpeg,.png"
                              onChange={handleCoverFileChange}
                              style={{ display: 'none' }}
                            />

                            {state.coverImage.previewUrl ? (
                              /* Show preview when image is selected */
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <img
                                  src={state.coverImage.previewUrl}
                                  alt="Cover preview"
                                  style={{
                                    width: '80px',
                                    height: 'auto',
                                    maxHeight: '120px',
                                    objectFit: 'contain',
                                    borderRadius: '4px',
                                    border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '4px' }}>
                                    {state.coverImage.width} x {state.coverImage.height} px
                                  </div>
                                  {state.coverImage.warning && (
                                    <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '8px' }}>
                                      ⚠️ {state.coverImage.warning}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => coverInputRef.current?.click()}
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '12px',
                                        borderRadius: '4px',
                                        border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                                        backgroundColor: 'transparent',
                                        color: theme.text,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Change
                                    </button>
                                    <button
                                      onClick={actions.clearCoverImage}
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '12px',
                                        borderRadius: '4px',
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
                              </div>
                            ) : state.coverImage.isProcessing ? (
                              /* Show loading state */
                              <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                                Processing image...
                              </div>
                            ) : (
                              /* Show upload button */
                              <button
                                onClick={() => coverInputRef.current?.click()}
                                style={{
                                  padding: '8px 16px',
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

                          {/* Bookstore Checkbox */}
                          <div
                            style={{
                              padding: '4px 4px',
                              marginLeft: '20px',
                              marginTop: '0',
                              marginBottom: '8px',
                              border: '1px solid #FF8C00',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer'
                            }}
                            onClick={actions.togglePublishToStore}
                          >
                            <input
                              type="checkbox"
                              checked={state.publishToStore}
                              onChange={() => actions.togglePublishToStore()}
                              onClick={(e) => e.stopPropagation()}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            <span style={{ fontSize: '13px', color: theme.text, cursor: 'pointer' }}>
                              List EPUB in Bookstore
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>


            </div>
          ) : (
            /* Loading State */
            <div 
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: theme.textSecondary
              }}
            >
              Loading manuscripts...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
