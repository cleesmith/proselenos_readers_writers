// Upload Modal Component
// Allows users to upload .docx or .txt files to their selected project

'use client';

import { useRef } from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';

interface UploadModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  currentProject: string | null;
  selectedUploadFile: File | null;
  uploadFileName: string;
  isUploading: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  onFileNameChange: (name: string) => void;
  onUpload: () => void;
}

export default function UploadModal({
  isOpen,
  theme,
  isDarkMode,
  currentProject,
  selectedUploadFile,
  uploadFileName,
  isUploading,
  onClose,
  onFileSelect,
  onFileNameChange,
  onUpload
}: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedExtensions = ['.txt', '.docx', '.epub', '.pdf'];
      const fileName = file.name.toLowerCase();
      const isValidFile = allowedExtensions.some(ext => fileName.endsWith(ext));

      if (!isValidFile) {
        showAlert('Please select a .txt, .docx, .epub, or .pdf file only.', 'warning', undefined, isDarkMode);
        return;
      }

      onFileSelect(file);
      onFileNameChange(file.name); // Set default filename
    }
  };

  const handleUploadClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '24px',
        width: '90%',
        maxWidth: '500px',
        color: theme.text
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            Upload File to Project
          </h3>
          <StyledSmallButton onClick={onClose} disabled={isUploading} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        <div style={{
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <strong>Project:</strong> {currentProject || 'No project selected'}
        </div>

        <div style={{
          marginBottom: '20px'
        }}>
          <p style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: theme.textMuted
          }}>
            Select a .txt, .docx, .epub, or .pdf file to upload to your project:
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx,.epub,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/epub+zip,application/pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={isUploading}
          />
          
          <StyledSmallButton onClick={handleUploadClick} disabled={isUploading} theme={theme}>
            {isUploading ? 'Uploading...' : 'Choose File'}
          </StyledSmallButton>
          
          {selectedUploadFile && (
            <div style={{ marginTop: '12px' }}>
              <span style={{
                fontSize: '14px',
                color: theme.textMuted,
                display: 'block',
                marginBottom: '8px'
              }}>
                Selected: {selectedUploadFile.name} ({Math.round(selectedUploadFile.size / 1024)}KB)
              </span>

              <div style={{ marginTop: '12px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  color: theme.text,
                  marginBottom: '6px'
                }}>
                  Save as (optional):
                </label>
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => onFileNameChange(e.target.value)}
                  placeholder="Enter filename..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <StyledSmallButton onClick={onClose} disabled={isUploading} theme={theme}>
            Cancel
          </StyledSmallButton>
          
          <StyledSmallButton onClick={onUpload} disabled={!selectedUploadFile || isUploading} theme={theme}>
            {isUploading ? 'Uploading...' : 'Upload'}
          </StyledSmallButton>
        </div>
      </div>
    </div>
  );
}
