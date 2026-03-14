'use client';

import React, { useEffect, useState, useRef } from 'react';
import JSZip from 'jszip';
import { pdf } from '@react-pdf/renderer';
import { Book } from '@/types/book';
import { BookMetadata } from '@/libs/document';
import { getLocalBookFilename } from '@/utils/book';
import { useEnv } from '@/context/EnvContext';
import {
  getSpineItems,
  extractChapters,
  extractCopyrightHtml,
  BookDocument,
  resetElementKeyCounter,
  type PdfOptions,
} from '@/lib/epub-to-pdf';

interface PdfModalProps {
  book: Book;
  bookMeta: BookMetadata | null;
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'loading' | 'done' | 'error';

interface Progress {
  message: string;
  percent: number;
}

const PdfModal: React.FC<PdfModalProps> = ({ book, bookMeta, isOpen, onClose }) => {
  const { envConfig } = useEnv();
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState<Progress>({ message: 'Preparing...', percent: 0 });
  const [error, setError] = useState<string>('');
  const cancelledRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      setPhase('loading');
      setProgress({ message: 'Preparing...', percent: 0 });
      setError('');
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

        setProgress({ message: 'Parsing epub...', percent: 10 });
        const zip = await JSZip.loadAsync(arrayBuffer);

        if (cancelledRef.current) return;

        setProgress({ message: 'Reading spine order...', percent: 20 });
        const spinePaths = await getSpineItems(zip);

        if (cancelledRef.current) return;

        setProgress({ message: 'Extracting chapters...', percent: 30 });
        const chapters = await extractChapters(zip, spinePaths);

        if (chapters.length === 0) {
          throw new Error('No chapter content found in epub');
        }

        if (cancelledRef.current) return;

        setProgress({ message: 'Extracting copyright...', percent: 40 });
        const copyrightHtml = await extractCopyrightHtml(zip, spinePaths);

        if (cancelledRef.current) return;

        setProgress({ message: 'Laying out pages...', percent: 50 });

        resetElementKeyCounter();
        const options: PdfOptions = {
          title: book.title || 'Untitled',
          author: book.author || 'Unknown',
          publisher: bookMeta?.publisher || undefined,
          copyrightHtml: copyrightHtml ?? undefined,
        };

        const blob = await pdf(<BookDocument chapters={chapters} options={options} />).toBlob();

        if (cancelledRef.current) return;

        setProgress({ message: 'Opening PDF...', percent: 95 });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');

        setPhase('done');

        // Auto-close after a brief delay
        setTimeout(() => {
          if (!cancelledRef.current) {
            onCloseRef.current();
          }
        }, 800);
      } catch (err) {
        if (cancelledRef.current) return;
        console.error('PDF generation failed:', err);
        setError(err instanceof Error ? err.message : 'PDF generation failed');
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
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

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
          <p className='text-error font-semibold mb-2'>PDF Generation Failed</p>
          <p className='text-base-content/60 text-sm mb-4'>{error}</p>
          <button className='btn btn-ghost btn-sm' onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // Loading / done state
  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-base-100'>
      <div className='text-center max-w-sm px-4'>
        {/* PDF icon */}
        <div className='mb-4'>
          <svg className='mx-auto text-red-500' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
            <polyline points='14 2 14 8 20 8' />
            <line x1='16' y1='13' x2='8' y2='13' />
            <line x1='16' y1='17' x2='8' y2='17' />
            <polyline points='10 9 9 9 8 9' />
          </svg>
        </div>

        <h3 className='text-base-content font-semibold text-lg mb-2'>Building PDF</h3>
        <p className='text-base-content/60 text-sm mb-4'>{progress.message}</p>

        {/* Progress bar */}
        <div className='w-full h-1.5 bg-base-300 rounded-full overflow-hidden mb-2'>
          <div
            className='h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full'
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

export default PdfModal;
