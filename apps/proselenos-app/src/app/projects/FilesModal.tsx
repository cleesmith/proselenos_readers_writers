// Files Modal Component
// Local-first: Upload/download/delete files from IndexedDB (ProselenosLocal)

'use client';

import { useRef, useState, useEffect } from 'react';
import { MdOutlineFileDownload, MdOutlineDelete } from 'react-icons/md';
import { ThemeConfig } from '../shared/theme';
import { showAlert, showConfirm } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import {
  listFiles,
  loadManuscript,
  saveManuscript,
  loadReport,
  loadEpub,
  saveEpub,
  loadDocx,
  saveDocx,
  deleteManuscript,
  deleteReport,
  deleteEpub,
  deleteDocx,
  loadChatFile,
  deleteChatFile,
  FileInfo
} from '@/services/manuscriptStorage';

interface FilesModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  onClose: () => void;
}

export default function FilesModal({
  isOpen,
  theme,
  isDarkMode,
  onClose
}: FilesModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File list state
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch files when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen]);

  const fetchFiles = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fileList = await listFiles();
      // Only show files that exist
      setFiles(fileList.filter(f => f.exists));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isTxt = fileName.endsWith('.txt');
    const isEpub = fileName.endsWith('.epub');
    const isDocx = fileName.endsWith('.docx');

    if (!isTxt && !isEpub && !isDocx) {
      showAlert('Please select a .txt, .epub, or .docx file only.', 'warning', undefined, isDarkMode);
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      if (isTxt) {
        // Read as text and save as manuscript.txt
        const content = await file.text();
        await saveManuscript(content);
        showAlert('Imported as manuscript.txt', 'success', undefined, isDarkMode);
      } else if (isEpub) {
        // Read as ArrayBuffer and save as manuscript.epub
        const buffer = await file.arrayBuffer();
        await saveEpub(buffer);
        showAlert('Imported as manuscript.epub', 'success', undefined, isDarkMode);
      } else if (isDocx) {
        // Read as ArrayBuffer and save as manuscript.docx
        const buffer = await file.arrayBuffer();
        await saveDocx(buffer);
        showAlert('Imported as manuscript.docx', 'success', undefined, isDarkMode);
      }

      // Refresh file list
      await fetchFiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  };

  const handleDownload = async (file: FileInfo) => {
    setDownloadingFile(file.key);
    setError(null);

    try {
      let content: string | ArrayBuffer | null = null;
      let mimeType = 'application/octet-stream';

      // Handle chat files (any .txt in AI store except report.txt)
      if (file.store === 'ai' && file.key !== 'report.txt') {
        content = await loadChatFile(file.key);
        mimeType = 'text/plain';
      } else {
        switch (file.key) {
          case 'manuscript.txt':
            content = await loadManuscript();
            mimeType = 'text/plain';
            break;
          case 'report.txt':
            content = await loadReport();
            mimeType = 'text/plain';
            break;
          case 'manuscript.epub':
            content = await loadEpub();
            mimeType = 'application/epub+zip';
            break;
          case 'manuscript.docx':
            content = await loadDocx();
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;
        }
      }

      if (content === null) {
        setError('File not found');
        return;
      }

      // Create blob and trigger download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    const confirmed = await showConfirm(
      `Delete "${file.name}"?\n\nThis cannot be undone.`,
      isDarkMode,
      'Delete File?',
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;

    setDeletingFile(file.key);
    setError(null);

    try {
      // Handle chat files (any file in AI store except report.txt)
      if (file.store === 'ai' && file.key !== 'report.txt') {
        await deleteChatFile(file.key);
      } else {
        switch (file.key) {
          case 'manuscript.txt':
            await deleteManuscript();
            break;
          case 'report.txt':
            await deleteReport();
            break;
          case 'manuscript.epub':
            await deleteEpub();
            break;
          case 'manuscript.docx':
            await deleteDocx();
            break;
        }
      }

      // Refresh file list
      await fetchFiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
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
          maxWidth: '450px',
          width: '100%',
          minHeight: '350px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.text }}>
            Manuscript Files
          </span>
          <StyledSmallButton onClick={onClose} disabled={isImporting || deletingFile !== null} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Import Section */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.epub,.docx"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={isImporting}
          />

          <StyledSmallButton onClick={handleSelectClick} disabled={isImporting} theme={theme}>
            {isImporting ? 'Importing...' : 'Import a file'}
          </StyledSmallButton>
          <span style={{ fontSize: '10px', color: theme.textMuted }}>
            .txt .epub .docx
          </span>
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
              No files yet. Import a .txt file to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {files.map((file) => (
                <div
                  key={file.key}
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
                        style={{ color: downloadingFile === file.key ? '#22c55e' : (isDarkMode ? '#fff' : '#333') }}
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
                        style={{ color: deletingFile === file.key ? '#dc2626' : '#ef4444' }}
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
