// Download File Modal
// Modal for downloading files from the current project

'use client';

import { useState, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import { listProjectFilesAction, downloadFileForBrowserAction } from '@/lib/github-project-actions';
import StyledSmallButton from '@/components/StyledSmallButton';

interface DownloadFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: string | null;
  theme: ThemeConfig;
  isDarkMode: boolean;
}

interface FileItem {
  id: string;
  name: string;
  path: string;
}

// Only allow these file extensions
const ALLOWED_EXTENSIONS = ['.txt', '.html', '.docx', '.epub', '.pdf'];

export default function DownloadFileModal({
  isOpen,
  onClose,
  currentProject,
  theme,
  isDarkMode
}: DownloadFileModalProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch files when modal opens
  useEffect(() => {
    if (isOpen && currentProject) {
      fetchFiles();
    }
  }, [isOpen, currentProject]);

  const fetchFiles = async () => {
    if (!currentProject) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await listProjectFilesAction(currentProject);
      if (result.success && result.data?.files) {
        // Filter to only allowed extensions
        const filteredFiles = result.data.files.filter((file: FileItem) => {
          const lowerName = file.name.toLowerCase();
          return ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
        });
        setFiles(filteredFiles);
      } else {
        setError(result.error || 'Failed to load files');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (file: FileItem) => {
    if (!currentProject) return;

    setDownloadingFile(file.path);
    setError(null);

    try {
      const result = await downloadFileForBrowserAction(currentProject, file.path);

      if (result.success && result.data) {
        // Decode base64 to binary
        const binaryString = atob(result.data.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create blob and trigger download
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError(result.error || 'Failed to download file');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download file');
    } finally {
      setDownloadingFile(null);
    }
  };

  if (!isOpen) return null;

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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: isDarkMode ? '#2c3035' : '#ffffff',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          borderRadius: '12px',
          padding: '0',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              margin: 0,
              color: theme.text
            }}
          >
            Download File
          </h3>
          <StyledSmallButton onClick={onClose} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Modal Content */}
        <div
          style={{
            padding: '16px 20px',
            maxHeight: 'calc(80vh - 80px)',
            overflowY: 'auto'
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px',
                marginBottom: '12px',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                border: '1px solid rgba(220, 53, 69, 0.3)',
                borderRadius: '6px',
                color: '#dc3545',
                fontSize: '12px'
              }}
            >
              {error}
            </div>
          )}

          {isLoading ? (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                color: theme.textSecondary,
                fontSize: '13px'
              }}
            >
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                color: theme.textSecondary,
                fontSize: '13px'
              }}
            >
              No downloadable files found in this project.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {files.map((file) => (
                <div
                  key={file.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderRadius: '6px',
                    border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      color: theme.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      marginRight: '12px'
                    }}
                  >
                    {file.name}
                  </span>
                  <StyledSmallButton
                    onClick={() => handleDownload(file)}
                    disabled={downloadingFile !== null}
                    theme={theme}
                    styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '22px' }}
                  >
                    {downloadingFile === file.path ? 'Downloading...' : 'Download'}
                  </StyledSmallButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
