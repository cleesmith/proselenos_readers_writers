import React from 'react';
import { MdInsertDriveFile } from 'react-icons/md';
import { ManuscriptXrayEntry } from '@/services/manuscriptStorage';
import { formatFileSize } from '@/services/xrayService';

interface ManuscriptXrayFileListProps {
  entries: ManuscriptXrayEntry[];
  selectedKey: string | null;
  onSelectEntry: (key: string) => void;
}

const ManuscriptXrayFileList: React.FC<ManuscriptXrayFileListProps> = ({
  entries,
  selectedKey,
  onSelectEntry,
}) => {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-base-content/50 text-sm">
        No XHTML sections found
      </div>
    );
  }

  return (
    <div className="py-1">
      {entries.map((entry) => (
        <button
          key={entry.key}
          onClick={() => onSelectEntry(entry.key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectEntry(entry.key);
            }
          }}
          className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors cursor-pointer ${
            selectedKey === entry.key
              ? 'bg-primary/20 border-l-2 border-primary'
              : 'hover:bg-base-200 border-l-2 border-transparent'
          }`}
        >
          <MdInsertDriveFile
            size={14}
            className="flex-shrink-0 mt-0.5 text-base-content/50"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-base-content truncate">
              {entry.title}
            </div>
            <div className="text-xs text-base-content/50 flex items-center gap-2">
              <span className="truncate">{entry.key}</span>
              <span className="flex-shrink-0">{formatFileSize(entry.size)}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ManuscriptXrayFileList;
