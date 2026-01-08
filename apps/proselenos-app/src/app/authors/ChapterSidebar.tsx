// app/authors/ChapterSidebar.tsx

'use client';

import { useState, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { showConfirm } from '../shared/alerts';
import ElementPickerDropdown from './ElementPickerDropdown';
import { ElementType, PROTECTED_SECTION_IDS, PROTECTED_SECTION_COUNT } from './elementTypes';

interface Section {
  id: string;
  title: string;
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
  toolExecuting?: boolean; // When true, disable all interactive elements
  existingTypes?: ElementType[]; // Types already in manuscript (for add element filtering)
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
  toolExecuting = false,
  existingTypes = [],
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

      {/* Chapter list */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {sections.map((section, index) => {
          const isSelected = section.id === selectedSectionId;
          const hasMatch = sectionsWithMatches?.has(section.id);
          return (
            <div key={section.id}>
              <div
                onClick={toolExecuting ? undefined : () => onSelectSection(section.id)}
                style={{
                  padding: '4px 8px',
                  cursor: toolExecuting ? 'not-allowed' : 'pointer',
                  backgroundColor: isSelected ? selectedBg : (hasMatch ? (isDarkMode ? '#3d2a0a' : '#fef3c7') : 'transparent'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: toolExecuting ? 0.5 : 1,
                }}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <span style={{ color: '#6366f1', fontSize: '8px' }}>●</span>
                )}
                {/* Match indicator */}
                {!isSelected && hasMatch && (
                  <span style={{ color: '#f59e0b', fontSize: '8px' }}>●</span>
                )}
                {/* Section title */}
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
              {/* Divider after protected sections (Cover, Title Page, Copyright) */}
              {index === PROTECTED_SECTION_COUNT - 1 && sections.length > PROTECTED_SECTION_COUNT && (
                <div style={{
                  height: '2px',
                  backgroundColor: borderColor,
                  margin: '6px 8px',
                }} />
              )}
            </div>
          );
        })}
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
            ▲
          </StyledSmallButton>
          <StyledSmallButton
            theme={theme}
            onClick={handleMoveDown}
            disabled={toolExecuting || !canMoveDown}
            title="Move Element down"
          >
            ▼
          </StyledSmallButton>
          <StyledSmallButton
            theme={theme}
            onClick={handleRemove}
            disabled={toolExecuting || isProtectedSection}
            title={isProtectedSection ? "Cannot remove protected section" : "Remove Element"}
          >
            -
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
