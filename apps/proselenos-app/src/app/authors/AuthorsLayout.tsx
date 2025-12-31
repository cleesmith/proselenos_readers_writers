// app/authors/AuthorsLayout.tsx

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert } from '../shared/alerts';
import Swal from 'sweetalert2';
import AuthorsHeader from './AuthorsHeader';
import ChapterSidebar from './ChapterSidebar';
import EditorPanel, { EditorPanelRef } from './EditorPanel';
import { ElementType, getDefaultTitle } from './elementTypes';
import TitlePagePanel, { BookMetadata } from './TitlePagePanel';
import { parseEpub, ParsedEpub } from '@/services/epubService';
import { parseDocx } from '@/services/docxService';
import { countWords } from '@/services/htmlExtractor';
import { loadFullWorkingCopy, saveFullWorkingCopy, deleteSection, saveWorkingCopyMeta, loadWorkingCopyMeta, clearWorkingCopy, saveSection, saveCoverImage, deleteCoverImage, loadCoverImage, WorkingCopyMeta } from '@/services/manuscriptStorage';
import { generateEpubFromWorkingCopy } from '@/lib/epub-generator';
import environmentConfig from '@/services/environment';
import { parseToolReport } from '@/utils/parseToolReport';
import { ReportIssueWithStatus } from '@/types/oneByOne';

interface Tool {
  id: string;
  name: string;
  category: string;
}

interface AuthorsLayoutProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  onThemeToggle: () => void;
  onAboutClick: () => void;
  onStorageClick: () => void;
  onFilesClick: () => void;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  onKeyClick: () => void;
  onModelsClick: () => void;
  onEditorClick: () => void;
  onAIWritingClick: () => void;
  onChatClick: () => void;
  onLoadFromLibraryClick: () => void;
  hasApiKey: boolean;
  currentModel: string;
  currentProvider: string;
  // AI Tools props
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
  onExecuteTool: (currentText: string) => void;
  onReport: () => void;
  isLoadingPrompt: boolean;
  // Working Copy refresh props (for Chapter Writer)
  refreshKey?: number;
  pendingSectionId?: string | null;
  onPendingSectionHandled?: () => void;
}

export default function AuthorsLayout({
  theme,
  isDarkMode,
  onThemeToggle,
  onAboutClick,
  onStorageClick,
  onFilesClick,
  sidebarVisible,
  onToggleSidebar,
  onKeyClick,
  onModelsClick,
  onEditorClick,
  onAIWritingClick,
  onChatClick,
  onLoadFromLibraryClick,
  hasApiKey,
  currentModel,
  currentProvider,
  // AI Tools
  selectedCategory,
  selectedTool,
  toolsInCategory,
  toolsReady,
  toolExecuting,
  toolResult,
  elapsedTime,
  toolJustFinished,
  manuscriptContent,
  onCategoryChange,
  onToolChange,
  onClearTool,
  onPromptEdit,
  onExecuteTool,
  onReport,
  isLoadingPrompt,
  // Working Copy refresh props
  refreshKey,
  pendingSectionId,
  onPendingSectionHandled,
}: AuthorsLayoutProps) {
  // Epub state
  const [epub, setEpub] = useState<ParsedEpub | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [bookMeta, setBookMeta] = useState<WorkingCopyMeta | null>(null);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingContent, setPendingContent] = useState<string>('');
  const [pendingTitle, setPendingTitle] = useState<string>('');
  const [pendingSectionSwitch, setPendingSectionSwitch] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // One-by-one inline editing state
  const editorPanelRef = useRef<EditorPanelRef>(null);
  const [oneByOneActive, setOneByOneActive] = useState(false);
  const [oneByOneIssues, setOneByOneIssues] = useState<ReportIssueWithStatus[]>([]);
  const [oneByOneIndex, setOneByOneIndex] = useState(0);

  // Computed values
  const selectedSection = epub?.sections.find((s) => s.id === selectedSectionId);
  const totalWordCount = epub?.sections.reduce((sum, s) => sum + countWords(s.content), 0) ?? 0;
  const sectionWordCount = countWords(selectedSection?.content ?? '');

  // Navigation computed values
  const currentSectionIndex = epub?.sections.findIndex((s) => s.id === selectedSectionId) ?? -1;
  const hasPrevSection = currentSectionIndex > 0;
  const hasNextSection = epub ? currentSectionIndex < epub.sections.length - 1 : false;

  // Check if current section is Title Page
  const isTitlePage = selectedSection?.id === 'title-page' ||
    selectedSection?.title?.toLowerCase() === 'title page';

  // One-by-one: Open panel and parse issues from tool result
  const handleOneByOneOpen = useCallback(() => {
    if (!toolResult) return;
    const issues = parseToolReport(toolResult);
    if (issues.length === 0) {
      showAlert('No editable issues found in the report', 'warning', undefined, isDarkMode);
      return;
    }
    setOneByOneIssues(issues);
    setOneByOneIndex(0);
    setOneByOneActive(true);
    // Scroll to first passage
    setTimeout(() => {
      if (issues[0] && editorPanelRef.current) {
        editorPanelRef.current.scrollToPassage(issues[0].passage);
      }
    }, 100);
  }, [toolResult, isDarkMode]);

  // One-by-one: Accept current suggestion
  const handleOneByOneAccept = useCallback(async () => {
    const currentIssue = oneByOneIssues[oneByOneIndex];
    if (!currentIssue || !editorPanelRef.current || !selectedSectionId) return;

    // Get current editor content
    const content = editorPanelRef.current.getContent();

    // Check if passage exists
    if (!content.includes(currentIssue.passage)) {
      showAlert('Passage not found - may have been changed by a previous edit', 'warning', undefined, isDarkMode);
      return;
    }

    // Apply replacement
    const newContent = content.replace(currentIssue.passage, currentIssue.replacement);
    editorPanelRef.current.updateContent(newContent);

    // Mark issue as accepted
    const updatedIssues = [...oneByOneIssues];
    updatedIssues[oneByOneIndex] = { ...currentIssue, status: 'accepted' };
    setOneByOneIssues(updatedIssues);

    // Save to IndexedDB
    if (selectedSection) {
      await saveSection({
        id: selectedSectionId,
        title: selectedSection.title,
        content: newContent,
        type: selectedSection.type || 'section',
      });
      // Update in-memory epub
      if (epub) {
        const updatedSections = epub.sections.map((s) =>
          s.id === selectedSectionId ? { ...s, content: newContent } : s
        );
        setEpub({ ...epub, sections: updatedSections });
      }
    }

    // Auto-advance to next issue
    if (oneByOneIndex < oneByOneIssues.length - 1) {
      const nextIndex = oneByOneIndex + 1;
      setOneByOneIndex(nextIndex);
      // Scroll to next passage
      setTimeout(() => {
        const nextIssue = updatedIssues[nextIndex];
        if (nextIssue && editorPanelRef.current) {
          editorPanelRef.current.scrollToPassage(nextIssue.passage);
        }
      }, 100);
    }
  }, [oneByOneIssues, oneByOneIndex, selectedSectionId, selectedSection, epub, isDarkMode]);

  // One-by-one: Apply custom replacement
  const handleOneByOneCustom = useCallback(async (customText: string) => {
    const currentIssue = oneByOneIssues[oneByOneIndex];
    if (!currentIssue || !editorPanelRef.current || !selectedSectionId) return;

    // Get current editor content
    const content = editorPanelRef.current.getContent();

    // Check if passage exists
    if (!content.includes(currentIssue.passage)) {
      showAlert('Passage not found - may have been changed by a previous edit', 'warning', undefined, isDarkMode);
      return;
    }

    // Apply custom replacement
    const newContent = content.replace(currentIssue.passage, customText);
    editorPanelRef.current.updateContent(newContent);

    // Mark issue as custom
    const updatedIssues = [...oneByOneIssues];
    updatedIssues[oneByOneIndex] = { ...currentIssue, status: 'custom', customReplacement: customText };
    setOneByOneIssues(updatedIssues);

    // Save to IndexedDB
    if (selectedSection) {
      await saveSection({
        id: selectedSectionId,
        title: selectedSection.title,
        content: newContent,
        type: selectedSection.type || 'section',
      });
      // Update in-memory epub
      if (epub) {
        const updatedSections = epub.sections.map((s) =>
          s.id === selectedSectionId ? { ...s, content: newContent } : s
        );
        setEpub({ ...epub, sections: updatedSections });
      }
    }

    // Auto-advance to next issue
    if (oneByOneIndex < oneByOneIssues.length - 1) {
      const nextIndex = oneByOneIndex + 1;
      setOneByOneIndex(nextIndex);
      // Scroll to next passage
      setTimeout(() => {
        const nextIssue = updatedIssues[nextIndex];
        if (nextIssue && editorPanelRef.current) {
          editorPanelRef.current.scrollToPassage(nextIssue.passage);
        }
      }, 100);
    }
  }, [oneByOneIssues, oneByOneIndex, selectedSectionId, selectedSection, epub, isDarkMode]);

  // One-by-one: Skip current issue
  const handleOneByOneSkip = useCallback(() => {
    if (oneByOneIndex < oneByOneIssues.length - 1) {
      const nextIndex = oneByOneIndex + 1;
      setOneByOneIndex(nextIndex);
      // Scroll to next passage
      setTimeout(() => {
        const nextIssue = oneByOneIssues[nextIndex];
        if (nextIssue && editorPanelRef.current) {
          editorPanelRef.current.scrollToPassage(nextIssue.passage);
        }
      }, 100);
    }
  }, [oneByOneIndex, oneByOneIssues]);

  // One-by-one: Close panel
  const handleOneByOneClose = useCallback(() => {
    setOneByOneActive(false);
    setOneByOneIssues([]);
    setOneByOneIndex(0);
  }, []);

  // One-by-one: Navigate to previous issue
  const handleOneByOnePrev = useCallback(() => {
    if (oneByOneIndex > 0) {
      const prevIndex = oneByOneIndex - 1;
      setOneByOneIndex(prevIndex);
      // Scroll to passage
      setTimeout(() => {
        const prevIssue = oneByOneIssues[prevIndex];
        if (prevIssue && editorPanelRef.current) {
          editorPanelRef.current.scrollToPassage(prevIssue.passage);
        }
      }, 100);
    }
  }, [oneByOneIndex, oneByOneIssues]);

  // One-by-one: Navigate to next issue
  const handleOneByOneNext = useCallback(() => {
    if (oneByOneIndex < oneByOneIssues.length - 1) {
      const nextIndex = oneByOneIndex + 1;
      setOneByOneIndex(nextIndex);
      // Scroll to passage
      setTimeout(() => {
        const nextIssue = oneByOneIssues[nextIndex];
        if (nextIssue && editorPanelRef.current) {
          editorPanelRef.current.scrollToPassage(nextIssue.passage);
        }
      }, 100);
    }
  }, [oneByOneIndex, oneByOneIssues]);

  // Auto-load working copy from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      const saved = await loadFullWorkingCopy();
      if (saved) {
        // Convert FullWorkingCopy to ParsedEpub format for UI
        const epub: ParsedEpub = {
          title: saved.title,
          author: saved.author,
          language: saved.language,
          coverImage: saved.coverImage,
          sections: saved.sections.map((s) => ({
            id: s.id,
            title: s.title,
            href: `${s.id}.xhtml`, // Generate href for UI consistency
            content: s.content,
          })),
        };
        setEpub(epub);
        setSelectedSectionId(epub.sections[0]?.id ?? null);
      }
      // Also load full metadata for Title Page form
      const meta = await loadWorkingCopyMeta();
      if (meta) {
        setBookMeta(meta);
      }
    };
    loadData();
  }, []);

  // Reload Working Copy when refreshKey changes (e.g., after Chapter Writer adds a chapter)
  useEffect(() => {
    if (refreshKey === undefined || refreshKey === 0) return;

    const reloadData = async () => {
      const saved = await loadFullWorkingCopy();
      if (saved) {
        const newEpub: ParsedEpub = {
          title: saved.title,
          author: saved.author,
          language: saved.language,
          coverImage: saved.coverImage,
          sections: saved.sections.map((s) => ({
            id: s.id,
            title: s.title,
            href: `${s.id}.xhtml`,
            content: s.content,
            type: s.type,
          })),
        };
        setEpub(newEpub);

        // Select the pending section if provided
        if (pendingSectionId) {
          setSelectedSectionId(pendingSectionId);
          onPendingSectionHandled?.();
        }
      }
      // Also reload metadata
      const meta = await loadWorkingCopyMeta();
      if (meta) {
        setBookMeta(meta);
      }
    };
    reloadData();
  }, [refreshKey, pendingSectionId, onPendingSectionHandled]);

  // Handle opening an epub file
  const handleOpenEpub = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.epub';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const parsed = await parseEpub(file);
          // Clear any existing working copy first
          await clearWorkingCopy();
          // Save to IndexedDB with normalization (section-001, section-002, etc.)
          await saveFullWorkingCopy({
            title: parsed.title,
            author: parsed.author,
            language: parsed.language,
            coverImage: parsed.coverImage,
            sections: parsed.sections.map((s) => ({
              id: s.id,
              title: s.title,
              content: s.content,
            })),
          });
          // Reload from IndexedDB to get normalized IDs
          const saved = await loadFullWorkingCopy();
          if (saved) {
            const epub: ParsedEpub = {
              title: saved.title,
              author: saved.author,
              language: saved.language,
              coverImage: saved.coverImage,
              sections: saved.sections.map((s) => ({
                id: s.id,
                title: s.title,
                href: `${s.id}.xhtml`,
                content: s.content,
              })),
            };
            setEpub(epub);
            setSelectedSectionId(epub.sections[0]?.id ?? null);
          }
          // Load metadata for Title Page form
          const meta = await loadWorkingCopyMeta();
          if (meta) {
            setBookMeta(meta);
          }
        } catch (error) {
          console.error('Error parsing epub:', error);
          alert('Error parsing epub file. Please try a different file.');
        }
      }
    };
    input.click();
  };

  // Handle opening a docx file
  const handleOpenDocx = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const parsed = await parseDocx(file);
          // Clear any existing working copy first
          await clearWorkingCopy();
          // Save to IndexedDB
          await saveFullWorkingCopy({
            title: parsed.title,
            author: parsed.author,
            language: parsed.language,
            coverImage: parsed.coverImage,
            sections: parsed.sections.map((s) => ({
              id: s.id,
              title: s.title,
              content: s.content,
            })),
          });
          // Reload from IndexedDB to get normalized IDs
          const saved = await loadFullWorkingCopy();
          if (saved) {
            const loadedEpub: ParsedEpub = {
              title: saved.title,
              author: saved.author,
              language: saved.language,
              coverImage: saved.coverImage,
              sections: saved.sections.map((s) => ({
                id: s.id,
                title: s.title,
                href: `${s.id}.xhtml`,
                content: s.content,
              })),
            };
            setEpub(loadedEpub);
            setSelectedSectionId(loadedEpub.sections[0]?.id ?? null);
          }
          // Load metadata for Title Page form
          const meta = await loadWorkingCopyMeta();
          if (meta) {
            setBookMeta(meta);
          }
          showAlert(`Loaded "${parsed.title}" with ${parsed.sections.length} sections`, 'success', undefined, isDarkMode);
        } catch (error) {
          console.error('Error parsing docx:', error);
          showAlert('Error parsing DOCX file. Please try a different file.', 'error', undefined, isDarkMode);
        }
      }
    };
    input.click();
  };

  // Handle removing a section/chapter
  const handleRemoveSection = async (sectionId: string) => {
    if (!epub) return;
    const idx = epub.sections.findIndex((s) => s.id === sectionId);
    const newSections = epub.sections.filter((s) => s.id !== sectionId);

    const updatedEpub = { ...epub, sections: newSections };
    setEpub(updatedEpub);
    // Select next section, or previous, or null
    if (newSections.length > 0) {
      const newIdx = Math.min(idx, newSections.length - 1);
      const nextSection = newSections[newIdx];
      setSelectedSectionId(nextSection?.id ?? null);
    } else {
      setSelectedSectionId(null);
    }
    // Delete section from IndexedDB
    await deleteSection(sectionId);
    // Update meta with new section order
    const meta = await loadWorkingCopyMeta();
    if (meta) {
      meta.sectionIds = meta.sectionIds.filter((id) => id !== sectionId);
      await saveWorkingCopyMeta(meta);
    }
  };

  // Handle creating a new blank manuscript
  const handleNew = async () => {
    // Clear existing working copy
    await clearWorkingCopy();
    const year = new Date().getFullYear();
    // Create blank manuscript with typed sections
    const blank = {
      title: 'Untitled',
      author: 'Anonymous',
      language: 'en',
      coverImage: null,
      sections: [
        { id: 'title-page', title: 'Title Page', content: 'Untitled\n\nby Anonymous', type: 'section' as const },
        { id: 'copyright', title: 'Copyright', content: `Copyright © ${year} Anonymous\n\nAll rights reserved.\n\nThis is a work of fiction. Names, characters, places, and incidents either are the product of the author's imagination or are used fictitiously.`, type: 'section' as const },
        { id: 'chapter-1', title: 'Chapter 1', content: '', type: 'chapter' as const },
      ],
    };
    await saveFullWorkingCopy(blank);
    // Reload from IndexedDB to get normalized IDs
    const saved = await loadFullWorkingCopy();
    if (saved) {
      const newEpub: ParsedEpub = {
        title: saved.title,
        author: saved.author,
        language: saved.language,
        coverImage: saved.coverImage,
        sections: saved.sections.map((s) => ({
          id: s.id,
          title: s.title,
          href: `${s.id}.xhtml`,
          content: s.content,
          type: s.type,
        })),
      };
      setEpub(newEpub);
      setSelectedSectionId(newEpub.sections[0]?.id ?? null);
    }
    // Load metadata for Title Page form
    const meta = await loadWorkingCopyMeta();
    if (meta) {
      setBookMeta(meta);
    }
  };

  // Handle adding a new element (inserts after currently selected)
  const handleAddElement = async (elementType: ElementType) => {
    if (!epub) return;

    const meta = await loadWorkingCopyMeta();
    if (!meta) return;

    // Find next section number for ID
    const numbers = meta.sectionIds.map(id => parseInt(id.split('-')[1] || '0') || 0);
    const nextNum = Math.max(0, ...numbers) + 1;
    const newId = `section-${String(nextNum).padStart(3, '0')}`;

    // Get default title for this element type
    const defaultTitle = getDefaultTitle(elementType);

    // Create new element with appropriate defaults
    const newSection = {
      id: newId,
      title: defaultTitle,
      href: `${newId}.xhtml`,
      content: '',
      type: elementType,
    };

    // Find insert position (after currently selected, or at end)
    const currentIndex = selectedSectionId
      ? epub.sections.findIndex(s => s.id === selectedSectionId)
      : epub.sections.length - 1;
    const insertIndex = currentIndex + 1;

    // Save to IndexedDB
    await saveSection({ id: newId, title: newSection.title, content: '', type: elementType });

    // Insert into sectionIds at correct position
    meta.sectionIds.splice(insertIndex, 0, newId);
    await saveWorkingCopyMeta(meta);

    // Update UI state - insert at correct position
    const newSections = [...epub.sections];
    newSections.splice(insertIndex, 0, newSection);
    setEpub({
      ...epub,
      sections: newSections,
    });
    setSelectedSectionId(newId);
    setHasUnsavedChanges(false);
    setPendingContent('');
  };

  // Handle moving a section up (swap with previous)
  const handleMoveUp = async (sectionId: string) => {
    if (!epub) return;
    const idx = epub.sections.findIndex(s => s.id === sectionId);
    if (idx <= 0) return; // Can't move up if first or not found

    // Swap in sections array using splice (removes and returns element, then inserts)
    const newSections = [...epub.sections];
    const removed = newSections.splice(idx, 1)[0];
    if (!removed) return;
    newSections.splice(idx - 1, 0, removed);

    // Update UI state
    setEpub({ ...epub, sections: newSections });

    // Persist to IndexedDB
    const meta = await loadWorkingCopyMeta();
    if (meta) {
      const metaIdx = meta.sectionIds.indexOf(sectionId);
      if (metaIdx > 0) {
        const removedId = meta.sectionIds.splice(metaIdx, 1)[0];
        if (removedId) {
          meta.sectionIds.splice(metaIdx - 1, 0, removedId);
          await saveWorkingCopyMeta(meta);
        }
      }
    }
  };

  // Handle moving a section down (swap with next)
  const handleMoveDown = async (sectionId: string) => {
    if (!epub) return;
    const idx = epub.sections.findIndex(s => s.id === sectionId);
    if (idx < 0 || idx >= epub.sections.length - 1) return; // Can't move down if last or not found

    // Swap in sections array using splice (removes and returns element, then inserts)
    const newSections = [...epub.sections];
    const removed = newSections.splice(idx, 1)[0];
    if (!removed) return;
    newSections.splice(idx + 1, 0, removed);

    // Update UI state
    setEpub({ ...epub, sections: newSections });

    // Persist to IndexedDB
    const meta = await loadWorkingCopyMeta();
    if (meta) {
      const metaIdx = meta.sectionIds.indexOf(sectionId);
      if (metaIdx >= 0 && metaIdx < meta.sectionIds.length - 1) {
        const removedId = meta.sectionIds.splice(metaIdx, 1)[0];
        if (removedId) {
          meta.sectionIds.splice(metaIdx + 1, 0, removedId);
          await saveWorkingCopyMeta(meta);
        }
      }
    }
  };

  // Handle cover image click - open file picker to change cover
  const handleCoverClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          // Normalize filename to cover.{ext}
          const ext = file.name.split('.').pop() || 'png';
          const coverFilename = `cover.${ext}`;
          // Delete old cover first
          await deleteCoverImage();
          // Save new cover to IndexedDB with normalized name
          await saveCoverImage(file, coverFilename);
          // Update metadata with new coverImageId
          const meta = await loadWorkingCopyMeta();
          if (meta) {
            meta.coverImageId = coverFilename;
            await saveWorkingCopyMeta(meta);
          }
          // Update in-memory epub state
          if (epub) {
            setEpub({ ...epub, coverImage: file });
          }
        } catch (error) {
          console.error('Error saving cover image:', error);
          alert('Error saving cover image. Please try again.');
        }
      }
    };
    input.click();
  };

  // Handle content changes from EditorPanel
  const handleContentChange = (hasChanges: boolean, content: string) => {
    setHasUnsavedChanges(hasChanges);
    setPendingContent(content);
  };

  // Handle title changes from EditorPanel
  const handleTitleChange = (newTitle: string) => {
    setPendingTitle(newTitle);
    setHasUnsavedChanges(true);
  };

  // Handle book metadata save from TitlePagePanel
  const handleSaveBookMetadata = async (metadata: BookMetadata) => {
    if (!epub) return;

    // Update epub state (title/author for sidebar display)
    setEpub({
      ...epub,
      title: metadata.title,
      author: metadata.author,
    });

    // Save to IndexedDB and update local bookMeta state
    const meta = await loadWorkingCopyMeta();
    if (meta) {
      const updatedMeta = {
        ...meta,
        title: metadata.title,
        author: metadata.author,
        subtitle: metadata.subtitle,
        publisher: metadata.publisher,
      };
      await saveWorkingCopyMeta(updatedMeta);
      setBookMeta(updatedMeta);
    }
  };

  // Handle Save button - generate EPUB and add to library
  const handleSave = async () => {
    // 1. Save any pending editor changes first
    if (hasUnsavedChanges && selectedSection && selectedSectionId) {
      await saveCurrentSection();
    }

    // 2. Load full working copy (now includes any just-saved changes)
    const workingCopy = await loadFullWorkingCopy();
    if (!workingCopy) {
      showAlert('No manuscript to save. Please create or load a manuscript first.', 'warning', undefined, isDarkMode);
      return;
    }

    // 3. Load metadata
    const meta = await loadWorkingCopyMeta();
    if (!meta) {
      showAlert('Could not load manuscript metadata.', 'error', undefined, isDarkMode);
      return;
    }

    // 4. Load cover image (may be null)
    const coverBlob = await loadCoverImage();

    try {
      // 5. Generate EPUB
      const epubData = await generateEpubFromWorkingCopy(
        meta,
        workingCopy.sections,
        coverBlob
      );

      // 6. Create File object
      const safeTitle = (meta.title || 'manuscript').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      const filename = `${safeTitle}.epub`;
      const blob = new Blob([epubData as BlobPart], { type: 'application/epub+zip' });
      const file = new File([blob], filename, { type: 'application/epub+zip' });

      // 7. Import to e-reader library (replace existing, don't duplicate)
      const appService = await environmentConfig.getAppService();
      const books = await appService.loadLibraryBooks();

      // Delete existing working copy book if we saved before
      if (meta.libraryBookHash) {
        const existingBook = books.find(b => b.hash === meta.libraryBookHash);
        if (existingBook) {
          await appService.deleteBook(existingBook, 'local');
          // Remove from books array
          const idx = books.indexOf(existingBook);
          if (idx > -1) books.splice(idx, 1);
        }
      }

      // Import new version
      const book = await appService.importBook(file, books);
      if (book) {
        // Store new hash in meta for next save
        meta.libraryBookHash = book.hash;
        await saveWorkingCopyMeta(meta);
        await appService.saveLibraryBooks(books);

        await Swal.fire({
          title: 'Saved!',
          text: `"${meta.title}" saved to Library. You can read it in the Library.`,
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#28a745',
          background: isDarkMode ? '#222' : '#fff',
          color: isDarkMode ? '#fff' : '#333',
          customClass: {
            container: 'swal-above-modal'
          }
        });
      } else {
        showAlert('EPUB was generated but could not be added to library.', 'error', undefined, isDarkMode);
      }
    } catch (error) {
      console.error('Error saving manuscript:', error);
      showAlert(`Error saving manuscript: ${(error as Error).message}`, 'error', undefined, isDarkMode);
    }
  };

  // Handle section selection with unsaved changes check
  const handleSelectSection = (sectionId: string) => {
    if (sectionId === selectedSectionId) return; // Same section, no action needed

    if (hasUnsavedChanges) {
      // Show dialog instead of switching immediately
      setPendingSectionSwitch(sectionId);
      setShowUnsavedDialog(true);
    } else {
      setSelectedSectionId(sectionId);
    }
  };

  // Navigate to previous section (reuses handleSelectSection for unsaved changes check)
  const handlePrevSection = () => {
    if (!epub || currentSectionIndex <= 0) return;
    const prevSection = epub.sections[currentSectionIndex - 1];
    if (prevSection) handleSelectSection(prevSection.id);
  };

  // Navigate to next section (reuses handleSelectSection for unsaved changes check)
  const handleNextSection = () => {
    if (!epub || currentSectionIndex >= epub.sections.length - 1) return;
    const nextSection = epub.sections[currentSectionIndex + 1];
    if (nextSection) handleSelectSection(nextSection.id);
  };

  // Save current section to IndexedDB
  const saveCurrentSection = async () => {
    if (!selectedSection || !selectedSectionId) return;

    // Use pending title if changed, otherwise original
    const titleToSave = pendingTitle || selectedSection.title;
    // Use pending content if set, otherwise original
    const contentToSave = pendingContent || selectedSection.content;

    // Save to IndexedDB
    await saveSection({
      id: selectedSectionId,
      title: titleToSave,
      content: contentToSave,
      type: selectedSection.type || 'section',
    });

    // Update in-memory epub state so sidebar and subsequent comparisons work
    if (epub) {
      const updatedSections = epub.sections.map((s) =>
        s.id === selectedSectionId ? { ...s, title: titleToSave, content: contentToSave } : s
      );
      setEpub({ ...epub, sections: updatedSections });
    }

    // Reset unsaved state
    setHasUnsavedChanges(false);
    setPendingContent('');
    setPendingTitle('');
  };

  // Debounced auto-save: saves 2 seconds after user stops typing
  useEffect(() => {
    if (!hasUnsavedChanges || !selectedSectionId) return;

    const timer = setTimeout(async () => {
      await saveCurrentSection();
    }, 2000);

    return () => clearTimeout(timer);
  }, [pendingContent, pendingTitle, hasUnsavedChanges, selectedSectionId, saveCurrentSection]);

  // Dialog action: Save changes and switch
  const handleDialogSave = async () => {
    await saveCurrentSection();
    setShowUnsavedDialog(false);
    if (pendingSectionSwitch) {
      setSelectedSectionId(pendingSectionSwitch);
      setPendingSectionSwitch(null);
    }
  };

  // Dialog action: Discard changes and switch
  const handleDialogDiscard = () => {
    setHasUnsavedChanges(false);
    setPendingContent('');
    setPendingTitle('');
    setShowUnsavedDialog(false);
    if (pendingSectionSwitch) {
      setSelectedSectionId(pendingSectionSwitch);
      setPendingSectionSwitch(null);
    }
  };

  // Dialog action: Cancel (stay on current section)
  const handleDialogCancel = () => {
    setShowUnsavedDialog(false);
    setPendingSectionSwitch(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <AuthorsHeader
        theme={theme}
        isDarkMode={isDarkMode}
        onThemeToggle={onThemeToggle}
        onAboutClick={onAboutClick}
        onStorageClick={onStorageClick}
        onFilesClick={onFilesClick}
        onKeyClick={onKeyClick}
        onModelsClick={onModelsClick}
        onEditorClick={onEditorClick}
        onChatClick={onChatClick}
        onNewClick={handleNew}
        onOpenClick={handleOpenEpub}
        onOpenDocxClick={handleOpenDocx}
        onLoadFromLibraryClick={onLoadFromLibraryClick}
        onSaveClick={handleSave}
        hasApiKey={hasApiKey}
        currentModel={currentModel}
        currentProvider={currentProvider}
        toolExecuting={toolExecuting}
      />

      {/* Main content: 2-panel layout */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left sidebar - Chapter navigation (collapsible) */}
        {sidebarVisible && (
          <ChapterSidebar
            theme={theme}
            isDarkMode={isDarkMode}
            bookTitle={epub?.title ?? 'No Book Loaded'}
            authorName={epub?.author ?? ''}
            coverImage={epub?.coverImage ?? null}
            sections={epub?.sections.map((s) => ({ id: s.id, title: s.title })) ?? []}
            selectedSectionId={selectedSectionId}
            totalWordCount={totalWordCount}
            onSelectSection={handleSelectSection}
            onRemoveSection={handleRemoveSection}
            onCoverClick={handleCoverClick}
            onAddElement={handleAddElement}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            toolExecuting={toolExecuting}
          />
        )}

        {/* Right panel - Editor or Title Page Form */}
        {isTitlePage ? (
          <TitlePagePanel
            theme={theme}
            isDarkMode={isDarkMode}
            onToggleSidebar={onToggleSidebar}
            initialMetadata={{
              title: bookMeta?.title ?? epub?.title ?? '',
              subtitle: bookMeta?.subtitle ?? '',
              author: bookMeta?.author ?? epub?.author ?? '',
              publisher: bookMeta?.publisher ?? '',
            }}
            onSave={handleSaveBookMetadata}
          />
        ) : (
          <EditorPanel
            ref={editorPanelRef}
            theme={theme}
            isDarkMode={isDarkMode}
            onToggleSidebar={onToggleSidebar}
            onAIWritingClick={onAIWritingClick}
            hasApiKey={hasApiKey}
            sectionTitle={selectedSection?.title ?? ''}
            sectionContent={selectedSection?.content ?? ''}
            sectionType={selectedSection?.type}
            sectionWordCount={sectionWordCount}
            onContentChange={handleContentChange}
            onTitleChange={handleTitleChange}
            onPrevSection={handlePrevSection}
            onNextSection={handleNextSection}
            hasPrevSection={hasPrevSection}
            hasNextSection={hasNextSection}
            selectedCategory={selectedCategory}
            selectedTool={selectedTool}
            toolsInCategory={toolsInCategory}
            toolsReady={toolsReady}
            toolExecuting={toolExecuting}
            toolResult={toolResult}
            elapsedTime={elapsedTime}
            toolJustFinished={toolJustFinished}
            manuscriptContent={manuscriptContent}
            onCategoryChange={onCategoryChange}
            onToolChange={onToolChange}
            onClearTool={onClearTool}
            onPromptEdit={onPromptEdit}
            onExecuteTool={() => {
              // Get current editor text (pending edits or original)
              const currentText = pendingContent || selectedSection?.content || '';
              onExecuteTool(currentText);
            }}
            onReport={onReport}
            onOneByOne={handleOneByOneOpen}
            isLoadingPrompt={isLoadingPrompt}
            // One-by-one inline panel props
            oneByOneActive={oneByOneActive}
            oneByOneIssues={oneByOneIssues}
            oneByOneIndex={oneByOneIndex}
            onOneByOneAccept={handleOneByOneAccept}
            onOneByOneCustom={handleOneByOneCustom}
            onOneByOneSkip={handleOneByOneSkip}
            onOneByOneClose={handleOneByOneClose}
            onOneByOnePrev={handleOneByOnePrev}
            onOneByOneNext={handleOneByOneNext}
          />
        )}
      </div>

      {/* Unsaved Changes Dialog */}
      {showUnsavedDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={handleDialogCancel}
        >
          <div
            style={{
              backgroundColor: theme.bg,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              padding: '20px',
              minWidth: '300px',
              maxWidth: '400px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', color: theme.text, fontSize: '16px' }}>
              Unsaved Changes
            </h3>
            <p style={{ margin: '0 0 20px 0', color: theme.textMuted, fontSize: '14px' }}>
              You have unsaved changes.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDialogCancel}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDialogDiscard}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Discard
              </button>
              <button
                onClick={handleDialogSave}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
