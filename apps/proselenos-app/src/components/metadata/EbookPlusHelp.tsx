import React from 'react';
import {
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineFileDownload,
  MdOutlineHeadphones,
  MdOutlineLanguage,
  MdOutlinePictureAsPdf,
  MdOutlineStorefront,
  MdPictureAsPdf,
} from 'react-icons/md';
import { GiBoxUnpacking } from 'react-icons/gi';

import Dialog from '@/components/Dialog';
import { useTranslation } from '@/hooks/useTranslation';

interface EbookPlusHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpItem {
  icon: React.ReactNode;
  name: string;
  description: string;
}

const ICON_SIZE = 18;

const topRowItems: HelpItem[] = [
  {
    icon: <MdOutlineEdit size={ICON_SIZE} className="fill-blue-500" />,
    name: 'Edit Ebook Metadata',
    description: "Update your book's title, author, publisher, description, and other details.",
  },
  {
    icon: <MdOutlineDelete size={ICON_SIZE} className="fill-red-500" />,
    name: 'Remove ebook',
    description: "Remove the book from your library. You'll be asked to confirm first.",
  },
  {
    icon: <MdOutlineFileDownload size={ICON_SIZE} className="fill-green-500" />,
    name: 'Download authors epub',
    description: 'Save a copy of your EPUB file to your device.',
  },
  {
    icon: <MdOutlineStorefront size={ICON_SIZE} className="fill-orange-500" />,
    name: 'Download for booksellers (EPUBCheck-clean)',
    description: 'Download a clean EPUB with Scenecraft data stripped out, ready for Amazon KDP and other booksellers.',
  },
  {
    icon: <GiBoxUnpacking size={ICON_SIZE} className="fill-purple-500" />,
    name: 'X-ray: View epub structure',
    description: 'Peek inside your EPUB to see all the files — chapters, images, stylesheets, and more.',
  },
];

const bottomRowItems: HelpItem[] = [
  {
    icon: <MdOutlineLanguage size={ICON_SIZE} className="fill-teal-500" />,
    name: 'Download web ready (zip)',
    description: 'Download your book formatted for web reading, with Scenecraft styling and audio.',
  },
  {
    icon: <MdPictureAsPdf size={ICON_SIZE} className="fill-red-400" />,
    name: 'Download 5x8 inch PDF (KDP)',
    description: 'Generate a 5×8 inch print PDF for Amazon KDP. The most popular small paperback size.',
  },
  {
    icon: <MdOutlinePictureAsPdf size={ICON_SIZE} className="fill-red-500" />,
    name: 'Download 6x9 inch PDF (KDP)',
    description: 'Generate a 6×9 inch print PDF for Amazon KDP. Uses embedded EB Garamond fonts.',
  },
  {
    icon: <MdPictureAsPdf size={ICON_SIZE} className="fill-red-700" />,
    name: 'Download 8.5x8.5 inch PDF (KDP square)',
    description: 'Generate an 8.5×8.5 inch square print PDF for Amazon KDP. Suited for illustrated works and photo books.',
  },
  {
    icon: <MdOutlineHeadphones size={ICON_SIZE} className="fill-amber-500" />,
    name: 'Audiobook: Build and play',
    description: "Play back your book's Scenecraft audio files if they exist in the EPUB.",
  },
];

const HelpSection: React.FC<{ label: string; items: HelpItem[] }> = ({ label, items }) => (
  <div className="mb-3">
    <div className="text-neutral-content mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
      {label}
    </div>
    <div className="divide-base-300 divide-y rounded-lg border border-base-300">
      {items.map((item) => (
        <div key={item.name} className="flex items-start gap-3 px-3 py-2">
          <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">{item.name}</div>
            <div className="text-neutral-content text-xs leading-snug">{item.description}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const EbookPlusHelp: React.FC<EbookPlusHelpProps> = ({ isOpen, onClose }) => {
  const _ = useTranslation();

  return (
    <Dialog
      title={_('Ebook Plus — Icon Guide')}
      isOpen={isOpen}
      onClose={onClose}
      boxClassName="sm:min-w-[420px] sm:max-w-[420px] sm:h-auto sm:max-h-[80%]"
      contentClassName="!px-4 !py-2"
    >
      <HelpSection label="Top row - EPUB related" items={topRowItems} />
      <HelpSection label="Bottom row - Plus: web, pdf, audiobook" items={bottomRowItems} />
    </Dialog>
  );
};

export default EbookPlusHelp;
