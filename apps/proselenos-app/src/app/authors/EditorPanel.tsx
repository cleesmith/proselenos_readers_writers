// app/authors/EditorPanel.tsx

'use client';

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import ToolProgressIndicator from '../ai-tools/ToolProgressIndicator';
import { isValidToolReport } from '@/utils/parseToolReport';
import OneByOnePanel from './OneByOnePanel';
import SearchResultsPanel, { SearchResult } from './SearchResultsPanel';
import ImagePickerModal from './ImagePickerModal';
import { ReportIssueWithStatus } from '@/types/oneByOne';
import { showUrlInput } from '../shared/alerts';

interface ImageInfo {
  filename: string;
  url: string;
}

interface Tool {
  id: string;
  name: string;
  category: string;
}

interface EditorPanelProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  onToggleSidebar: () => void;
  onAIWritingClick: () => void;
  hasApiKey: boolean;
  currentModel: string;
  // Section content
  sectionTitle: string;
  sectionContent: string;
  sectionType?: string;
  sectionWordCount: number;
  // Unsaved changes tracking
  onContentChange?: (hasChanges: boolean, content: string) => void;
  onTitleChange?: (newTitle: string) => void;
  // Section navigation
  onPrevSection?: () => void;
  onNextSection?: () => void;
  hasPrevSection?: boolean;
  hasNextSection?: boolean;
  // AI Tools
  selectedCategory: string;
  selectedTool: string;
  toolsInCategory: Tool[];
  toolsReady: boolean;
  toolExecuting: boolean;
  toolResult: string;
  elapsedTime: number;
  toolJustFinished: boolean;
  manuscriptContent: string;
  onCategoryChange: (category: string) => void;
  onToolChange: (tool: string) => void;
  onClearTool: () => void;
  onPromptEdit: () => void;
  onExecuteTool: () => void;
  onReport: () => void;
  onOneByOne?: () => void;
  isLoadingPrompt: boolean;
  // One-by-one inline panel props
  oneByOneActive?: boolean;
  oneByOneIssues?: ReportIssueWithStatus[];
  oneByOneIndex?: number;
  onOneByOneAccept?: () => void;
  onOneByOneCustom?: (customText: string) => void;
  onOneByOneSkip?: () => void;
  onOneByOneClose?: () => void;
  onOneByOnePrev?: () => void;
  onOneByOneNext?: () => void;
  // Search panel props
  searchActive?: boolean;
  searchResults?: SearchResult[];
  currentSearchIndex?: number;
  searchQuery?: string;
  onSearchNavigate?: (result: SearchResult, index: number) => void;
  onSearchPrev?: () => void;
  onSearchNext?: () => void;
  onSearchClose?: () => void;
  // Image picker props
  images?: ImageInfo[];
  onImageUpload?: (file: File) => Promise<void>;
  onImageDelete?: (filename: string) => void;
}

// Ref handle for parent to control textarea
export interface EditorPanelRef {
  scrollToPassage: (passage: string, startIndex?: number) => void;
  updateContent: (content: string) => void;
  getContent: () => string;
}

const EditorPanel = forwardRef<EditorPanelRef, EditorPanelProps>(function EditorPanel({
  theme,
  isDarkMode,
  onToggleSidebar,
  onAIWritingClick,
  hasApiKey,
  currentModel,
  sectionTitle,
  sectionContent,
  sectionType: _sectionType,
  sectionWordCount,
  onContentChange,
  onTitleChange,
  selectedCategory,
  selectedTool,
  toolsInCategory,
  toolsReady,
  toolExecuting,
  toolResult,
  elapsedTime,
  toolJustFinished: _toolJustFinished,
  manuscriptContent: _manuscriptContent,
  onCategoryChange,
  onToolChange,
  onClearTool,
  onPromptEdit,
  onExecuteTool,
  onReport,
  onOneByOne,
  isLoadingPrompt,
  // One-by-one inline panel props
  oneByOneActive,
  oneByOneIssues,
  oneByOneIndex,
  onOneByOneAccept,
  onOneByOneCustom,
  onOneByOneSkip,
  onOneByOneClose,
  onOneByOnePrev,
  onOneByOneNext,
  // Search panel props
  searchActive,
  searchResults,
  currentSearchIndex,
  searchQuery,
  onSearchNavigate,
  onSearchPrev,
  onSearchNext,
  onSearchClose,
  // Image picker props
  images,
  onImageUpload,
  onImageDelete,
}, ref) {
  const borderColor = isDarkMode ? '#404040' : '#e5e5e5';
  const mutedText = isDarkMode ? '#888' : '#666';

  // AI features require both API key AND a selected model
  const aiReady = hasApiKey && !!currentModel;

  // Editable chapter title state (initialized from prop, but editable locally for now)
  const [chapterTitle, setChapterTitle] = useState(sectionTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Editable content state (local for now - will persist later)
  const [localContent, setLocalContent] = useState(sectionContent);

  // Update local title when section changes
  useEffect(() => {
    setChapterTitle(sectionTitle);
  }, [sectionTitle]);

  // Update local content when section changes
  useEffect(() => {
    setLocalContent(sectionContent);
  }, [sectionContent]);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formatDropdownRef = useRef<HTMLDivElement>(null);

  // Formatting dropdown state
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);

  // Image picker state
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Close format dropdown when clicking outside
  useEffect(() => {
    if (!showFormatDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(e.target as Node)) {
        setShowFormatDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFormatDropdown]);

  // Wrap selected text with markdown formatting
  const wrapSelection = useCallback((prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localContent.substring(start, end);

    // If no text selected, just insert the markers
    const textToWrap = selectedText || 'text';
    const newContent =
      localContent.substring(0, start) +
      prefix + textToWrap + suffix +
      localContent.substring(end);

    setLocalContent(newContent);
    onContentChange?.(newContent !== sectionContent, newContent);

    // Restore focus and cursor position after the wrapped text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + textToWrap.length + suffix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);

    setShowFormatDropdown(false);
  }, [localContent, sectionContent, onContentChange]);

  // Handle Web Link formatting (needs URL prompt)
  const handleWebLink = useCallback(async () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localContent.substring(start, end) || 'link text';

    setShowFormatDropdown(false);

    const url = await showUrlInput('Enter URL', 'https://', isDarkMode);
    if (!url) {
      return;
    }

    const newContent =
      localContent.substring(0, start) +
      `[${selectedText}](${url})` +
      localContent.substring(end);

    setLocalContent(newContent);
    onContentChange?.(newContent !== sectionContent, newContent);

    setTimeout(() => {
      textarea.focus();
    }, 0);
  }, [localContent, sectionContent, onContentChange, isDarkMode]);

  // Handle image insertion from picker
  const handleImageInsert = useCallback((filename: string, altText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart } = textarea;
    const markdown = `![${altText}](${filename})`;

    // Insert at cursor position
    const newContent =
      localContent.slice(0, selectionStart) +
      markdown +
      localContent.slice(selectionStart);

    setLocalContent(newContent);
    onContentChange?.(newContent !== sectionContent, newContent);
    setShowImagePicker(false);

    // Restore focus
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = selectionStart + markdown.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [localContent, sectionContent, onContentChange]);

  // Scroll to and select a passage in the textarea
  const scrollToPassage = useCallback((passage: string, startIndex?: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = startIndex ?? localContent.indexOf(passage);
    if (start === -1) return;

    const end = start + passage.length;

    // Focus and select the passage
    textarea.focus();
    textarea.setSelectionRange(start, end);

    // Calculate scroll position based on character position
    // Approximate: count newlines before the passage to estimate line number
    const textBefore = localContent.slice(0, start);
    const linesBefore = (textBefore.match(/\n/g) || []).length;
    const lineHeight = 22.4; // 14px * 1.6 line-height
    const targetScroll = Math.max(0, linesBefore * lineHeight - 100);
    textarea.scrollTop = targetScroll;
  }, [localContent]);

  // Update content programmatically (for One-by-one Accept)
  const updateContent = useCallback((content: string) => {
    setLocalContent(content);
    onContentChange?.(content !== sectionContent, content);
  }, [sectionContent, onContentChange]);

  // Get current content (for One-by-one Accept)
  const getContent = useCallback(() => localContent, [localContent]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToPassage,
    updateContent,
    getContent,
  }), [scrollToPassage, updateContent, getContent]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
    if (toolExecuting) return; // Don't allow title editing while AI tool is running
    setEditedTitle(chapterTitle);
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    if (editedTitle.trim()) {
      const newTitle = editedTitle.trim();
      setChapterTitle(newTitle);
      // Notify parent of title change for persistence
      onTitleChange?.(newTitle);
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleTitleCancel();
    }
  };

  return (
    <main
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Chapter header */}
      <div
        style={{
          padding: '4px 8px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSave}
              style={{
                fontSize: '16px',
                fontWeight: 600,
                margin: 0,
                color: '#6366f1',
                backgroundColor: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: '4px',
                padding: '2px 6px',
                outline: 'none',
                width: '300px',
              }}
            />
          ) : (
            <button
              onClick={handleTitleClick}
              title="Click to edit chapter title"
              style={{
                fontSize: '16px',
                fontWeight: 600,
                margin: 0,
                padding: 0,
                color: '#6366f1',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                textAlign: 'left',
              }}
            >
              {chapterTitle}
            </button>
          )}
        </div>
        <span
          style={{
            padding: '2px 8px',
            backgroundColor: isDarkMode ? '#3a3a3a' : '#f0f0f0',
            borderRadius: '4px',
            fontSize: '11px',
            color: mutedText,
          }}
        >
          {sectionWordCount.toLocaleString()} w
        </span>
      </div>

      {/* Toolbar */}
      <div
        style={{
          padding: '4px 8px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap',
        }}
      >
        <StyledSmallButton theme={theme} onClick={onToggleSidebar} title="Toggle sidebar" disabled={toolExecuting}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </StyledSmallButton>

        {/* Formatting dropdown */}
        <div ref={formatDropdownRef} style={{ position: 'relative' }}>
          <StyledSmallButton
            theme={theme}
            onClick={() => setShowFormatDropdown(!showFormatDropdown)}
            title="Text formatting"
            disabled={toolExecuting}
          >
            Format ▾
          </StyledSmallButton>
          {showFormatDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 100,
                minWidth: '120px',
              }}
            >
              <button
                onClick={() => wrapSelection('**', '**')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  color: theme.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f0f0f0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <strong>Bold</strong>
              </button>
              <button
                onClick={() => wrapSelection('__', '__')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  color: theme.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f0f0f0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <em>Italic</em>
              </button>
              <button
                onClick={handleWebLink}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  color: theme.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f0f0f0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Web Link
              </button>
              <button
                onClick={() => { setShowFormatDropdown(false); setShowImagePicker(true); }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  color: theme.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f0f0f0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Image
              </button>
            </div>
          )}
        </div>

        {/* AI Section with green background */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexWrap: 'wrap',
            background: 'rgba(34, 197, 94, 0.2)',
            padding: '4px 8px',
            marginLeft: '4px',
            marginRight: '-8px',
            paddingRight: '12px',
          }}
        >
        <StyledSmallButton theme={theme} onClick={onAIWritingClick} disabled={!aiReady || toolExecuting}>
          AI Writing
        </StyledSmallButton>

        <span style={{ fontSize: '11px', color: theme.textMuted, marginLeft: '8px', opacity: aiReady ? 1 : 0.4 }}>AI Editing:</span>

        {/* Category dropdown */}
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          disabled={!toolsReady || toolExecuting || !aiReady}
          style={{
            padding: '2px 6px',
            backgroundColor: (toolsReady && aiReady) ? theme.inputBg : '#666',
            color: (toolsReady && aiReady) ? theme.text : '#999',
            border: `1px solid ${theme.border}`,
            borderRadius: '3px',
            fontSize: '11px',
            cursor: (toolsReady && aiReady) ? 'pointer' : 'not-allowed',
            opacity: aiReady ? 1 : 0.4,
          }}
        >
          <option value="">Category...</option>
          <option value="Core Editing Tools">Core Editing Tools</option>
          <option value="Other Editing Tools">Other Editing Tools</option>
          <option value="User Tools">User Tools</option>
        </select>

        {/* Tool dropdown */}
        <select
          value={selectedTool}
          onChange={(e) => onToolChange(e.target.value)}
          disabled={!selectedCategory || !toolsReady || toolExecuting || !aiReady}
          style={{
            padding: '2px 6px',
            backgroundColor: selectedCategory && toolsReady ? theme.inputBg : '#666',
            color: selectedCategory && toolsReady ? theme.text : '#999',
            border: `1px solid ${theme.border}`,
            borderRadius: '3px',
            fontSize: '11px',
            cursor: selectedCategory && toolsReady ? 'pointer' : 'not-allowed',
            maxWidth: '150px',
          }}
        >
          <option value="">
            {!toolsReady ? 'Loading...' : selectedCategory ? 'Tool...' : 'Select category'}
          </option>
          {toolsInCategory.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.name
                .split('_')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')}
            </option>
          ))}
        </select>

        {/* Prompt button */}
        <StyledSmallButton
          onClick={onPromptEdit}
          disabled={!selectedTool || !toolsReady || toolExecuting || isLoadingPrompt || !aiReady}
          theme={theme}
        >
          {isLoadingPrompt ? '...' : 'Prompt'}
        </StyledSmallButton>

        {/* Run button */}
        <StyledSmallButton
          onClick={onExecuteTool}
          disabled={!selectedTool || !toolsReady || toolExecuting || !aiReady}
          theme={theme}
        >
          {toolExecuting ? 'Running...' : 'Send'}
        </StyledSmallButton>

        {/* Clear button */}
        <StyledSmallButton
          onClick={onClearTool}
          disabled={(!toolResult && elapsedTime === 0) || toolExecuting}
          theme={theme}
        >
          Clear
        </StyledSmallButton>

        {/* Timer + Report + One-by-one */}
        <ToolProgressIndicator
          toolExecuting={toolExecuting}
          elapsedTime={elapsedTime}
          theme={theme}
          toolResult={toolResult}
          onReportClick={onReport}
          onOneByOneClick={onOneByOne}
          showOneByOneButton={isValidToolReport(toolResult)}
        />
        </div>
      </div>

      {/* Editor content area - fills space edge-to-edge */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: '4px',
        }}
      >
        {/* Custom selection color for search highlighting */}
        <style>{`
          .editor-textarea::selection {
            background-color: ${isDarkMode ? '#5a4a00' : '#fff59d'};
            color: ${isDarkMode ? '#fff' : '#000'};
          }
        `}</style>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={localContent}
          onChange={(e) => {
            const newContent = e.target.value;
            setLocalContent(newContent);
            // Notify parent of content change status (compare against original from IndexedDB)
            onContentChange?.(newContent !== sectionContent, newContent);
          }}
          placeholder="Type here..."
          style={{
            width: '100%',
            height: '100%',
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'Georgia, serif',
            padding: '0.5rem',
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
            color: theme.text,
            resize: 'none',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap',
          }}
        />
      </div>

      {/* One-by-one inline panel */}
      {oneByOneActive && oneByOneIssues && (
        <OneByOnePanel
          theme={theme}
          isDarkMode={isDarkMode}
          issues={oneByOneIssues}
          currentIndex={oneByOneIndex ?? 0}
          onAccept={onOneByOneAccept ?? (() => {})}
          onCustom={onOneByOneCustom ?? (() => {})}
          onSkip={onOneByOneSkip ?? (() => {})}
          onClose={onOneByOneClose ?? (() => {})}
          onPrev={onOneByOnePrev ?? (() => {})}
          onNext={onOneByOneNext ?? (() => {})}
        />
      )}

      {/* Search results panel */}
      {searchActive && searchResults && searchResults.length > 0 && (
        <SearchResultsPanel
          theme={theme}
          isDarkMode={isDarkMode}
          results={searchResults}
          currentIndex={currentSearchIndex ?? 0}
          searchQuery={searchQuery ?? ''}
          onNavigate={onSearchNavigate ?? (() => {})}
          onPrev={onSearchPrev ?? (() => {})}
          onNext={onSearchNext ?? (() => {})}
          onClose={onSearchClose ?? (() => {})}
        />
      )}

      {/* Image picker modal */}
      <ImagePickerModal
        isOpen={showImagePicker}
        theme={theme}
        isDarkMode={isDarkMode}
        images={images ?? []}
        onSelect={handleImageInsert}
        onUpload={onImageUpload ?? (async () => {})}
        onDelete={onImageDelete ?? (() => {})}
        onClose={() => setShowImagePicker(false)}
      />
    </main>
  );
});

export default EditorPanel;
