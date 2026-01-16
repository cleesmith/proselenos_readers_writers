import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { MdInsertDriveFile } from 'react-icons/md';
import JSZip from 'jszip';
import { ContentResult, formatFileSize, getFileContent } from '@/services/xrayService';

interface XrayContentViewerProps {
  content: ContentResult | null;
  fileName: string | null;
  filePath: string | null;
  zip: JSZip | null;
  isLoading: boolean;
  error: string | null;
}

const XrayContentViewer: React.FC<XrayContentViewerProps> = ({
  content,
  fileName,
  filePath,
  zip,
  isLoading,
  error,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'source' | 'preview'>('source');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Resolve relative paths (handles ../ and ./)
  const resolvePath = useCallback((baseDir: string, relativePath: string): string => {
    const parts = (baseDir + relativePath).split('/');
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') resolved.pop();
      else if (part !== '.' && part !== '') resolved.push(part);
    }
    return resolved.join('/');
  }, []);

  // Inline CSS stylesheets into HTML
  const inlineStylesheets = useCallback(async (html: string, zipFile: JSZip, basePath: string): Promise<string> => {
    // Get directory of current file (e.g., "OEBPS/text/" from "OEBPS/text/chapter1.xhtml")
    const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);

    // Find all <link rel="stylesheet" href="..."> tags
    const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi;

    let result = html;
    const matches: { fullMatch: string; href: string }[] = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      if (match[1]) {
        matches.push({ fullMatch: match[0], href: match[1] });
      }
    }

    for (const { fullMatch, href } of matches) {
      const cssPath = resolvePath(baseDir, href);
      try {
        const cssContent = await getFileContent(zipFile, cssPath);
        if (cssContent.type === 'text' && typeof cssContent.content === 'string') {
          result = result.replace(fullMatch, `<style>${cssContent.content}</style>`);
        }
      } catch {
        // CSS file not found, leave link as-is
      }
    }
    return result;
  }, [resolvePath]);

  // Check if file is HTML/XHTML (can be previewed)
  const isHtmlFile = useMemo(() => {
    if (!fileName) return false;
    const lower = fileName.toLowerCase();
    return lower.endsWith('.xhtml') || lower.endsWith('.html') || lower.endsWith('.htm');
  }, [fileName]);

  // Reset view mode to source when file changes
  useEffect(() => {
    setViewMode('source');
    setPreviewHtml(null);
  }, [fileName]);

  // Process HTML to inline CSS when switching to preview mode
  useEffect(() => {
    if (viewMode !== 'preview' || !isHtmlFile || !zip || !filePath) {
      setPreviewHtml(null);
      return;
    }
    if (content?.type !== 'text' || typeof content.content !== 'string') return;

    setIsProcessing(true);
    inlineStylesheets(content.content, zip, filePath)
      .then(setPreviewHtml)
      .finally(() => setIsProcessing(false));
  }, [viewMode, content, zip, filePath, isHtmlFile, inlineStylesheets]);

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
      <div className="h-full flex flex-col overflow-hidden">
        {/* File header */}
        <div className="flex-shrink-0 bg-base-200 border-b border-base-300 px-4 py-2 text-sm flex justify-between items-center">
          <span className="font-mono text-base-content/70">{fileName}</span>
          <div className="flex items-center gap-3">
            {/* Source/Preview toggle for HTML files */}
            {isHtmlFile && (
              <div className="flex rounded overflow-hidden border border-base-300">
                <button
                  onClick={() => setViewMode('source')}
                  className={`px-2 py-0.5 text-xs transition-colors ${
                    viewMode === 'source'
                      ? 'bg-primary text-primary-content'
                      : 'bg-base-100 hover:bg-base-300'
                  }`}
                >
                  Source
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-2 py-0.5 text-xs transition-colors ${
                    viewMode === 'preview'
                      ? 'bg-primary text-primary-content'
                      : 'bg-base-100 hover:bg-base-300'
                  }`}
                >
                  Preview
                </button>
              </div>
            )}
            <span className="text-xs text-base-content/50">
              {textLines.length} lines • {formatFileSize(content.size)}
            </span>
          </div>
        </div>

        {/* Preview mode - render HTML in iframe with inlined CSS */}
        {isHtmlFile && viewMode === 'preview' ? (
          <div className="flex-1 overflow-hidden bg-white">
            {isProcessing ? (
              <div className="flex items-center justify-center h-full">
                <span className="loading loading-spinner loading-sm"></span>
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml || ''}
                sandbox=""
                className="w-full h-full border-0"
                title={`Preview of ${fileName}`}
              />
            )}
          </div>
        ) : (
          /* Source mode - content with line numbers */
          <div className="flex-1 overflow-auto font-mono text-sm">
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
        )}
      </div>
    );
  }

  return null;
};

export default XrayContentViewer;
