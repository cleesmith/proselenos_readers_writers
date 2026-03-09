'use client';

import React, { useEffect, useState, useRef } from 'react';
import JSZip from 'jszip';
import { Book } from '@/types/book';
import { getLocalBookFilename } from '@/utils/book';
import { useEnv } from '@/context/EnvContext';
import { analyzeEpub, buildM4B, type BuildProgress } from './audiobookService';
import AudiobookPlayer from './AudiobookPlayer';

interface AudiobookModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'loading' | 'ready' | 'error';

const AudiobookModal: React.FC<AudiobookModalProps> = ({ book, isOpen, onClose }) => {
  const { envConfig } = useEnv();
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState<BuildProgress>({ message: 'Preparing...', percent: 0 });
  const [error, setError] = useState<string>('');
  const [m4bData, setM4bData] = useState<Uint8Array | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setPhase('loading');
      setProgress({ message: 'Preparing...', percent: 0 });
      setError('');
      setM4bData(null);
      cancelledRef.current = false;
      return;
    }

    cancelledRef.current = false;

    const run = async () => {
      try {
        setPhase('loading');
        setProgress({ message: 'Loading epub...', percent: 2 });

        const appService = await envConfig.getAppService();
        const epubFilename = getLocalBookFilename(book);
        const epubFile = await appService.openFile(epubFilename, 'Books');
        const arrayBuffer = await epubFile.arrayBuffer();

        if (cancelledRef.current) return;

        setProgress({ message: 'Parsing epub...', percent: 5 });
        const zip = await JSZip.loadAsync(arrayBuffer);

        if (cancelledRef.current) return;

        setProgress({ message: 'Analyzing audio structure...', percent: 8 });
        const analysis = await analyzeEpub(zip);

        if (cancelledRef.current) return;

        const result = await buildM4B(zip, analysis, (p) => {
          if (!cancelledRef.current) setProgress(p);
        });

        if (cancelledRef.current) return;

        setM4bData(result);
        setPhase('ready');
      } catch (err) {
        if (cancelledRef.current) return;
        console.error('Audiobook build failed:', err);
        setError(err instanceof Error ? err.message : 'Build failed');
        setPhase('error');
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
    };
  }, [isOpen, book, envConfig]);

  // Escape key
  useEffect(() => {
    if (!isOpen || phase === 'ready') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, phase, onClose]);

  if (!isOpen) return null;

  // Ready — show the player
  if (phase === 'ready' && m4bData) {
    return (
      <AudiobookPlayer
        m4bData={m4bData}
        bookTitle={book.title}
        onClose={onClose}
      />
    );
  }

  // Error state
  if (phase === 'error') {
    return (
      <div className='fixed inset-0 z-[60] flex items-center justify-center bg-base-100'>
        <div className='text-center max-w-sm px-4'>
          <div className='text-4xl mb-4'>
            <svg className='mx-auto' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
              <circle cx='12' cy='12' r='10' className='stroke-error' />
              <line x1='15' y1='9' x2='9' y2='15' className='stroke-error' />
              <line x1='9' y1='9' x2='15' y2='15' className='stroke-error' />
            </svg>
          </div>
          <p className='text-error font-semibold mb-2'>Audiobook Build Failed</p>
          <p className='text-base-content/60 text-sm mb-4'>{error}</p>
          <button className='btn btn-ghost btn-sm' onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-base-100'>
      <div className='text-center max-w-sm px-4'>
        {/* Headphones icon */}
        <div className='mb-4'>
          <svg className='mx-auto text-amber-500' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M3 18v-6a9 9 0 0 1 18 0v6' />
            <path d='M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z' />
          </svg>
        </div>

        <h3 className='text-base-content font-semibold text-lg mb-2'>Building Audiobook</h3>
        <p className='text-base-content/60 text-sm mb-4'>{progress.message}</p>

        {/* Progress bar */}
        <div className='w-full h-1.5 bg-base-300 rounded-full overflow-hidden mb-2'>
          <div
            className='h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full'
            style={{ width: `${progress.percent}%`, transition: 'width 0.3s' }}
          />
        </div>
        <p className='text-base-content/40 text-xs font-mono mb-6'>{progress.percent}%</p>

        <button
          className='btn btn-ghost btn-sm'
          onClick={() => {
            cancelledRef.current = true;
            onClose();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AudiobookModal;
