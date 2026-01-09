'use client';

import { useEffect, useState } from 'react';
import StyledSmallButton from '@/components/StyledSmallButton';
import { ThemeConfig } from '../app/shared/theme';
import { exportAndDownload, pickAndValidateBackup, performImport } from '@/services/dataExportService';
import { showAlert, showConfirm } from '@/app/shared/alerts';

interface StorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  theme: ThemeConfig;
}

interface StorageEstimate {
  usage: number;
  quota: number;
  available: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function StorageModal({
  isOpen,
  onClose,
  isDarkMode,
  theme
}: StorageModalProps) {
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportAndDownload();
      showAlert('Your backup has been downloaded.', 'success', 'Export Complete', isDarkMode);
    } catch (err) {
      console.error('Export failed:', err);
      showAlert('Export failed. Please try again.', 'error', undefined, isDarkMode);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      // 1. Pick and validate the file
      const result = await pickAndValidateBackup();
      if (!result) {
        // User cancelled file picker
        setIsImporting(false);
        return;
      }
      if ('error' in result) {
        showAlert(result.error, 'error', undefined, isDarkMode);
        setIsImporting(false);
        return;
      }

      // 2. Confirm with user
      const confirmed = await showConfirm(
        'This will replace ALL existing data with the backup. Make sure you have exported your current data if you want to keep it.',
        isDarkMode,
        'Import Backup?',
        'Yes, Import',
        'Cancel'
      );
      if (!confirmed) {
        setIsImporting(false);
        return;
      }

      // 3. Perform the import
      const importResult = await performImport(result.zip);
      if (!importResult.success) {
        showAlert(importResult.error || 'Import failed', 'error', undefined, isDarkMode);
        setIsImporting(false);
        return;
      }

      // 4. Success - show message and refresh
      showAlert('Import complete! The page will refresh to load your restored data.', 'success', 'Success', isDarkMode);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Import failed:', err);
      showAlert('Import failed. Please try again.', 'error', undefined, isDarkMode);
      setIsImporting(false);
    }
  };

  useEffect(() => {
    if (isOpen && navigator.storage) {
      if (navigator.storage.estimate) {
        navigator.storage.estimate()
          .then((estimate) => {
            const usage = estimate.usage || 0;
            const quota = estimate.quota || 0;
            setStorage({
              usage,
              quota,
              available: quota - usage
            });
            setError(null);
          })
          .catch((err) => {
            console.error('Failed to get storage estimate:', err);
            setError('Unable to retrieve storage information');
          });
      }
      if (navigator.storage.persisted) {
        navigator.storage.persisted().then(setIsPersisted);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
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
    }}>
      <div style={{
        background: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#333',
        borderRadius: '12px',
        maxWidth: '400px',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600'
          }}>
            Storage
          </h2>
          <StyledSmallButton onClick={onClose} theme={theme}>
            Close
          </StyledSmallButton>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {error ? (
            <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
          ) : storage ? (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Used</span>
                  <span style={{ fontWeight: '600' }}>{formatBytes(storage.usage)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Available</span>
                  <span style={{ fontWeight: '600' }}>{formatBytes(storage.available)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Protected</span>
                  <span style={{ fontWeight: '600' }}>
                    {isPersisted === null ? '...' : isPersisted ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              <p style={{
                marginTop: '20px',
                fontSize: '12px',
                color: isDarkMode ? '#6b7280' : '#9ca3af',
                lineHeight: '1.5'
              }}>
                {isPersisted
                  ? 'Your data is protected from automatic browser cleanup.'
                  : 'Your data may be cleared if the browser runs low on storage. Consider exporting important work.'}
              </p>
              <button
                onClick={handleExport}
                disabled={isExporting || isImporting}
                style={{
                  marginTop: '20px',
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: (isExporting || isImporting) ? 'not-allowed' : 'pointer',
                  opacity: (isExporting || isImporting) ? 0.7 : 1,
                }}
              >
                {isExporting ? 'Exporting...' : 'Export All Data'}
              </button>
              <button
                onClick={handleImport}
                disabled={isExporting || isImporting}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  color: isDarkMode ? '#9ca3af' : '#6b7280',
                  border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: (isExporting || isImporting) ? 'not-allowed' : 'pointer',
                  opacity: (isExporting || isImporting) ? 0.7 : 1,
                }}
              >
                {isImporting ? 'Importing...' : 'Import Data'}
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
              Loading storage information...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
