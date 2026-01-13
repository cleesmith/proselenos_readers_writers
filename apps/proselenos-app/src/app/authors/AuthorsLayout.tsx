// app/authors/AuthorsLayout.tsx

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert } from '../shared/alerts';
import Swal from 'sweetalert2';
import AuthorsHeader from './AuthorsHeader';
import ChapterSidebar from './ChapterSidebar';
import EditorPanel, { EditorPanelRef } from './EditorPanel';
import { ElementType, getDefaultTitle, PROTECTED_SECTION_IDS, PROTECTED_SECTION_COUNT, getSectionNumber, isFloatingType } from './elementTypes';

// Treat 'section', undefined, and floating types as 'chapter' for boundary checks
// This ensures items that render in the Chapters area behave as chapters
// Matches sidebar behavior where floating types (section 0) go to Chapters
function getEffectiveSectionNumber(type: ElementType | undefined): number {
  if (!type || type === 'section') return 4; // Treat as chapter
  const num = getSectionNumber(type);
  return num === 0 ? 4 : num; // Floating types also go to Chapters
}

// Reorder sections array to match visual grouping (Required, Front Matter, Introductory, Chapters, Back Matter)
// This ensures array neighbors match visual neighbors for move up/down
function reorderSectionsByVisualGroup<T extends { type?: ElementType }>(sections: T[]): T[] {
  const required = sections.slice(0, PROTECTED_SECTION_COUNT);
  const rest = sections.slice(PROTECTED_SECTION_COUNT);

  const groups = new Map<number, T[]>();
  for (const s of rest) {
    const num = getEffectiveSectionNumber(s.type);
    if (!groups.has(num)) groups.set(num, []);
    groups.get(num)!.push(s);
  }

  // Return in visual order: Required, Front Matter (2), Introductory (3), Chapters (4), Back Matter (5), No Matter (6)
  return [
    ...required,
    ...(groups.get(2) || []),
    ...(groups.get(3) || []),
    ...(groups.get(4) || []),
    ...(groups.get(5) || []),
    ...(groups.get(6) || []),
  ];
}
import TitlePagePanel, { BookMetadata } from './TitlePagePanel';
import { parseEpub, ParsedEpub } from '@/services/epubService';
import { parseDocx } from '@/services/docxService';
import { countWords } from '@/services/htmlExtractor';
import { loadFullWorkingCopy, saveFullWorkingCopy, deleteSection, saveWorkingCopyMeta, loadWorkingCopyMeta, clearWorkingCopy, saveSection, saveCoverImage, deleteCoverImage, loadCoverImage, WorkingCopyMeta, saveManuscriptImage, deleteManuscriptImage, getAllManuscriptImages } from '@/services/manuscriptStorage';
import { generateEpubFromWorkingCopy } from '@/lib/epub-generator';
import { generateHtmlFromSections, openHtmlInNewTab } from '@/lib/html-generator';
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
  onCoverClick: () => void;
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
  onCoverClick,
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

  // Full-text search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ sectionId: string; sectionTitle: string; matchIndex: number; matchText: string; contextBefore: string; contextAfter: string }[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchActive, setSearchActive] = useState(false);
  const [sectionsWithMatches, setSectionsWithMatches] = useState<Set<string>>(new Set());

  // Inline images state
  const [manuscriptImages, setManuscriptImages] = useState<Array<{filename: string, blob: Blob}>>([]);
  const [imageUrls, setImageUrls] = useState<Array<{filename: string, url: string}>>([]);

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

  // Full-text search: perform search across all sections
  const performSearch = useCallback((query: string) => {
    if (!epub || !query.trim()) {
      setSearchResults([]);
      setSearchActive(false);
      setSectionsWithMatches(new Set());
      return;
    }

    const results: typeof searchResults = [];
    const matchingSections = new Set<string>();
    const lowerQuery = query.toLowerCase();
    const maxResults = 100;

    for (const section of epub.sections) {
      // Search in title
      const titleLower = section.title.toLowerCase();
      let titleIndex = titleLower.indexOf(lowerQuery);
      while (titleIndex !== -1 && results.length < maxResults) {
        matchingSections.add(section.id);
        results.push({
          sectionId: section.id,
          sectionTitle: section.title,
          matchIndex: titleIndex,
          matchText: section.title.substring(titleIndex, titleIndex + query.length),
          contextBefore: '[Title] ' + section.title.substring(Math.max(0, titleIndex - 20), titleIndex),
          contextAfter: section.title.substring(titleIndex + query.length, titleIndex + query.length + 20),
        });
        titleIndex = titleLower.indexOf(lowerQuery, titleIndex + 1);
      }

      // Search in content
      const contentLower = section.content.toLowerCase();
      let contentIndex = contentLower.indexOf(lowerQuery);
      while (contentIndex !== -1 && results.length < maxResults) {
        matchingSections.add(section.id);
        const contextStart = Math.max(0, contentIndex - 50);
        const contextEnd = Math.min(section.content.length, contentIndex + query.length + 50);
        results.push({
          sectionId: section.id,
          sectionTitle: section.title,
          matchIndex: contentIndex,
          matchText: section.content.substring(contentIndex, contentIndex + query.length),
          contextBefore: section.content.substring(contextStart, contentIndex).replace(/\n/g, ' '),
          contextAfter: section.content.substring(contentIndex + query.length, contextEnd).replace(/\n/g, ' '),
        });
        contentIndex = contentLower.indexOf(lowerQuery, contentIndex + 1);
      }

      if (results.length >= maxResults) break;
    }

    setSearchResults(results);
    setCurrentSearchIndex(0);
    setSearchActive(results.length > 0);
    setSectionsWithMatches(matchingSections);
  }, [epub]);

  // Search handlers
  const handleSearchSubmit = useCallback(() => {
    performSearch(searchQuery);
  }, [searchQuery, performSearch]);

  const handleSearchClose = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchActive(false);
    setCurrentSearchIndex(0);
    setSectionsWithMatches(new Set());
  }, []);

  const handleSearchPrev = useCallback(() => {
    if (currentSearchIndex > 0) {
      setCurrentSearchIndex(currentSearchIndex - 1);
    }
  }, [currentSearchIndex]);

  const handleSearchNext = useCallback(() => {
    if (currentSearchIndex < searchResults.length - 1) {
      setCurrentSearchIndex(currentSearchIndex + 1);
    }
  }, [currentSearchIndex, searchResults.length]);

  const handleSearchNavigate = useCallback((result: typeof searchResults[0], index: number) => {
    setCurrentSearchIndex(index);
    setSelectedSectionId(result.sectionId);
    // Scroll to match after section loads
    setTimeout(() => {
      if (editorPanelRef.current) {
        editorPanelRef.current.scrollToPassage(result.matchText, result.matchIndex);
      }
    }, 100);
  }, []);

  // Auto-navigate to search result when search is performed or index changes
  useEffect(() => {
    if (searchActive && searchResults.length > 0) {
      const result = searchResults[currentSearchIndex];
      if (result) {
        setSelectedSectionId(result.sectionId);
        setTimeout(() => {
          if (editorPanelRef.current) {
            editorPanelRef.current.scrollToPassage(result.matchText, result.matchIndex);
          }
        }, 100);
      }
    }
  }, [searchActive, searchResults, currentSearchIndex]);

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
            type: s.type,
          })),
        };
        setEpub(epub);
        setSelectedSectionId(epub.sections[0]?.id ?? null);
      } else {
        // No existing book - auto-create a new blank manuscript
        // First 3 sections (Cover, Title Page, Copyright) are protected - cannot be deleted or moved
        await clearWorkingCopy();
        const year = new Date().getFullYear();
        const blank = {
          title: 'Untitled',
          author: 'Anonymous',
          language: 'en',
          coverImage: null,
          sections: [
            { id: 'cover', title: 'Cover', content: 'Use Format > Image to add your cover image', type: 'cover' as const },
            { id: 'title-page', title: 'Title Page', content: 'Untitled\n\nby Anonymous', type: 'title-page' as const },
            { id: 'copyright', title: 'Copyright', content: `Copyright © ${year} by Anonymous\n\nAll rights reserved.\n\nNo part of this book may be reproduced in any form or by any electronic or mechanical means, including information storage and retrieval systems, without written permission from the author, except for the use of brief quotations in a book review.`, type: 'copyright' as const },
            { id: 'chapter-1', title: 'Chapter 1', content: '', type: 'chapter' as const },
          ],
        };
        await saveFullWorkingCopy(blank);
        // Reload from IndexedDB to get normalized IDs
        const newSaved = await loadFullWorkingCopy();
        if (newSaved) {
          const newEpub: ParsedEpub = {
            title: newSaved.title,
            author: newSaved.author,
            language: newSaved.language,
            coverImage: newSaved.coverImage,
            sections: newSaved.sections.map((s) => ({
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
        const newMeta = await loadWorkingCopyMeta();
        if (newMeta) {
          setBookMeta(newMeta);
        }
        return;
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

  // Load manuscript images on mount and when bookMeta changes
  useEffect(() => {
    const loadImages = async () => {
      const images = await getAllManuscriptImages();
      setManuscriptImages(images);

      // Create object URLs for display (revoke old ones first)
      imageUrls.forEach(img => URL.revokeObjectURL(img.url));
      const urls = images.map(img => ({
        filename: img.filename,
        url: URL.createObjectURL(img.blob)
      }));
      setImageUrls(urls);
    };
    loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookMeta]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      imageUrls.forEach(img => URL.revokeObjectURL(img.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Image upload handler
  const handleImageUpload = useCallback(async (file: File) => {
    // Generate unique filename if needed
    let filename = file.name;
    const existingNames = manuscriptImages.map(i => i.filename);
    if (existingNames.includes(filename)) {
      const ext = filename.split('.').pop();
      const base = filename.slice(0, -(ext?.length || 0) - 1);
      let counter = 1;
      while (existingNames.includes(`${base}-${counter}.${ext}`)) {
        counter++;
      }
      filename = `${base}-${counter}.${ext}`;
    }

    // Save to IndexedDB
    await saveManuscriptImage(filename, file);

    // Update meta with new imageId
    if (bookMeta) {
      const newImageIds = [...(bookMeta.imageIds || []), filename];
      const updatedMeta = { ...bookMeta, imageIds: newImageIds };
      await saveWorkingCopyMeta(updatedMeta);
      setBookMeta(updatedMeta);
    }

    // Reload images to update UI
    const images = await getAllManuscriptImages();
    setManuscriptImages(images);
    imageUrls.forEach(img => URL.revokeObjectURL(img.url));
    const urls = images.map(img => ({
      filename: img.filename,
      url: URL.createObjectURL(img.blob)
    }));
    setImageUrls(urls);
  }, [manuscriptImages, bookMeta, imageUrls]);

  // Image delete handler
  const handleImageDelete = useCallback(async (filename: string) => {
    // Delete from IndexedDB
    await deleteManuscriptImage(filename);

    // Update meta
    if (bookMeta) {
      const newImageIds = (bookMeta.imageIds || []).filter(id => id !== filename);
      const updatedMeta = { ...bookMeta, imageIds: newImageIds };
      await saveWorkingCopyMeta(updatedMeta);
      setBookMeta(updatedMeta);
    }

    // Reload images
    const images = await getAllManuscriptImages();
    setManuscriptImages(images);
    imageUrls.forEach(img => URL.revokeObjectURL(img.url));
    const urls = images.map(img => ({
      filename: img.filename,
      url: URL.createObjectURL(img.blob)
    }));
    setImageUrls(urls);
  }, [bookMeta, imageUrls]);

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

          // Save extracted inline images to IndexedDB
          const imageIds: string[] = [];
          if (parsed.images && parsed.images.length > 0) {
            for (const img of parsed.images) {
              await saveManuscriptImage(img.filename, img.blob);
              imageIds.push(img.filename);
            }
          }

          // Save to IndexedDB with normalization (section-001, section-002, etc.)
          // Filter out table-of-contents - it gets auto-generated on "send Ebook"
          await saveFullWorkingCopy({
            title: parsed.title,
            author: parsed.author,
            language: parsed.language,
            coverImage: parsed.coverImage,
            sections: parsed.sections
              .filter((s) => s.type !== 'table-of-contents')
              .map((s) => ({
                id: s.id,
                title: s.title,
                content: s.content,
                type: s.type,
              })),
          });

          // Update metadata with imageIds
          const existingMeta = await loadWorkingCopyMeta();
          if (existingMeta) {
            await saveWorkingCopyMeta({ ...existingMeta, imageIds });
          }

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
                type: s.type,
              })),
              images: parsed.images, // Pass through for immediate access
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
          // Filter out table-of-contents - it gets auto-generated on "send Ebook"
          await saveFullWorkingCopy({
            title: parsed.title,
            author: parsed.author,
            language: parsed.language,
            coverImage: parsed.coverImage,
            sections: parsed.sections
              .filter((s) => s.type !== 'table-of-contents')
              .map((s) => ({
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
                type: s.type,
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
    // Don't allow deletion of protected sections (Cover, Title Page, Copyright)
    if ((PROTECTED_SECTION_IDS as readonly string[]).includes(sectionId)) return;

    // Find the section to delete
    const sectionToDelete = epub.sections.find(s => s.id === sectionId);
    if (!sectionToDelete) return;

    // Don't allow deletion of the last chapter (includes 'section' and undefined types that behave as chapters)
    const sectionIdx = epub.sections.findIndex(s => s.id === sectionId);
    if (getEffectiveSectionNumber(sectionToDelete.type) === 4 && sectionIdx >= PROTECTED_SECTION_COUNT) {
      // Count all items in the Chapters area (effective section 4)
      const chapterCount = epub.sections.filter((s, index) =>
        index >= PROTECTED_SECTION_COUNT && getEffectiveSectionNumber(s.type) === 4
      ).length;
      if (chapterCount <= 1) {
        await showAlert('Cannot delete the last chapter. A book must have at least one chapter.', 'warning', undefined, isDarkMode);
        return;
      }
    }

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
    // First 3 sections (Cover, Title Page, Copyright) are protected - cannot be deleted or moved
    const blank = {
      title: 'Untitled',
      author: 'Anonymous',
      language: 'en',
      coverImage: null,
      sections: [
        { id: 'cover', title: 'Cover', content: 'Use Format > Image to add your cover image', type: 'cover' as const },
        { id: 'title-page', title: 'Title Page', content: 'Untitled\n\nby Anonymous', type: 'title-page' as const },
        { id: 'copyright', title: 'Copyright', content: `Copyright © ${year} by Anonymous\n\nAll rights reserved.\n\nNo part of this book may be reproduced in any form or by any electronic or mechanical means, including information storage and retrieval systems, without written permission from the author, except for the use of brief quotations in a book review.`, type: 'copyright' as const },
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

  // Helper to find the correct insertion index for a section type
  const findSectionInsertIndex = (sections: Array<{ id: string; type?: ElementType }>, targetSection: number): number => {
    // Find the last element of this section, or the correct insertion point
    let lastIndexOfSection = -1;
    let firstIndexAfterSection = sections.length;

    for (let i = PROTECTED_SECTION_COUNT; i < sections.length; i++) {
      const section = sections[i];
      if (!section) continue;
      const sectionType = section.type || 'section';
      const sec = getSectionNumber(sectionType);
      if (sec === targetSection) {
        lastIndexOfSection = i;
      } else if (sec > targetSection && !isFloatingType(sectionType)) {
        firstIndexAfterSection = i;
        break;
      }
    }

    if (lastIndexOfSection >= 0) {
      return lastIndexOfSection + 1; // After last element of section
    }
    return firstIndexAfterSection; // Before first element of next section
  };

  // Handle adding a new element (smart insertion based on element type)
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

    // Find insert position based on element type
    let insertIndex: number;
    let actualType = elementType;
    const sectionNum = getSectionNumber(elementType);

    if (sectionNum === 0) {
      // Floating type (e.g., 'uncategorized'): insert after current selection
      // and adopt the type of that area so it groups correctly
      const currentIndex = selectedSectionId
        ? epub.sections.findIndex(s => s.id === selectedSectionId)
        : epub.sections.length - 1;
      insertIndex = Math.max(currentIndex + 1, PROTECTED_SECTION_COUNT);

      // Determine which area the current selection is in and adopt that type
      const currentSection = epub.sections[Math.min(currentIndex, epub.sections.length - 1)];
      const currentArea = currentSection ? getEffectiveSectionNumber(currentSection.type) : 4;
      const areaTypeMap: Record<number, ElementType> = {
        2: 'dedication',    // Front Matter
        3: 'introduction',  // Introductory
        4: 'chapter',       // Chapters
        5: 'afterword',     // Back Matter
        6: 'no-matter',     // No Matter
      };
      actualType = areaTypeMap[currentArea] || 'chapter';
    } else {
      // Section-specific type: insert at end of its section
      insertIndex = findSectionInsertIndex(epub.sections, sectionNum);
    }

    // Create new element with appropriate defaults
    const newSection = {
      id: newId,
      title: defaultTitle,
      href: `${newId}.xhtml`,
      content: '',
      type: actualType,
    };

    // Save to IndexedDB
    await saveSection({ id: newId, title: newSection.title, content: '', type: actualType });

    // Insert into sectionIds at correct position
    meta.sectionIds.splice(insertIndex, 0, newId);
    await saveWorkingCopyMeta(meta);

    // Update UI state - insert at correct position then reorder to match visual grouping
    const newSections = [...epub.sections];
    newSections.splice(insertIndex, 0, newSection);
    const reorderedSections = reorderSectionsByVisualGroup(newSections);

    // Update meta.sectionIds to match reordered sections
    meta.sectionIds = reorderedSections.map(s => s.id);
    await saveWorkingCopyMeta(meta);

    setEpub({
      ...epub,
      sections: reorderedSections,
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
    // Can't move if in protected zone or would enter protected zone
    if (idx <= PROTECTED_SECTION_COUNT) return;

    const currentSection = epub.sections[idx];
    if (!currentSection) return;
    const targetIdx = idx - 1;

    // Can't move into Required area (indices 0, 1, 2)
    if (targetIdx < PROTECTED_SECTION_COUNT) return;

    // Section boundary check using effective section numbers
    // This treats 'section' and undefined as 'chapter' so they can move together
    const currentEffectiveSection = getEffectiveSectionNumber(currentSection.type);
    const targetSection = epub.sections[targetIdx];
    if (!targetSection) return;
    const targetEffectiveSection = getEffectiveSectionNumber(targetSection.type);

    // Block move if crossing into a different effective section
    if (currentEffectiveSection !== targetEffectiveSection) {
      return; // Can't cross section boundary
    }

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
    // Can't move if in protected zone
    if (idx < PROTECTED_SECTION_COUNT) return;

    const currentSection = epub.sections[idx];
    if (!currentSection) return;
    const targetIdx = idx + 1;

    // Section boundary check using effective section numbers
    // This treats 'section' and undefined as 'chapter' so they can move together
    const currentEffectiveSection = getEffectiveSectionNumber(currentSection.type);
    const targetSection = epub.sections[targetIdx];
    if (!targetSection) return;
    const targetEffectiveSection = getEffectiveSectionNumber(targetSection.type);

    // Block move if crossing into a different effective section
    if (currentEffectiveSection !== targetEffectiveSection) {
      return; // Can't cross section boundary
    }

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

  // Handle moving a section to a different area (Front Matter, Introductory, Chapters, Back Matter)
  const handleMoveToArea = async (sectionId: string, area: number) => {
    if (!epub) return;
    const idx = epub.sections.findIndex(s => s.id === sectionId);
    if (idx < 0) return;

    // Can't move protected sections (first 3)
    if (idx < PROTECTED_SECTION_COUNT) return;

    // Map area number to type
    const areaTypeMap: Record<number, ElementType> = {
      2: 'dedication',    // Front Matter
      3: 'introduction',  // Introductory
      4: 'chapter',       // Chapters
      5: 'afterword',     // Back Matter
      6: 'no-matter',     // No Matter
    };

    const newType = areaTypeMap[area];
    if (!newType) return;

    // Update section type (keep original title)
    const section = epub.sections[idx];
    if (!section) return;
    const updatedSection = { ...section, type: newType };

    // Update in epub state and reorder to match visual grouping
    const newSections = [...epub.sections];
    newSections[idx] = updatedSection;
    const reorderedSections = reorderSectionsByVisualGroup(newSections);
    setEpub({ ...epub, sections: reorderedSections });

    // Persist section type to IndexedDB
    await saveSection({
      id: sectionId,
      title: updatedSection.title,
      content: updatedSection.content || '',
      type: newType,
    });

    // Update meta.sectionIds to match reordered sections
    const meta = await loadWorkingCopyMeta();
    if (meta) {
      meta.sectionIds = reorderedSections.map(s => s.id);
      await saveWorkingCopyMeta(meta);
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

    // 5. Reorder sections to match visual grouping (sidebar order)
    // This ensures EPUB has same order as what user sees in Authors mode
    const orderedSections = reorderSectionsByVisualGroup(workingCopy.sections);

    try {
      // 6. Generate EPUB (include inline images)
      const epubData = await generateEpubFromWorkingCopy(
        meta,
        orderedSections,
        coverBlob,
        manuscriptImages
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

        // Tell Library tab to reload (if open)
        const channel = new BroadcastChannel('everythingebooks-library');
        channel.postMessage('reload');
        channel.close();

        await Swal.fire({
          title: 'Saved!',
          html: `"${meta.title}" saved to Library.<br>You can read it in the Library.`,
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

  // Handle HTML export - download manuscript as single-page HTML
  const handleHtmlExport = async () => {
    // 1. Save any pending editor changes first
    if (hasUnsavedChanges && selectedSection && selectedSectionId) {
      await saveCurrentSection();
    }

    // 2. Load full working copy
    const workingCopy = await loadFullWorkingCopy();
    if (!workingCopy) {
      showAlert('No manuscript to export. Please create or load a manuscript first.', 'warning', undefined, isDarkMode);
      return;
    }

    // 3. Load metadata for author info
    const meta = await loadWorkingCopyMeta();

    try {
      // 4. Load images and convert to base64 data URLs
      const manuscriptImages = await getAllManuscriptImages();
      const imagesMap = new Map<string, string>();

      for (const img of manuscriptImages) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(img.blob);
        });
        imagesMap.set(img.filename, dataUrl);
      }

      // Also load cover image (stored separately with different key pattern)
      if (meta?.coverImageId) {
        const coverBlob = await loadCoverImage();
        if (coverBlob) {
          const coverDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(coverBlob);
          });
          imagesMap.set(meta.coverImageId, coverDataUrl);
        }
      }

      // 5. Generate HTML with embedded images
      const html = generateHtmlFromSections({
        title: workingCopy.title || 'Untitled',
        author: workingCopy.author || meta?.author || 'Unknown Author',
        year: new Date().getFullYear().toString(),
        sections: workingCopy.sections.map(s => ({
          title: s.title,
          content: s.content,
        })),
        images: imagesMap,
      });

      // 6. Open in new tab
      openHtmlInNewTab(html);

      showAlert('HTML opened in new tab!', 'success', undefined, isDarkMode);
    } catch (error) {
      console.error('Error exporting HTML:', error);
      showAlert(`Error exporting HTML: ${(error as Error).message}`, 'error', undefined, isDarkMode);
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
        onSearchClose={handleSearchClose}
        onCoverClick={onCoverClick}
        onHtmlExportClick={handleHtmlExport}
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
            sections={epub?.sections.map((s) => ({ id: s.id, title: s.title, type: s.type })) ?? []}
            selectedSectionId={selectedSectionId}
            totalWordCount={totalWordCount}
            onSelectSection={handleSelectSection}
            onRemoveSection={handleRemoveSection}
            onCoverClick={handleCoverClick}
            onAddElement={handleAddElement}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onMoveToArea={handleMoveToArea}
            toolExecuting={toolExecuting}
            isLastChapter={(() => {
              if (!selectedSectionId || !epub) return false;
              const selectedIdx = epub.sections.findIndex(s => s.id === selectedSectionId);
              if (selectedIdx < PROTECTED_SECTION_COUNT) return false;
              const selectedSection = epub.sections[selectedIdx];
              // Check if selected is effectively a chapter (section 4)
              if (getEffectiveSectionNumber(selectedSection?.type) !== 4) return false;
              // Count all items in the Chapters area
              const chapterCount = epub.sections.filter((s, index) =>
                index >= PROTECTED_SECTION_COUNT && getEffectiveSectionNumber(s.type) === 4
              ).length;
              return chapterCount <= 1;
            })()}
            existingTypes={epub?.sections.map(s => s.type).filter((t): t is ElementType => !!t) ?? []}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
            onSearchClose={handleSearchClose}
            searchResultCount={searchResults.length}
            sectionsWithMatches={sectionsWithMatches}
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
            currentModel={currentModel}
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
            // Search panel props
            searchActive={searchActive}
            searchResults={searchResults}
            currentSearchIndex={currentSearchIndex}
            searchQuery={searchQuery}
            onSearchNavigate={handleSearchNavigate}
            onSearchPrev={handleSearchPrev}
            onSearchNext={handleSearchNext}
            onSearchClose={handleSearchClose}
            // Image picker props
            images={imageUrls}
            onImageUpload={handleImageUpload}
            onImageDelete={handleImageDelete}
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
