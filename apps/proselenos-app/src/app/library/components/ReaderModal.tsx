'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useSettingsStore } from '@/store/settingsStore';
import Spinner from '@/components/Spinner';

// Dynamic import - reader code only loads when needed
// Once loaded, it's cached for offline use
const ReaderContent = dynamic(
  () => import('@/app/reader/components/ReaderContent'),
  {
    ssr: false,
    loading: () => (
      <div className='flex h-[100vh] items-center justify-center bg-base-100'>
        <Spinner loading />
      </div>
    )
  }
);

interface ReaderModalProps {
  bookHash: string | null;
  onClose: () => void;
}

const ReaderModal: React.FC<ReaderModalProps> = ({ bookHash, onClose }) => {
  const { settings } = useSettingsStore();

  // Don't render if no book selected
  if (!bookHash) return null;

  return (
    <div className='fixed inset-0 z-50 bg-base-100'>
      <ReaderContent
        ids={bookHash}
        settings={settings}
        onClose={onClose}
      />
    </div>
  );
};

export default ReaderModal;
