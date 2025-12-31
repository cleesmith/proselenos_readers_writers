// Local DOCX Import Modal Component
// Allows users to select a local .docx file, convert to plain text,
// and save the .txt result to their project storage (original .docx is not stored)

'use client';

import { useRef, useState } from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import { convertDocxToManuscript } from '@/lib/docx-formatting-utils';
import { saveManuscript } from '@/services/manuscriptStorage';

interface LocalDocxImportModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  onClose: () => void;
  onConversionComplete: () => void;
  setUploadStatus: (status: string) => void;
}

export default function LocalDocxImportModal({
  isOpen,
  theme,
  isDarkMode,
  onClose,
  onConversionComplete,
  setUploadStatus
}: LocalDocxImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.docx')) {
        showAlert('Please select a .docx file only.', 'warning', undefined, isDarkMode);
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleChooseFile = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  };

  const handleConvert = async () => {
    if (!selectedFile) {
      showAlert('Please select a file first', 'error', undefined, isDarkMode);
      return;
    }

    setIsConverting(true);
    setUploadStatus('Converting DOCX to manuscript.txt...');

    try {
      // Convert DOCX to manuscript-formatted text (client-side)
      const arrayBuffer = await selectedFile.arrayBuffer();
      const content = await convertDocxToManuscript(arrayBuffer);

      // Save to IndexedDB as manuscript.txt
      setUploadStatus('Saving manuscript.txt...');
      await saveManuscript(content);

      setUploadStatus('✅ Converted and saved as manuscript.txt');

      showAlert(
        'Conversion complete!\n\nSaved as: manuscript.txt',
        'success',
        'DOCX Conversion Complete',
        isDarkMode
      );

      onConversionComplete();

      // Clean up and close
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setUploadStatus(`❌ Conversion failed: ${errorMsg}`);
      showAlert(`Conversion error: ${errorMsg}`, 'error', undefined, isDarkMode);
    } finally {
      setIsConverting(false);
    }
  };

  const converting = isConverting;

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
            Import DOCX File
          </h3>
          <StyledSmallButton onClick={onClose} disabled={converting} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        <div style={{
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: isDarkMode ? 'rgba(100, 150, 255, 0.1)' : 'rgba(66, 133, 244, 0.1)',
          borderRadius: '4px',
          fontSize: '13px',
          color: theme.text,
          border: `1px solid ${isDarkMode ? 'rgba(100, 150, 255, 0.3)' : 'rgba(66, 133, 244, 0.3)'}`
        }}>
          💡 <strong>How it works:</strong> Select a .docx file from your computer. It will be converted to manuscript-formatted plain text and saved as <strong>manuscript.txt</strong>. The original .docx is not stored.
        </div>

        <div style={{
          marginBottom: '20px'
        }}>
          <p style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: theme.textMuted
          }}>
            Select a .docx file from your computer:
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={converting}
          />

          <StyledSmallButton onClick={handleChooseFile} disabled={converting} theme={theme}>
            {converting ? 'Converting...' : 'Choose File'}
          </StyledSmallButton>

          {selectedFile && (
            <div style={{ marginTop: '12px' }}>
              <div style={{
                padding: '8px',
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                borderRadius: '4px',
                fontSize: '14px',
                color: theme.text
              }}>
                <strong>Selected:</strong> {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <StyledSmallButton onClick={onClose} disabled={converting} theme={theme}>
            Cancel
          </StyledSmallButton>

          <StyledSmallButton onClick={handleConvert} disabled={!selectedFile || converting} theme={theme}>
            {converting ? 'Converting...' : 'Convert'}
          </StyledSmallButton>
        </div>
      </div>
    </div>
  );
}
