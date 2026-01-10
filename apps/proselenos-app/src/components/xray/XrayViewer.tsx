import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { GiBoxUnpacking } from 'react-icons/gi';
import { XrayTreeNode, ContentResult, loadEpubStructure, getFileContent } from '@/services/xrayService';
import XrayFileTree from './XrayFileTree';
import XrayContentViewer from './XrayContentViewer';

interface XrayViewerProps {
  bookTitle: string;
  epubFile: File;
  onClose?: () => void;
}

const XrayViewer: React.FC<XrayViewerProps> = ({ bookTitle, epubFile, onClose }) => {
  const router = useRouter();
  const [tree, setTree] = useState<XrayTreeNode | null>(null);
  const [zip, setZip] = useState<JSZip | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<ContentResult | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  // Load epub structure on mount
  useEffect(() => {
    const loadStructure = async () => {
      setIsLoadingTree(true);
      setTreeError(null);
      try {
        const result = await loadEpubStructure(epubFile);
        setTree(result.tree);
        setZip(result.zip);
      } catch (err) {
        console.error('Failed to load epub structure:', err);
        setTreeError(err instanceof Error ? err.message : 'Failed to load epub structure');
      } finally {
        setIsLoadingTree(false);
      }
    };

    loadStructure();
  }, [epubFile]);

  // Load file content when selection changes
  const handleSelectFile = useCallback(async (path: string) => {
    if (!zip) return;

    setSelectedPath(path);
    setIsLoadingContent(true);
    setContentError(null);
    setContent(null);

    try {
      const result = await getFileContent(zip, path);
      setContent(result);
    } catch (err) {
      console.error('Failed to load file content:', err);
      setContentError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setIsLoadingContent(false);
    }
  }, [zip]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      router.push('/library');
    }
  }, [onClose, router]);

  // Extract just the filename from the path for display
  const selectedFileName = selectedPath?.split('/').pop() || null;

  return (
    <div className="xray-viewer h-screen flex flex-col bg-base-100">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GiBoxUnpacking size={20} className="text-purple-500" />
          <h1 className="text-base font-semibold text-base-content line-clamp-1">
            {bookTitle}
          </h1>
        </div>
        <button onClick={handleClose} className="btn btn-sm rounded-full">
          Close
        </button>
      </header>

      {/* Main content area */}
      <div className="flex flex-grow overflow-hidden">
        {/* File tree panel */}
        <aside className="w-72 flex-shrink-0 border-r border-base-300 bg-base-100 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-base-300 bg-base-200/50">
            <h2 className="text-xs font-semibold uppercase text-base-content/60">Files</h2>
          </div>
          <div className="flex-grow overflow-auto">
            {isLoadingTree ? (
              <div className="flex items-center justify-center h-32">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : treeError ? (
              <div className="p-4 text-error text-sm">
                <p className="font-semibold">Error loading structure</p>
                <p className="text-xs opacity-70">{treeError}</p>
              </div>
            ) : tree ? (
              <XrayFileTree
                tree={tree}
                selectedPath={selectedPath}
                onSelectFile={handleSelectFile}
              />
            ) : null}
          </div>
        </aside>

        {/* Content viewer panel */}
        <main className="flex-grow overflow-hidden bg-base-100">
          <XrayContentViewer
            content={content}
            fileName={selectedFileName}
            isLoading={isLoadingContent}
            error={contentError}
          />
        </main>
      </div>
    </div>
  );
};

export default XrayViewer;
