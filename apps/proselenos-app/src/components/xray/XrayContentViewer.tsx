import React, { useEffect, useState, useMemo } from 'react';
import { MdInsertDriveFile } from 'react-icons/md';
import { ContentResult, formatFileSize } from '@/services/xrayService';

interface XrayContentViewerProps {
  content: ContentResult | null;
  fileName: string | null;
  isLoading: boolean;
  error: string | null;
}

const XrayContentViewer: React.FC<XrayContentViewerProps> = ({
  content,
  fileName,
  isLoading,
  error,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Create object URL for images
  useEffect(() => {
    if (content && (content.type === 'image' || content.type === 'svg') && content.content instanceof Blob) {
      const url = URL.createObjectURL(content.content);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setImageUrl(null);
    return undefined;
  }, [content]);

  // Split text content into lines with line numbers
  const textLines = useMemo(() => {
    if (content?.type === 'text' && typeof content.content === 'string') {
      return content.content.split('\n');
    }
    return [];
  }, [content]);

  // Empty state - no file selected
  if (!fileName) {
    return (
      <div className="h-full flex items-center justify-center text-base-content/50">
        <div className="text-center">
          <MdInsertDriveFile size={48} className="mx-auto mb-2 opacity-30" />
          <p>Select a file to view its contents</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-error">
        <div className="text-center">
          <p className="font-semibold">Error loading file</p>
          <p className="text-sm opacity-70">{error}</p>
        </div>
      </div>
    );
  }

  // No content yet
  if (!content) {
    return null;
  }

  // Binary file - show info card
  if (content.type === 'binary') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="card bg-base-200 shadow-lg p-6 text-center max-w-sm">
          <MdInsertDriveFile size={48} className="mx-auto mb-4 text-base-content/50" />
          <p className="font-semibold text-lg mb-1">Cannot display file</p>
          <p className="text-base-content/70 text-sm mb-2">{fileName}</p>
          <p className="text-base-content/50 text-xs">{formatFileSize(content.size)}</p>
        </div>
      </div>
    );
  }

  // Image content
  if ((content.type === 'image' || content.type === 'svg') && imageUrl) {
    return (
      <div className="h-full overflow-auto p-4 flex items-center justify-center bg-base-200/30">
        <div className="text-center">
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-full max-h-[calc(100vh-200px)] object-contain rounded shadow-lg"
          />
          <p className="mt-2 text-xs text-base-content/50">
            {fileName} ({formatFileSize(content.size)})
          </p>
        </div>
      </div>
    );
  }

  // Text content with line numbers
  if (content.type === 'text') {
    const lineNumberWidth = String(textLines.length).length;

    return (
      <div className="h-full overflow-auto">
        {/* File header */}
        <div className="sticky top-0 bg-base-200 border-b border-base-300 px-4 py-2 text-sm flex justify-between items-center">
          <span className="font-mono text-base-content/70">{fileName}</span>
          <span className="text-xs text-base-content/50">
            {textLines.length} lines • {formatFileSize(content.size)}
          </span>
        </div>

        {/* Content with line numbers */}
        <div className="font-mono text-sm">
          <table className="w-full border-collapse">
            <tbody>
              {textLines.map((line, index) => (
                <tr key={index} className="hover:bg-base-200/50">
                  <td
                    className="select-none text-right pr-4 pl-2 text-base-content/40 border-r border-base-300 align-top"
                    style={{ width: `${lineNumberWidth + 2}ch` }}
                  >
                    {index + 1}
                  </td>
                  <td className="pl-4 pr-2 whitespace-pre-wrap break-all">
                    {line || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

export default XrayContentViewer;
