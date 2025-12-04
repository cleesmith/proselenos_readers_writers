// Files Modal Component
// Unified modal for uploading files and managing (download/delete) project files

'use client';

import { useRef, useState, useEffect } from 'react';
import { MdOutlineFileDownload, MdOutlineDelete } from 'react-icons/md';
import { ThemeConfig } from '../shared/theme';
import { showAlert, showConfirm } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import { listProjectFilesAction, downloadFileForBrowserAction, deleteProjectFileAction } from '@/lib/github-project-actions';
import { getPublicCatalog, removeFromPublicCatalog } from '@/app/actions/store-catalog';

interface FilesModalProps {
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

interface FileItem {
  id: string;
  name: string;
  path: string;
}

// Only allow these file extensions (keep in sync with upload validation)
const ALLOWED_EXTENSIONS = ['.txt', '.html', '.docx', '.epub', '.pdf'];

export default function FilesModal({
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
}: FilesModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasUploadingRef = useRef(false);

  // File list state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch files when modal opens
  useEffect(() => {
    if (isOpen && currentProject) {
      fetchFiles();
    }
  }, [isOpen, currentProject]);

  // Refresh file list when upload completes (isUploading: true -> false)
  useEffect(() => {
    if (wasUploadingRef.current && !isUploading && isOpen && currentProject) {
      // Upload just finished - refresh the file list
      fetchFiles();
    }
    wasUploadingRef.current = isUploading;
  }, [isUploading, isOpen, currentProject]);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedExtensions = ['.txt', '.html', '.docx', '.epub', '.pdf'];
      const fileName = file.name.toLowerCase();
      const isValidFile = allowedExtensions.some(ext => fileName.endsWith(ext));

      if (!isValidFile) {
        showAlert('Please select a .txt, .html, .docx, .epub, or .pdf file only.', 'warning', undefined, isDarkMode);
        return;
      }

      onFileSelect(file);
      onFileNameChange(file.name);
    }
  };

  const handleUploadClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
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

  const handleDelete = async (file: FileItem) => {
    if (!currentProject) return;

    // Check if this is a published epub
    let isPublishedEpub = false;
    if (file.name === 'manuscript.epub') {
      try {
        const catalogResult = await getPublicCatalog();
        if (catalogResult.success && catalogResult.data) {
          isPublishedEpub = catalogResult.data.some(e => e.projectId === currentProject);
        }
      } catch {
        // Ignore errors checking catalog
      }
    }

    // Show appropriate confirmation message
    const message = isPublishedEpub
      ? `Delete "${file.name}"?\n\nThis epub is published to the Public Ebooks store. Deleting will also remove it from the store.\n\nThis cannot be undone.`
      : `Delete "${file.name}"?\n\nThis cannot be undone.`;

    const confirmed = await showConfirm(
      message,
      isDarkMode,
      isPublishedEpub ? 'Delete Published Epub?' : 'Delete File?',
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;

    setDeletingFile(file.path);
    setError(null);

    try {
      const result = await deleteProjectFileAction(currentProject, file.path);

      if (result.success) {
        // Remove file from list
        setFiles(prev => prev.filter(f => f.path !== file.path));

        // If published epub, also remove from bookstore
        if (isPublishedEpub) {
          await removeFromPublicCatalog(currentProject);
          showAlert(`Deleted: ${file.name} (also removed from Public Ebooks)`, 'info', undefined, isDarkMode);
        } else {
          showAlert(`Deleted: ${file.name}`, 'info', undefined, isDarkMode);
        }
      } else {
        setError(result.error || 'Failed to delete file');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete file');
    } finally {
      setDeletingFile(null);
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
    >
      <div
        style={{
          backgroundColor: isDarkMode ? '#2c3035' : '#ffffff',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          borderRadius: '12px',
          padding: '0',
          maxWidth: '550px',
          width: '100%',
          minHeight: '500px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Modal Header - Close button always at top right */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <StyledSmallButton onClick={onClose} disabled={isUploading || deletingFile !== null} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Upload Controls Section */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            flexShrink: 0
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.html,.docx,.epub,.pdf,text/plain,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,application/pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={isUploading}
          />

          <StyledSmallButton onClick={handleUploadClick} disabled={isUploading} theme={theme}>
            Upload a file
          </StyledSmallButton>
          <span style={{ fontSize: '10px', color: theme.textMuted }}>
            .txt .html .docx .epub .pdf
          </span>

          {selectedUploadFile && (
            <>
              <span style={{ fontSize: '12px', color: theme.textMuted, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedUploadFile.name} ({Math.round(selectedUploadFile.size / 1024)}KB)
              </span>
              <input
                type="text"
                value={uploadFileName}
                onChange={(e) => onFileNameChange(e.target.value)}
                placeholder="Save as..."
                style={{
                  padding: '4px 8px',
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  fontSize: '12px',
                  width: '150px'
                }}
              />
              <StyledSmallButton onClick={onUpload} disabled={isUploading} theme={theme}>
                {isUploading ? 'Uploading...' : 'Upload'}
              </StyledSmallButton>
            </>
          )}
        </div>

        {/* File List Section */}
        <div
          style={{
            padding: '16px 20px',
            flex: 1,
            overflowY: 'auto',
            minHeight: 0
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
              No files found in this project.
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
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Download button */}
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={downloadingFile !== null || deletingFile !== null}
                      title="Download file"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: downloadingFile !== null || deletingFile !== null ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        opacity: downloadingFile !== null || deletingFile !== null ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <MdOutlineFileDownload
                        size={20}
                        style={{ color: downloadingFile === file.path ? '#22c55e' : (isDarkMode ? '#fff' : '#333') }}
                      />
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(file)}
                      disabled={downloadingFile !== null || deletingFile !== null}
                      title="Delete file"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: downloadingFile !== null || deletingFile !== null ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        opacity: downloadingFile !== null || deletingFile !== null ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <MdOutlineDelete
                        size={20}
                        style={{ color: deletingFile === file.path ? '#dc2626' : '#ef4444' }}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
