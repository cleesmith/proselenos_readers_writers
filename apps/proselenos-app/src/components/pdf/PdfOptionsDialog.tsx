'use client';

import React, { useEffect, useState } from 'react';

export interface PdfContentOptions {
  includeToc: boolean;
  includeChapterHeadings: boolean;
}

interface PdfOptionsDialogProps {
  isOpen: boolean;
  formatLabel: string;   // e.g. "6x9 inch PDF (KDP)"
  onCancel: () => void;
  onCreate: (options: PdfContentOptions) => void;
}

const PdfOptionsDialog: React.FC<PdfOptionsDialogProps> = ({
  isOpen,
  formatLabel,
  onCancel,
  onCreate,
}) => {
  const [includeToc, setIncludeToc] = useState(false);
  const [includeChapterHeadings, setIncludeChapterHeadings] = useState(false);

  // Both options start unchecked every time the dialog opens
  useEffect(() => {
    if (isOpen) {
      setIncludeToc(false);
      setIncludeChapterHeadings(false);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/50'>
      <div className='bg-base-100 w-full max-w-sm rounded-lg p-6 shadow-xl'>
        <h3 className='text-base-content text-lg font-semibold'>PDF Options</h3>
        <p className='text-base-content/60 mb-5 text-sm'>{formatLabel}</p>

        <label className='mb-3 flex cursor-pointer items-center gap-3'>
          <input
            type='checkbox'
            className='checkbox checkbox-sm'
            checked={includeToc}
            onChange={(e) => setIncludeToc(e.target.checked)}
          />
          <span className='text-base-content text-sm'>Include Table of Contents</span>
        </label>

        <label className='mb-6 flex cursor-pointer items-center gap-3'>
          <input
            type='checkbox'
            className='checkbox checkbox-sm'
            checked={includeChapterHeadings}
            onChange={(e) => setIncludeChapterHeadings(e.target.checked)}
          />
          <span className='text-base-content text-sm'>Include Chapter Headings</span>
        </label>

        <div className='flex justify-end gap-2'>
          <button className='btn btn-ghost btn-sm' onClick={onCancel}>
            Cancel
          </button>
          <button
            className='btn btn-primary btn-sm'
            onClick={() => onCreate({ includeToc, includeChapterHeadings })}
          >
            Create PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfOptionsDialog;
