'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { useTheme } from '@/hooks/useTheme';
import { BookstoreEntry } from '@/app/actions/publish-actions';
import StoreBookItem from './StoreBookItem';

interface StoreContentProps {
  entries: BookstoreEntry[];
}

export default function StoreContent({ entries }: StoreContentProps) {
  const router = useRouter();
  const { isDarkMode } = useThemeStore();

  // Initialize theme
  useTheme({ systemUIVisible: true, appThemeColor: 'base-200' });

  const handleBack = () => {
    router.push('/library');
  };

  return (
    <div
      className={clsx(
        'text-base-content flex h-[100vh] select-none flex-col overflow-hidden',
        isDarkMode ? 'bg-base-200' : 'bg-base-100'
      )}
    >
      {/* Header */}
      <div
        className={clsx(
          'flex items-center justify-between px-4 py-3',
          'border-b border-base-300'
        )}
      >
        <button
          onClick={handleBack}
          className='btn btn-ghost btn-sm'
        >
          ← Your Local Library
        </button>
        <h1 className='text-lg font-bold'>Proselenos Ebooks</h1>
        <div className='w-16' /> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4'>
        {entries.length === 0 ? (
          <div className='flex h-full items-center justify-center'>
            <p className='text-base-content/60'>No ebooks available yet.</p>
          </div>
        ) : (
          <div
            className={clsx(
              'grid grid-cols-3 gap-x-4 px-4 sm:gap-x-0 sm:px-2',
              'sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-12'
            )}
          >
            {entries.map((entry) => (
              <StoreBookItem key={entry.projectId} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
