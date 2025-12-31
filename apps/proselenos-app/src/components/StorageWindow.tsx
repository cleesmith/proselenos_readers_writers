'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import Dialog from './Dialog';

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
          setError(_('Unable to retrieve storage information'));
        });
    }
  }, [isOpen, _]);

  const handleClose = () => {
    // Blur any focused element before closing to avoid aria-hidden warning
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsOpen(false);
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
              </div>
              <p className='text-xs text-neutral-content mt-2'>
                {_('Storage is used by your ebook library and author manuscripts.')}
              </p>
            </>
          ) : (
            <p className='text-neutral-content'>{_('Loading storage information...')}</p>
          )}
        </div>
      )}
    </Dialog>
  );
};
