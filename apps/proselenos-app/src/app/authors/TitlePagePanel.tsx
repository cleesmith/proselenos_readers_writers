// app/authors/TitlePagePanel.tsx
// Shows book metadata form when Title Page section is selected (like Vellum)

'use client';

import { useState, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

export interface BookMetadata {
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
}

interface TitlePagePanelProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  onToggleSidebar: () => void;
  initialMetadata: BookMetadata;
  onSave: (metadata: BookMetadata) => void;
}

export default function TitlePagePanel({
  theme,
  isDarkMode,
  onToggleSidebar,
  initialMetadata,
  onSave,
}: TitlePagePanelProps) {
  const borderColor = isDarkMode ? '#404040' : '#e5e5e5';
  const mutedText = isDarkMode ? '#888' : '#666';

  const [metadata, setMetadata] = useState<BookMetadata>(initialMetadata);
  const [hasChanges, setHasChanges] = useState(false);

  // Update when initial metadata changes (section switch)
  useEffect(() => {
    setMetadata(initialMetadata);
    setHasChanges(false);
  }, [initialMetadata]);

  const handleChange = (field: keyof BookMetadata, value: string) => {
    setMetadata((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(metadata);
    setHasChanges(false);
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
      {/* Header */}
      <div
        style={{
          padding: '4px 8px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StyledSmallButton theme={theme} onClick={onToggleSidebar} title="Toggle sidebar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </StyledSmallButton>
          <StyledSmallButton theme={theme} onClick={handleSave} disabled={!hasChanges}>
            {hasChanges ? 'Save' : 'Saved'}
          </StyledSmallButton>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              margin: 0,
              color: '#6366f1',
            }}
          >
            Title Page
          </h2>
        </div>
      </div>

      {/* Form content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Title */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: 600,
                color: theme.text,
              }}
            >
              Title
            </label>
            <input
              type="text"
              value={metadata.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter book title..."
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: theme.inputBg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          {/* Subtitle */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: 600,
                color: theme.text,
              }}
            >
              Subtitle
            </label>
            <input
              type="text"
              value={metadata.subtitle}
              onChange={(e) => handleChange('subtitle', e.target.value)}
              placeholder="Enter subtitle (optional)..."
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: theme.inputBg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <p style={{ marginTop: '4px', fontSize: '11px', color: mutedText }}>
              Optional - appears below the title
            </p>
          </div>

          {/* Author */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: 600,
                color: theme.text,
              }}
            >
              Author
            </label>
            <input
              type="text"
              value={metadata.author}
              onChange={(e) => handleChange('author', e.target.value)}
              placeholder="Enter author name..."
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: theme.inputBg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          {/* Publisher */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: 600,
                color: theme.text,
              }}
            >
              Publisher
            </label>
            <input
              type="text"
              value={metadata.publisher}
              onChange={(e) => handleChange('publisher', e.target.value)}
              placeholder="Enter publisher (optional)..."
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: theme.inputBg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
