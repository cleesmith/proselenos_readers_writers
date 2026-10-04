// app/authors/EditorPanel.tsx

'use client';

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import SearchResultsPanel, { SearchResult } from './SearchResultsPanel';
import ImagePickerModal from './ImagePickerModal';
import AudioPickerModal from './AudioPickerModal';
import SceneCraftModal from './SceneCraftModal';
import { ImageLibraryProvider } from '@/contexts/ImageLibraryContext';
import { AudioLibraryProvider } from '@/contexts/AudioLibraryContext';
import type { SceneCraftConfig } from '@/services/manuscriptStorage';


// PlateJS imports
import { Plate, usePlateEditor } from 'platejs/react';
import { EditorKit } from '@/components/plate-editor/editor-kit';
import { EditorContainer, Editor } from '@/components/plate-ui/editor';
import { createEmptyValue, xhtmlToPlate, plateToXhtml } from '@/lib/plateXhtml';
import type { Value } from 'platejs';
import { FindReplacePlugin } from '@platejs/find-replace';
import { cn } from '@/lib/utils';

interface ImageInfo {
  filename: string;
  url: string;
}

interface AudioInfo {
  filename: string;
  size: number;
}

interface EditorPanelProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  onToggleSidebar: () => void;
  onSave?: () => Promise<void>;
  // Section content - XHTML-Native: Single source of truth
  sectionId?: string;
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
  // Audio picker props
  audios?: AudioInfo[];
  onAudioUpload?: (file: File) => Promise<void>;
  onAudioDelete?: (filename: string) => void;
  // SceneCraft props
  sceneCraftConfig?: SceneCraftConfig | null;
  onSceneCraftConfigChange?: (config: SceneCraftConfig) => void;
  getImageUrl?: (filename: string) => string | null;
  getAudioUrl?: (filename: string) => Promise<string | null>;
  // Book metadata (for preview display)
}

// Ref handle for parent to control editor
export interface EditorPanelRef {
  scrollToPassage: (passage: string, startIndex?: number) => boolean;
}

const EditorPanel = forwardRef<EditorPanelRef, EditorPanelProps>(function EditorPanel({
  theme,
  isDarkMode,
  onToggleSidebar,
  onSave,
  sectionId,
  sectionTitle,
  sectionXhtml,
  sectionType: _sectionType,
  sectionWordCount,
  onContentChange,
  onTitleChange,
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
  // Audio picker props
  audios,
  onAudioUpload,
  onAudioDelete,
  // SceneCraft props
  sceneCraftConfig,
  onSceneCraftConfigChange,
  getImageUrl,
  getAudioUrl,
}, ref) {
  const borderColor = isDarkMode ? '#404040' : '#e5e5e5';
  const mutedText = isDarkMode ? '#888' : '#666';

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
  const pendingImageCallbackRef = useRef<((filename: string, altText: string) => void) | null>(null);

  // Audio picker state
  const [showAudioPicker, setShowAudioPicker] = useState(false);

  // SceneCraft modal state
  const [showSceneCraft, setShowSceneCraft] = useState(false);

  // Save button state
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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

    // Prepend 2 empty paragraphs so the user can always click above the first block element.
    // Skip if the content already starts with an empty paragraph.
    const firstNode = value[0] as { type?: string; children?: { text?: string }[] } | undefined;
    const isFirstEmpty = firstNode?.type === 'p'
      && firstNode.children?.length === 1
      && firstNode.children[0]?.text === '';
    if (!isFirstEmpty) {
      value = [
        { type: 'p', children: [{ text: '' }] },
        { type: 'p', children: [{ text: '' }] },
        ...value,
      ] as Value;
    }

    // Reset editor with new value
    editor.tf.reset();
    editor.tf.setValue(value);

    // Use the editor's normalized XHTML as the baseline for change detection.
    // This avoids false positives from round-trip differences (whitespace, attribute order, etc.)
    // between the raw sectionXhtml prop and what plateToXhtml(editor.children) produces.
    setOriginalXhtml(plateToXhtml(editor.children as Value));
    setHasChanges(false);  // Reset unsaved indicator when section changes
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
    setHasChanges(hasChanged);  // Update Save button indicator

    // Notify parent with XHTML
    onContentChange?.(hasChanged, xhtml);
  }, [editor, isEditorReady, originalXhtml, onContentChange]);

  // Handle manual save with visual feedback
  const handleSaveClick = useCallback(async () => {
    if (!onSave || isSaving) return;
    setIsSaving(true);
    try {
      await onSave();
      // Sync originalXhtml to what the editor actually contains,
      // so the change-detection comparison stays accurate after save.
      const plateValue = editor.children as Value;
      setOriginalXhtml(plateToXhtml(plateValue));
      setHasChanges(false);  // Reset unsaved indicator after successful save
    } finally {
      // Brief delay to show "Saved" state
      setTimeout(() => setIsSaving(false), 500);
    }
  }, [onSave, isSaving, editor]);

  // Handle image insertion from picker
  // XHTML-Native: Inserts as proper Plate image element node, or calls pending callback
  const handleImageInsert = useCallback((filename: string, altText: string) => {
    // If a callback is pending (e.g. from StickyImageElement), call it instead of inserting
    if (pendingImageCallbackRef.current) {
      const cb = pendingImageCallbackRef.current;
      pendingImageCallbackRef.current = null;
      setShowImagePicker(false);
      cb(filename, altText);
      return;
    }

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

  // Handle audio insertion from picker
  const handleAudioInsert = useCallback((filename: string, _label: string, _mediaType: string) => {
    if (!editor) return;

    editor.tf.insertNodes({
      type: 'audio',
      url: `audio/${filename}`,
      children: [{ text: '' }],
    });

    setShowAudioPicker(false);

    // Update parent with new XHTML
    const plateValue = editor.children as Value;
    const xhtml = plateToXhtml(plateValue);
    onContentChange?.(xhtml !== originalXhtml, xhtml);
  }, [editor, originalXhtml, onContentChange]);

  // Scroll to and highlight a passage in the editor
  // FindReplacePlugin handles highlighting all matches automatically
  // Returns true if selection was successfully placed, false otherwise
  const scrollToPassage = useCallback((passage: string, startIndex?: number): boolean => {
    if (!editor) return false;
    editor.tf.focus();

    // Find the editor position by walking text nodes
    // plateToPlainText joins blocks with '\n\n', so account for that
    let charCount = 0;
    const blocks = editor.children;
    let foundMatch = false;

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
            foundMatch = true;
            break;
          }
        } else {
          // Fall back to text match
          const matchPos = textNode.text.indexOf(passage);
          if (matchPos !== -1) {
            editor.tf.select({ path: [blockIdx, textIdx], offset: matchPos });
            foundMatch = true;
            break;
          }
        }

        charCount += textLength;
      }

      if (foundMatch) break;
    }

    // Check if selection was actually set
    if (!editor.selection) return false;

    // Scroll the selection into view via the DOM
    setTimeout(() => {
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) return;

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.top === 0 && rect.left === 0)) return;

      // Use scrollIntoView for more reliable scrolling
      const node = range.startContainer.parentElement;
      if (node) {
        node.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    }, 50);

    return true;
  }, [editor]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToPassage,
  }), [scrollToPassage]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
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
    <ImageLibraryProvider value={{
      openImageLibrary: (callback) => {
        if (callback) {
          pendingImageCallbackRef.current = callback;
        }
        setShowImagePicker(true);
      },
      images: images ?? [],
    }}>
    <AudioLibraryProvider value={{
      openAudioLibrary: () => setShowAudioPicker(true),
      uploadAudioToLibrary: async (file: File) => {
        await onAudioUpload?.(file);
      },
    }}>
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
        <StyledSmallButton theme={theme} onClick={onToggleSidebar} title="Toggle sidebar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </StyledSmallButton>

        {/* Manual Save button - turns red when unsaved changes exist */}
        <StyledSmallButton
          theme={theme}
          onClick={handleSaveClick}
          title={hasChanges ? "Unsaved changes - click to save (Ctrl+S)" : "Save current section (Ctrl+S)"}
          disabled={isSaving}
          styleOverrides={{
            backgroundColor: isSaving ? '#28a745' : hasChanges ? '#dc3545' : undefined,
            color: (isSaving || hasChanges) ? 'white' : undefined,
          }}
        >
          {isSaving ? 'Saved' : 'Save'}
        </StyledSmallButton>

        {/* SceneCraft button */}
        <StyledSmallButton
          theme={theme}
          onClick={() => setShowSceneCraft(true)}
          title="Open Scenecraft immersive editor"
          styleOverrides={{
            backgroundColor: 'rgba(255, 120, 68, 0.15)',
            borderColor: 'rgba(255, 120, 68, 0.25)',
            color: '#ff7844',
          }}
        >
          Scenecraft
        </StyledSmallButton>
      </div>

      {/* Editor content area - PlateJS editor (always visible; preview is now a full-screen overlay) */}
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
        onClose={() => {
          pendingImageCallbackRef.current = null;
          setShowImagePicker(false);
        }}
      />

      {/* Audio picker modal */}
      <AudioPickerModal
        isOpen={showAudioPicker}
        theme={theme}
        isDarkMode={isDarkMode}
        audios={audios ?? []}
        onSelect={handleAudioInsert}
        onUpload={onAudioUpload ?? (async () => {})}
        onDelete={onAudioDelete ?? (() => {})}
        onClose={() => setShowAudioPicker(false)}
      />

      {/* SceneCraft immersive editor modal */}
      <SceneCraftModal
        isOpen={showSceneCraft}
        onClose={() => setShowSceneCraft(false)}
        sectionId={sectionId || ''}
        sectionTitle={chapterTitle}
        sectionXhtml={(() => {
          if (!editor) return sectionXhtml;
          const plateValue = editor.children as Value;
          return plateToXhtml(plateValue);
        })()}
        sceneCraftConfig={sceneCraftConfig ?? null}
        onConfigChange={onSceneCraftConfigChange ?? (() => {})}
        images={images ?? []}
        audios={audios ?? []}
        onImageUpload={onImageUpload ?? (async () => {})}
        onImageDelete={onImageDelete ?? (() => {})}
        onAudioUpload={onAudioUpload ?? (async () => {})}
        onAudioDelete={onAudioDelete ?? (() => {})}
        getImageUrl={getImageUrl ?? (() => null)}
        getAudioUrl={getAudioUrl ?? (async () => null)}
        theme={theme}
        isDarkMode={isDarkMode}
      />

    </main>
    </AudioLibraryProvider>
    </ImageLibraryProvider>
  );
});

export default EditorPanel;
