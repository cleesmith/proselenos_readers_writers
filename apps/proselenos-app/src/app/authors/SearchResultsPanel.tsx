// app/authors/SearchResultsPanel.tsx

'use client';

/**
 * Search Results panel for full-text manuscript search
 * Appears below the editor textarea (same pattern as OneByOnePanel)
 * Shows search matches with context snippets
 */

import React from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

export interface SearchResult {
  sectionId: string;      // ID of the section containing match
  sectionTitle: string;   // Title to display
  matchIndex: number;     // Character position of match in content
  matchText: string;      // The actual matched text
  contextBefore: string;  // ~50 chars before match
  contextAfter: string;   // ~50 chars after match
}

interface SearchResultsPanelProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  results: SearchResult[];
  currentIndex: number;
  searchQuery: string;
  onNavigate: (result: SearchResult, index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export default function SearchResultsPanel({
  theme,
  isDarkMode,
  results,
  currentIndex,
  searchQuery,
  onNavigate,
  onPrev,
  onNext,
  onClose,
}: SearchResultsPanelProps) {
  const total = results.length;
  const currentResult = results[currentIndex];
  const isFirstResult = currentIndex === 0;
  const isLastResult = currentIndex >= results.length - 1;

  // Handle click on the result content area
  const handleResultClick = () => {
    if (currentResult) {
      onNavigate(currentResult, currentIndex);
    }
  };

  if (!currentResult) {
    return (
      <div
        style={{
          padding: '16px',
          borderTop: `1px solid ${theme.border}`,
          backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
          textAlign: 'center',
        }}
      >
        <div style={{ color: theme.text, marginBottom: '12px' }}>
          No matches found for &ldquo;{searchQuery}&rdquo;
        </div>
        <StyledSmallButton onClick={onClose} theme={theme}>
          Close
        </StyledSmallButton>
      </div>
    );
  }

  return (
    <div
      style={{
        borderTop: `1px solid ${theme.border}`,
        backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '200px',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar row */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#252525' : '#e8e8e8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: theme.text, fontWeight: 'bold' }}>
            Match {currentIndex + 1} of {total}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <StyledSmallButton onClick={onPrev} theme={theme} disabled={isFirstResult}>
              Prev
            </StyledSmallButton>
            <StyledSmallButton onClick={onNext} theme={theme} disabled={isLastResult}>
              Next
            </StyledSmallButton>
          </div>
        </div>
        <StyledSmallButton onClick={onClose} theme={theme}>
          Close
        </StyledSmallButton>
      </div>

      {/* Result content - clickable to navigate */}
      <div
        onClick={handleResultClick}
        style={{
          padding: '12px',
          cursor: 'pointer',
          backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff',
          overflow: 'auto',
          flex: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#ffffff';
        }}
        title="Click to go to this match"
      >
        {/* Chapter title */}
        <div
          style={{
            fontSize: '11px',
            color: '#6366f1',
            fontWeight: 'bold',
            marginBottom: '6px',
          }}
        >
          {currentResult.sectionTitle}
        </div>

        {/* Context with highlighted match */}
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '13px',
            lineHeight: '1.5',
            color: theme.text,
          }}
        >
          <span style={{ color: theme.textMuted }}>...{currentResult.contextBefore}</span>
          <span
            style={{
              backgroundColor: isDarkMode ? '#5a4a00' : '#fff59d',
              padding: '1px 2px',
              borderRadius: '2px',
              fontWeight: 500,
            }}
          >
            {currentResult.matchText}
          </span>
          <span style={{ color: theme.textMuted }}>{currentResult.contextAfter}...</span>
        </div>
      </div>
    </div>
  );
}
