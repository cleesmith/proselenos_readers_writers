// app/authors/EditorPanel.tsx

'use client';

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import ToolProgressIndicator from '../ai-tools/ToolProgressIndicator';
import { isValidToolReport } from '@/utils/parseToolReport';
import OneByOnePanel from './OneByOnePanel';
import SearchResultsPanel, { SearchResult } from './SearchResultsPanel';
import ImagePickerModal from './ImagePickerModal';
import { ReportIssueWithStatus } from '@/types/oneByOne';
import { ImageLibraryProvider } from '@/contexts/ImageLibraryContext';


// PlateJS imports
import { Plate, usePlateEditor } from 'platejs/react';
import { EditorKit } from '@/components/plate-editor/editor-kit';
import { EditorContainer, Editor } from '@/components/plate-ui/editor';
import { createEmptyValue, plateToPlainText, xhtmlToPlate, plateToXhtml } from '@/lib/plateXhtml';
import type { Value } from 'platejs';
import { FindReplacePlugin } from '@platejs/find-replace';
import { cn } from '@/lib/utils';

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
  onSave?: () => Promise<void>;
  onAIWritingClick: () => void;
  hasApiKey: boolean;
  currentModel: string;
  // Section content - XHTML-Native: Single source of truth
  sectionTitle: string;
  sectionXhtml: string;             // XHTML content (single source of truth)
  sectionType?: string;
  sectionWordCount: number;
  // XHTML-Native: Passes XHTML directly
  onContentChange?: (hasChanges: boolean, xhtml: string) => void;
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

// Ref handle for parent to control editor
export interface EditorPanelRef {
  scrollToPassage: (passage: string, startIndex?: number) => void;
  updateContent: (content: string) => void;
  getContent: () => string;
}

const EditorPanel = forwardRef<EditorPanelRef, EditorPanelProps>(function EditorPanel({
  theme,
  isDarkMode,
  onToggleSidebar,
  onSave,
  onAIWritingClick,
  hasApiKey,
  currentModel,
  sectionTitle,
  sectionXhtml,
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

  // XHTML-Native: Track the original XHTML for comparison (to detect changes)
  const [originalXhtml, setOriginalXhtml] = useState(sectionXhtml);

  // Track if editor is initialized
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Update local title when section changes
  useEffect(() => {
    setChapterTitle(sectionTitle);
  }, [sectionTitle]);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Image picker state
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Save button state
  const [isSaving, setIsSaving] = useState(false);

  // Handle manual save with visual feedback
  const handleSaveClick = useCallback(async () => {
    if (!onSave || isSaving) return;
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      // Brief delay to show "Saved" state
      setTimeout(() => setIsSaving(false), 500);
    }
  }, [onSave, isSaving]);

  // Create initial value - use plateValue if available, otherwise create empty
  const initialValue = useMemo(() => {
    return createEmptyValue();
  }, []);

  // Create the Plate editor
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialValue,
  });

  // XHTML-Native: Update editor content when section changes
  // Convert XHTML to PlateJS on load
  useEffect(() => {
    if (!editor) return;

    // Convert XHTML to PlateJS value
    let value: Value;
    if (sectionXhtml && sectionXhtml.trim()) {
      value = xhtmlToPlate(sectionXhtml);
    } else {
      value = createEmptyValue();
    }

    // Reset editor with new value
    editor.tf.reset();
    editor.tf.setValue(value);

    setOriginalXhtml(sectionXhtml);
    setIsEditorReady(true);
  }, [sectionXhtml, editor]);

  // Set/clear find-replace highlighting based on active search
  useEffect(() => {
    if (!editor) return;
    if (searchActive && searchQuery) {
      editor.setOptions(FindReplacePlugin, { search: searchQuery });
    } else {
      editor.setOptions(FindReplacePlugin, { search: '' });
    }
  }, [editor, searchActive, searchQuery]);

  // XHTML-Native: Handle editor changes
  // Convert PlateJS to XHTML on change
  const handleEditorChange = useCallback(() => {
    if (!editor || !isEditorReady) return;

    // Get the current PlateJS value
    const plateValue = editor.children as Value;

    // Convert to XHTML (single source of truth)
    const xhtml = plateToXhtml(plateValue);

    // Check if content has changed by comparing XHTML
    const hasChanged = xhtml !== originalXhtml;

    // Notify parent with XHTML
    onContentChange?.(hasChanged, xhtml);
  }, [editor, isEditorReady, originalXhtml, onContentChange]);

  // Handle image insertion from picker
  // XHTML-Native: Inserts as proper Plate image element node
  const handleImageInsert = useCallback((filename: string, altText: string) => {
    if (!editor) return;

    // Insert proper Plate image element node
    editor.tf.insertNodes({
      type: 'img',
      url: filename,
      alt: altText,
      children: [{ text: '' }],
    });

    setShowImagePicker(false);

    // Update parent with new XHTML
    const plateValue = editor.children as Value;
    const xhtml = plateToXhtml(plateValue);
    onContentChange?.(xhtml !== originalXhtml, xhtml);
  }, [editor, originalXhtml, onContentChange]);

  // Scroll to and highlight a passage in the editor
  // FindReplacePlugin handles highlighting all matches automatically
  const scrollToPassage = useCallback((passage: string, startIndex?: number) => {
    if (!editor) return;
    editor.tf.focus();

    // Find the editor position by walking text nodes
    // plateToPlainText joins blocks with '\n\n', so account for that
    let charCount = 0;
    const blocks = editor.children;

    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      if (blockIdx > 0) charCount += 2; // '\n\n' separator between blocks

      const block = blocks[blockIdx] as { children?: { text?: string }[] };
      if (!block.children) continue;

      for (let textIdx = 0; textIdx < block.children.length; textIdx++) {
        const textNode = block.children[textIdx];
        if (!textNode || typeof textNode.text !== 'string') continue;

        const textLength = textNode.text.length;

        if (startIndex !== undefined) {
          // Use character position if provided
          if (charCount + textLength > startIndex) {
            const offset = startIndex - charCount;
            editor.tf.select({ path: [blockIdx, textIdx], offset });
            break;
          }
        } else {
          // Fall back to text match
          const matchPos = textNode.text.indexOf(passage);
          if (matchPos !== -1) {
            editor.tf.select({ path: [blockIdx, textIdx], offset: matchPos });
            break;
          }
        }

        charCount += textLength;
      }

      // Check if we already placed the selection
      if (editor.selection) {
        const sel = editor.selection;
        if (sel.anchor && sel.anchor.path[0] === blockIdx) break;
      }
    }

    // Scroll the selection into view via the DOM
    setTimeout(() => {
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) return;

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.top === 0 && rect.left === 0)) return;

      const editorEl = document.querySelector('[data-plate-editor]');
      if (!editorEl) return;

      const editorRect = editorEl.getBoundingClientRect();
      const offsetTop = rect.top - editorRect.top;

      // Only scroll if the match is outside the visible area
      if (offsetTop < 0 || offsetTop > editorEl.clientHeight) {
        editorEl.scrollTop += offsetTop - editorEl.clientHeight / 3;
      }
    }, 0);
  }, [editor]);

  // Update content programmatically (for One-by-one Accept)
  // XHTML-Native: Takes plain text and converts to XHTML paragraphs
  const updateContent = useCallback((content: string) => {
    if (!editor) return;

    // Convert plain text to paragraphs
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    const value: Value = paragraphs.length > 0
      ? paragraphs.map(p => ({
          type: 'p',
          children: [{ text: p.replace(/\n/g, ' ').trim() }],
        }))
      : createEmptyValue();

    editor.tf.reset();
    editor.tf.setValue(value);

    // Convert to XHTML and notify parent
    const xhtml = plateToXhtml(value);
    onContentChange?.(xhtml !== originalXhtml, xhtml);
  }, [editor, originalXhtml, onContentChange]);

  // Get current content as plain text (for compatibility with One-by-one, search, etc.)
  const getContent = useCallback(() => {
    if (!editor) return plateToPlainText(xhtmlToPlate(sectionXhtml));
    const plateValue = editor.children as Value;
    return plateToPlainText(plateValue);
  }, [editor, sectionXhtml]);

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
    <ImageLibraryProvider value={{ openImageLibrary: () => setShowImagePicker(true) }}>
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

        {/* Manual Save button */}
        <StyledSmallButton
          theme={theme}
          onClick={handleSaveClick}
          title="Save current section (Ctrl+S)"
          disabled={toolExecuting || isSaving}
          styleOverrides={{
            backgroundColor: isSaving ? '#28a745' : undefined,
            color: isSaving ? 'white' : undefined,
          }}
        >
          {isSaving ? 'Saved' : 'Save'}
        </StyledSmallButton>

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
        <StyledSmallButton
          theme={theme}
          onClick={onAIWritingClick}
          disabled={!aiReady || toolExecuting}
          styleOverrides={{
            backgroundColor: isDarkMode ? 'rgba(124, 58, 237, 0.5)' : 'rgba(91, 33, 182, 0.35)',
            borderColor: isDarkMode ? 'rgba(124, 58, 237, 0.65)' : 'rgba(91, 33, 182, 0.5)',
          }}
        >
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

      {/* Editor content area - PlateJS editor */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: '4px',
        }}
      >
        <Plate
          editor={editor}
          onChange={handleEditorChange}
        >
          <EditorContainer
            className={cn(
              'h-full rounded border',
              isDarkMode ? 'bg-[#343a40] border-gray-600' : 'bg-[#f8f9fa] border-gray-300'
            )}
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '14px',
              lineHeight: '1.6',
              color: theme.text,
            }}
          >
            <Editor
              variant="default"
              placeholder="Type here..."
              className={cn(
                'min-h-full',
                isDarkMode && 'placeholder:text-gray-500'
              )}
            />
          </EditorContainer>
        </Plate>
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
    </ImageLibraryProvider>
  );
});

export default EditorPanel;
