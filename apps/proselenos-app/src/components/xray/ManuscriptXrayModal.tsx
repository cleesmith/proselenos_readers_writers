import React, { useState, useEffect, useCallback } from 'react';
import { GiBoxUnpacking } from 'react-icons/gi';
import { ManuscriptXrayEntry, loadManuscriptXrayEntries } from '@/services/manuscriptStorage';
import { ContentResult } from '@/services/xrayService';
import ManuscriptXrayFileList from './ManuscriptXrayFileList';
import XrayContentViewer from './XrayContentViewer';

interface ManuscriptXrayModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookTitle?: string;
}

const ManuscriptXrayModal: React.FC<ManuscriptXrayModalProps> = ({
  isOpen,
  onClose,
  bookTitle,
}) => {
  const [entries, setEntries] = useState<ManuscriptXrayEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load entries when modal opens
  useEffect(() => {
    if (!isOpen) {
      setEntries([]);
      setSelectedKey(null);
      setIsLoading(true);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const result = await loadManuscriptXrayEntries();
        setEntries(result);
      } catch (err) {
        console.error('Failed to load manuscript xray entries:', err);
        setEntries([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build ContentResult for selected entry
  const selectedEntry = entries.find((e) => e.key === selectedKey) || null;
  const content: ContentResult | null = selectedEntry
    ? { type: 'text', content: selectedEntry.content, size: selectedEntry.size }
    : null;

  const handleSelectEntry = useCallback((key: string) => {
    setSelectedKey(key);
  }, []);

  if (!isOpen) return null;

  const displayTitle = bookTitle || 'Manuscript';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-base-100">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GiBoxUnpacking size={20} className="text-purple-500" />
          <h1 className="text-base font-semibold text-base-content line-clamp-1">
            {displayTitle} - X-Ray
          </h1>
          <span className="text-xs text-base-content/50">
            ({entries.length} {entries.length === 1 ? 'section' : 'sections'})
          </span>
        </div>
        <button onClick={onClose} className="btn btn-sm rounded-full">
          Close
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-grow overflow-hidden">
        {/* Left panel - file list */}
        <aside className="w-72 flex-shrink-0 border-r border-base-300 bg-base-100 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-base-300 bg-base-200/50">
            <h2 className="text-xs font-semibold uppercase text-base-content/60">Sections</h2>
          </div>
          <div className="flex-grow overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : (
              <ManuscriptXrayFileList
                entries={entries}
                selectedKey={selectedKey}
                onSelectEntry={handleSelectEntry}
              />
            )}
          </div>
        </aside>

        {/* Right panel - content viewer */}
        <main className="flex-grow overflow-hidden bg-base-100">
          <XrayContentViewer
            content={content}
            fileName={selectedKey}
            filePath={selectedKey}
            zip={null}
            isLoading={false}
            error={null}
          />
        </main>
      </div>
    </div>
  );
};

export default ManuscriptXrayModal;
