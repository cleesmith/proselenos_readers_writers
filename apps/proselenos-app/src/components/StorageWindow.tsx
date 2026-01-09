'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import Dialog from './Dialog';
import { exportAndDownload, pickAndValidateBackup, performImport } from '@/services/dataExportService';
import { showAlert, showConfirm } from '@/app/shared/alerts';

export const setStorageDialogVisible = (visible: boolean) => {
  const dialog = document.getElementById('storage_window');
  if (dialog) {
    const event = new CustomEvent('setDialogVisibility', {
      detail: { visible },
    });
    dialog.dispatchEvent(event);
  }
};

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

export const StorageWindow = () => {
  const _ = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent) => {
      setIsOpen(event.detail.visible);
    };

    const el = document.getElementById('storage_window');
    if (el) {
      el.addEventListener('setDialogVisibility', handleCustomEvent as EventListener);
    }

    return () => {
      if (el) {
        el.removeEventListener('setDialogVisibility', handleCustomEvent as EventListener);
      }
    };
  }, []);

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
            setError(_('Unable to retrieve storage information'));
          });
      }
      if (navigator.storage.persisted) {
        navigator.storage.persisted().then(setIsPersisted);
      }
    }
  }, [isOpen, _]);

  const handleClose = () => {
    // Blur any focused element before closing to avoid aria-hidden warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsOpen(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportAndDownload();
      showAlert(_('Your backup has been downloaded.'), 'success', _('Export Complete'));
    } catch (err) {
      console.error('Export failed:', err);
      showAlert(_('Export failed. Please try again.'), 'error');
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
        showAlert(_(result.error), 'error');
        setIsImporting(false);
        return;
      }

      // 2. Confirm with user
      const confirmed = await showConfirm(
        _('This will replace ALL existing data with the backup. Make sure you have exported your current data if you want to keep it.'),
        true,
        _('Import Backup?'),
        _('Yes, Import'),
        _('Cancel')
      );
      if (!confirmed) {
        setIsImporting(false);
        return;
      }

      // 3. Perform the import
      const importResult = await performImport(result.zip);
      if (!importResult.success) {
        showAlert(_(importResult.error || 'Import failed'), 'error');
        setIsImporting(false);
        return;
      }

      // 4. Success - show message and refresh
      showAlert(_('Import complete! The page will refresh to load your restored data.'), 'success', _('Success'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Import failed:', err);
      showAlert(_('Import failed. Please try again.'), 'error');
      setIsImporting(false);
    }
  };

  return (
    <Dialog
      id='storage_window'
      isOpen={isOpen}
      title={_('Storage')}
      onClose={handleClose}
      boxClassName='sm:!w-[400px] sm:!max-w-screen-sm sm:h-auto'
    >
      {isOpen && (
        <div className='storage-content flex h-full flex-col gap-4 p-4'>
          {error ? (
            <p className='text-red-500'>{error}</p>
          ) : storage ? (
            <>
              <div className='flex flex-col gap-3'>
                <div className='flex justify-between'>
                  <span className='text-neutral-content'>{_('Used')}</span>
                  <span className='font-semibold'>{formatBytes(storage.usage)}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-neutral-content'>{_('Available')}</span>
                  <span className='font-semibold'>{formatBytes(storage.available)}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-neutral-content'>{_('Protected')}</span>
                  <span className='font-semibold'>
                    {isPersisted === null ? '...' : isPersisted ? _('Yes') : _('No')}
                  </span>
                </div>
              </div>
              <p className='text-xs text-neutral-content mt-2'>
                {isPersisted
                  ? _('Your data is protected from automatic browser cleanup.')
                  : _('Your data may be cleared if the browser runs low on storage. Consider exporting important work.')}
              </p>
              <button
                onClick={handleExport}
                disabled={isExporting || isImporting}
                className='btn btn-primary btn-sm mt-4 w-full'
              >
                {isExporting ? _('Exporting...') : _('Export All Data')}
              </button>
              <button
                onClick={handleImport}
                disabled={isExporting || isImporting}
                className='btn btn-outline btn-sm mt-2 w-full'
              >
                {isImporting ? _('Importing...') : _('Import Data')}
              </button>
            </>
          ) : (
            <p className='text-neutral-content'>{_('Loading storage information...')}</p>
          )}
        </div>
      )}
    </Dialog>
  );
};
