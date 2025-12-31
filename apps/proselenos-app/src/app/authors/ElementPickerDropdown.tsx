// app/authors/ElementPickerDropdown.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { ELEMENT_GROUPS, ElementType } from './elementTypes';

interface ElementPickerDropdownProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  onAddElement: (elementType: ElementType) => void;
  disabled?: boolean;
}

export default function ElementPickerDropdown({
  theme,
  isDarkMode,
  onAddElement,
  disabled = false,
}: ElementPickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (elementType: ElementType) => {
    onAddElement(elementType);
    setIsOpen(false);
  };

  // Dark mode optimized colors
  const dropdownBg = isDarkMode ? '#2a2a2a' : '#ffffff';
  const hoverBg = isDarkMode ? '#3a3a5c' : '#f0f0f4';
  const separatorColor = isDarkMode ? '#404040' : '#e5e5e5';
  const groupLabelColor = isDarkMode ? '#888' : '#666';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <StyledSmallButton
        theme={theme}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title="Add Element"
      >
        + <span style={{ fontSize: '8px', marginLeft: '2px' }}>&#9660;</span>
      </StyledSmallButton>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%', // Opens upward from the button
            left: 0,
            marginBottom: '4px',
            backgroundColor: dropdownBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
            zIndex: 1000,
            minWidth: '180px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {ELEMENT_GROUPS.map((group, groupIndex) => (
            <div key={group.name || 'main'}>
              {/* Group separator (not before first group) */}
              {groupIndex > 0 && (
                <div
                  style={{
                    height: '1px',
                    backgroundColor: separatorColor,
                    margin: '4px 0',
                  }}
                />
              )}

              {/* Group label (if has name) */}
              {group.name && (
                <div
                  style={{
                    padding: '4px 12px 2px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: groupLabelColor,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {group.name}
                </div>
              )}

              {/* Element items */}
              {group.elements.map((element) => (
                <button
                  key={element.type}
                  onClick={() => handleSelect(element.type)}
                  title={element.description}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '6px 12px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: theme.text,
                    fontSize: '12px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {element.displayName}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
