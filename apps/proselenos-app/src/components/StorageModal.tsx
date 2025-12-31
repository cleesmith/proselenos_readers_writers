'use client';

import { useEffect, useState } from 'react';
import StyledSmallButton from '@/components/StyledSmallButton';
import { ThemeConfig } from '../app/shared/theme';

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

  useEffect(() => {
    if (isOpen && navigator.storage && navigator.storage.estimate) {
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
              </div>
              <p style={{
                marginTop: '20px',
                fontSize: '12px',
                color: isDarkMode ? '#6b7280' : '#9ca3af',
                lineHeight: '1.5'
              }}>
                Storage is used by your ebook library and author manuscripts.
              </p>
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
