// app/authors/ChapterSidebar.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { PiMinus, PiCaretUp, PiCaretDown, PiArrowsDownUp } from 'react-icons/pi';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { showConfirm } from '../shared/alerts';
import ElementPickerDropdown from './ElementPickerDropdown';
import {
  ElementType,
  PROTECTED_SECTION_IDS,
  PROTECTED_SECTION_COUNT,
  getSectionNumber,
  SECTION_NAMES,
} from './elementTypes';

interface Section {
  id: string;
  title: string;
  type?: ElementType;
}

interface ChapterSidebarProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  bookTitle: string;
  authorName: string;
  coverImage: Blob | null;
  sections: Section[];
  selectedSectionId: string | null;
  totalWordCount: number;
  onSelectSection: (id: string) => void;
  onRemoveSection: (id: string) => void;
  onCoverClick?: () => void;
  onAddElement?: (elementType: ElementType) => void;
  onMoveUp?: (sectionId: string) => void;
  onMoveDown?: (sectionId: string) => void;
  onMoveToArea?: (sectionId: string, area: number) => void; // Move section to different area
  toolExecuting?: boolean; // When true, disable all interactive elements
  existingTypes?: ElementType[]; // Types already in manuscript (for add element filtering)
  isLastChapter?: boolean; // True if selected section is the last chapter
  // Search props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchSubmit?: () => void;
  onSearchClose?: () => void;
  searchResultCount?: number;
  sectionsWithMatches?: Set<string>;
}

export default function ChapterSidebar({
  theme,
  isDarkMode,
  bookTitle,
  authorName,
  coverImage,
  sections,
  selectedSectionId,
  totalWordCount,
  onSelectSection,
  onRemoveSection,
  onCoverClick,
  onAddElement,
  onMoveUp,
  onMoveDown,
  onMoveToArea,
  toolExecuting = false,
  existingTypes = [],
  isLastChapter = false,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
  onSearchClose,
  searchResultCount = 0,
  sectionsWithMatches,
}: ChapterSidebarProps) {
  const sidebarBg = isDarkMode ? '#252525' : '#ffffff';
  const borderColor = isDarkMode ? '#404040' : '#e5e5e5';
  const selectedBg = isDarkMode ? '#3a3a5c' : '#e8e8f4';
  const mutedText = isDarkMode ? '#888' : '#666';
  const [moveDropdownOpen, setMoveDropdownOpen] = useState(false);
  const moveDropdownRef = useRef<HTMLDivElement>(null);

  // Close Move dropdown when clicking outside
  useEffect(() => {
    if (!moveDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (moveDropdownRef.current && !moveDropdownRef.current.contains(e.target as Node)) {
        setMoveDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moveDropdownOpen]);

  // Create object URL for cover image
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!coverImage) {
      setCoverUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverImage);
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverImage]);

  // Check if selected section is protected (Cover, Title Page, Copyright)
  const isProtectedSection = !!(selectedSectionId &&
    (PROTECTED_SECTION_IDS as readonly string[]).includes(selectedSectionId));

  const handleRemove = async () => {
    if (!selectedSectionId) return;
    // Don't allow deletion of protected sections
    if (isProtectedSection) return;
    const section = sections.find((s) => s.id === selectedSectionId);
    const confirmed = await showConfirm(
      `Remove "${section?.title}"?`,
      isDarkMode,
      'Remove Element',
      'Remove',
      'Cancel'
    );
    if (confirmed) {
      onRemoveSection(selectedSectionId);
    }
  };

  // Compute whether move up/down is possible
  // Protected sections (indices 0, 1, 2) cannot move, and other sections cannot move into protected zone
  const selectedIndex = sections.findIndex(s => s.id === selectedSectionId);
  const canMoveUp = selectedSectionId &&
    selectedIndex >= PROTECTED_SECTION_COUNT &&  // Not in protected zone
    selectedIndex > PROTECTED_SECTION_COUNT;      // Can't move into protected zone (must stay at index 3+)
  const canMoveDown = selectedSectionId &&
    selectedIndex >= PROTECTED_SECTION_COUNT &&  // Not in protected zone
    selectedIndex < sections.length - 1;

  const handleMoveUp = () => {
    if (selectedSectionId && onMoveUp) {
      onMoveUp(selectedSectionId);
    }
  };

  const handleMoveDown = () => {
    if (selectedSectionId && onMoveDown) {
      onMoveDown(selectedSectionId);
    }
  };

  return (
    <aside
      style={{
        width: '200px',
        backgroundColor: sidebarBg,
        borderRight: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Book info with cover thumbnail */}
      <div style={{ padding: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Cover thumbnail - clickable to change */}
        <div
          onClick={toolExecuting ? undefined : onCoverClick}
          title={toolExecuting ? undefined : "Click to change cover"}
          style={{
            width: '40px',
            height: '60px',
            flexShrink: 0,
            backgroundColor: coverUrl ? 'transparent' : '#00517b',
            borderRadius: '2px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: toolExecuting ? 'not-allowed' : 'pointer',
            opacity: toolExecuting ? 0.5 : 1,
          }}
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt="Cover"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: '#fff', fontSize: '8px', textAlign: 'center', padding: '2px' }}>
              {bookTitle ? bookTitle.substring(0, 20) : 'No Cover'}
            </span>
          )}
        </div>
        {/* Title and author */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <h1
            style={{
              fontSize: '13px',
              fontWeight: 700,
              margin: 0,
              color: theme.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {bookTitle || 'No Book Loaded'}
          </h1>
          {authorName && (
            <p
              style={{
                fontSize: '11px',
                color: mutedText,
                margin: '2px 0 0',
                fontStyle: 'italic',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              by {authorName}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: borderColor, margin: '0 8px' }} />

      {/* Chapter list - grouped by section with dividers */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {(() => {
          // Group sections by section number
          // Key insight: First 3 items by INDEX are ALWAYS Required (PROTECTED_SECTION_COUNT = 3)
          const sectionGroups: Map<number, Section[]> = new Map();
          for (let i = 1; i <= 6; i++) sectionGroups.set(i, []);

          sections.forEach((section, index) => {
            // Skip table-of-contents (hidden like in Vellum)
            if (section.type === 'table-of-contents') {
              return;
            }

            // First 3 items are ALWAYS Required - use INDEX, not type/ID
            if (index < PROTECTED_SECTION_COUNT) {
              sectionGroups.get(1)?.push(section);
              return;
            }

            // For index 3+, determine section by type
            const sectionNum = section.type ? getSectionNumber(section.type) : 4;

            // Floating types (sectionNum === 0) go to Chapters
            const targetSection = sectionNum === 0 ? 4 : sectionNum;
            sectionGroups.get(targetSection)?.push(section);
          });

          // Section background colors (dull/muted)
          const sectionColors: Record<number, string> = {
            1: isDarkMode ? '#3a2a2a' : '#f5e8e8', // Required - dull red
            2: isDarkMode ? '#3a3020' : '#f5efe5', // Front Matter - dull orange
            3: isDarkMode ? '#2a3a2a' : '#e8f5e8', // Introductory - dull green
            4: isDarkMode ? '#2a2a3a' : '#e8e8f5', // Chapters - dull blue
            5: isDarkMode ? '#352a3a' : '#f0e8f5', // Back Matter - dull purple
            6: isDarkMode ? '#303030' : '#f0f0f0', // No Matter - dull gray
          };

          // Render helper for section items
          const renderSectionItem = (section: Section, sectionNum: number) => {
            const isSelected = section.id === selectedSectionId;
            const hasMatch = sectionsWithMatches?.has(section.id);
            const bgColor = isSelected ? selectedBg : (hasMatch ? (isDarkMode ? '#3d2a0a' : '#fef3c7') : sectionColors[sectionNum]);
            return (
              <div
                key={section.id}
                onClick={toolExecuting ? undefined : () => onSelectSection(section.id)}
                style={{
                  padding: '4px 8px',
                  cursor: toolExecuting ? 'not-allowed' : 'pointer',
                  backgroundColor: bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: toolExecuting ? 0.5 : 1,
                }}
              >
                {isSelected && <span style={{ color: '#6366f1', fontSize: '8px' }}>●</span>}
                {!isSelected && hasMatch && <span style={{ color: '#f59e0b', fontSize: '8px' }}>●</span>}
                <span
                  style={{
                    fontSize: '12px',
                    color: isSelected ? '#6366f1' : (hasMatch ? '#f59e0b' : theme.text),
                    fontWeight: isSelected ? 500 : (hasMatch ? 500 : 400),
                  }}
                >
                  {section.title}
                </span>
              </div>
            );
          };

          // Section tooltips
          const sectionTooltips: Record<number, string> = {
            2: 'Front Matter: Blurbs, Half-Title, Dedication, Epigraph',
            3: 'Introductory: Foreword, Introduction, Preface, Prologue',
            4: 'Chapters: Main story content',
            5: 'Back Matter: Epilogue, Afterword, Endnotes, Bibliography, Acknowledgments, About the Author, Also By',
            6: 'No Matter: Optional content like notes, deleted scenes, research - available to readers but not in the main reading flow',
          };

          // Render divider with optional info icon
          const renderDivider = (key: string, sectionNum?: number) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '6px 8px',
                gap: '4px',
              }}
            >
              <div style={{ flex: 1, height: '2px', backgroundColor: borderColor }} />
              {sectionNum && sectionTooltips[sectionNum] && (
                <span
                  title={sectionTooltips[sectionNum]}
                  style={{
                    fontSize: '10px',
                    color: isDarkMode ? '#666' : '#999',
                    cursor: 'help',
                    userSelect: 'none',
                  }}
                >
                  ⓘ
                </span>
              )}
            </div>
          );

          // Render section name placeholder when empty
          const renderEmptyPlaceholder = (sectionNum: number) => (
            <div
              key={`empty-${sectionNum}`}
              style={{
                padding: '4px 12px 2px',
                fontSize: '10px',
                fontWeight: 600,
                color: isDarkMode ? '#888' : '#666',
                letterSpacing: '0.5px',
              }}
            >
              {SECTION_NAMES[sectionNum]}
            </div>
          );

          const elements: React.ReactNode[] = [];

          // Section 1: Required (always present)
          const requiredSections = sectionGroups.get(1) || [];
          requiredSections.forEach(s => elements.push(renderSectionItem(s, 1)));

          // Divider after Required (before Front Matter)
          elements.push(renderDivider('divider-1', 2));

          // Section 2: Front Matter
          const frontMatter = sectionGroups.get(2) || [];
          if (frontMatter.length > 0) {
            frontMatter.forEach(s => elements.push(renderSectionItem(s, 2)));
          } else {
            elements.push(renderEmptyPlaceholder(2));
          }

          // Divider after Front Matter (before Introductory)
          elements.push(renderDivider('divider-2', 3));

          // Section 3: Introductory
          const introductory = sectionGroups.get(3) || [];
          if (introductory.length > 0) {
            introductory.forEach(s => elements.push(renderSectionItem(s, 3)));
          } else {
            elements.push(renderEmptyPlaceholder(3));
          }

          // Divider after Introductory (before Chapters)
          elements.push(renderDivider('divider-3', 4));

          // Section 4: Chapters (always has at least one)
          const chapters = sectionGroups.get(4) || [];
          chapters.forEach(s => elements.push(renderSectionItem(s, 4)));

          // Divider after Chapters (before Back Matter)
          elements.push(renderDivider('divider-4', 5));

          // Section 5: Back Matter
          const backMatter = sectionGroups.get(5) || [];
          if (backMatter.length > 0) {
            backMatter.forEach(s => elements.push(renderSectionItem(s, 5)));
          } else {
            elements.push(renderEmptyPlaceholder(5));
          }

          // Divider after Back Matter (before No Matter)
          elements.push(renderDivider('divider-5', 6));

          // Section 6: No Matter (optional, non-linear in spine)
          const noMatter = sectionGroups.get(6) || [];
          if (noMatter.length > 0) {
            noMatter.forEach(s => elements.push(renderSectionItem(s, 6)));
          } else {
            elements.push(renderEmptyPlaceholder(6));
          }

          return elements;
        })()}
      </nav>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: borderColor, margin: '0 8px' }} />

      {/* Search input */}
      <div style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSearchSubmit?.();
              }
            }}
            placeholder="Search..."
            disabled={toolExecuting}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: '11px',
              border: `1px solid ${borderColor}`,
              borderRadius: '4px',
              backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
              color: theme.text,
              outline: 'none',
              minWidth: 0,
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchClose?.()}
              disabled={toolExecuting}
              style={{
                background: 'none',
                border: 'none',
                color: mutedText,
                cursor: toolExecuting ? 'not-allowed' : 'pointer',
                padding: '2px',
                fontSize: '12px',
                lineHeight: 1,
              }}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
        {searchResultCount > 0 && (
          <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '2px' }}>
            {searchResultCount} match{searchResultCount !== 1 ? 'es' : ''}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: borderColor, margin: '0 8px' }} />

      {/* Add/Move/Remove Element buttons */}
      <div style={{ padding: '4px 8px' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* Move to Area dropdown - first so dropdown has room to expand right */}
          <div ref={moveDropdownRef} style={{ position: 'relative' }}>
            <StyledSmallButton
              theme={theme}
              onClick={() => setMoveDropdownOpen(!moveDropdownOpen)}
              disabled={toolExecuting || isProtectedSection || !selectedSectionId}
              title={isProtectedSection ? "Cannot move protected section" : "Move to area"}
            >
              <PiArrowsDownUp size={11} />
            </StyledSmallButton>
            {moveDropdownOpen && !isProtectedSection && selectedSectionId && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '4px',
                  backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  zIndex: 100,
                  minWidth: '140px',
                }}
              >
                {/* Dropdown header label */}
                <div
                  style={{
                    padding: '6px 12px 4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#a78bfa',
                    letterSpacing: '0.5px',
                    borderBottom: `1px solid ${borderColor}`,
                    marginBottom: '4px',
                  }}
                >
                  Move to:
                </div>
                {[
                  { area: 2, name: 'Front Matter' },
                  { area: 3, name: 'Introductory' },
                  { area: 4, name: 'Chapters' },
                  { area: 5, name: 'Back Matter' },
                  { area: 6, name: 'No Matter' },
                ].map(({ area, name }) => {
                  // Disable moving last chapter out of Chapters
                  const isDisabled = isLastChapter && area !== 4;
                  return (
                    <button
                      key={area}
                      onClick={() => {
                        if (!isDisabled && onMoveToArea && selectedSectionId) {
                          onMoveToArea(selectedSectionId, area);
                        }
                        setMoveDropdownOpen(false);
                      }}
                      disabled={isDisabled}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '6px 12px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        color: isDisabled ? mutedText : theme.text,
                        fontSize: '12px',
                        opacity: isDisabled ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isDisabled) {
                          e.currentTarget.style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f0f0f0';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title={isDisabled ? "Cannot move last chapter" : `Move to ${name}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <ElementPickerDropdown
            theme={theme}
            isDarkMode={isDarkMode}
            onAddElement={onAddElement || (() => {})}
            disabled={toolExecuting}
            existingTypes={existingTypes}
          />
          <StyledSmallButton
            theme={theme}
            onClick={handleMoveUp}
            disabled={toolExecuting || !canMoveUp}
            title="Move Element up"
          >
            <PiCaretUp size={11} />
          </StyledSmallButton>
          <StyledSmallButton
            theme={theme}
            onClick={handleMoveDown}
            disabled={toolExecuting || !canMoveDown}
            title="Move Element down"
          >
            <PiCaretDown size={11} />
          </StyledSmallButton>
          <StyledSmallButton
            theme={theme}
            onClick={handleRemove}
            disabled={toolExecuting || isProtectedSection}
            title={isProtectedSection ? "Cannot remove protected section" : "Remove Element"}
          >
            <PiMinus size={11} />
          </StyledSmallButton>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: borderColor, margin: '0 8px' }} />

      {/* Word count */}
      <div
        style={{
          padding: '4px 8px',
          color: mutedText,
          fontSize: '11px',
        }}
      >
        Total: {totalWordCount.toLocaleString()} w
      </div>
    </aside>
  );
}
