// app/authors/ElementPickerDropdown.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { PiPlus } from 'react-icons/pi';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import { ELEMENT_GROUPS, ElementType, HIDDEN_TYPES, isSingletonType } from './elementTypes';

interface ElementPickerDropdownProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  onAddElement: (elementType: ElementType) => void;
  disabled?: boolean;
  existingTypes?: ElementType[]; // Types already in manuscript
}

export default function ElementPickerDropdown({
  theme,
  isDarkMode,
  onAddElement,
  disabled = false,
  existingTypes = [],
}: ElementPickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter out hidden types, keep others visible (some may be disabled)
  const filteredGroups = ELEMENT_GROUPS.map(group => ({
    ...group,
    elements: group.elements.filter(el => !HIDDEN_TYPES.includes(el.type))
  })).filter(group => group.elements.length > 0);

  // Check if a type is disabled (singleton that already exists)
  const isTypeDisabled = (type: ElementType): boolean => {
    return isSingletonType(type) && existingTypes.includes(type);
  };

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

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <StyledSmallButton
        theme={theme}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title="Add Element"
      >
        <PiPlus size={11} />
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
          {/* Dropdown header label */}
          <div
            style={{
              padding: '6px 12px 4px',
              fontSize: '10px',
              fontWeight: 600,
              color: '#a78bfa',
              letterSpacing: '0.5px',
              borderBottom: `1px solid ${separatorColor}`,
              marginBottom: '4px',
            }}
          >
            Add to:
          </div>
          {filteredGroups.map((group, groupIndex) => (
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
                    color: '#a78bfa',
                    letterSpacing: '0.5px',
                  }}
                >
                  {group.name}
                </div>
              )}

              {/* Element items */}
              {group.elements.map((element) => {
                const elementDisabled = isTypeDisabled(element.type);
                return (
                  <button
                    key={element.type}
                    onClick={() => !elementDisabled && handleSelect(element.type)}
                    title={elementDisabled ? `${element.displayName} already exists` : element.description}
                    disabled={elementDisabled}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '6px 12px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: elementDisabled ? 'not-allowed' : 'pointer',
                      color: elementDisabled ? (isDarkMode ? '#555' : '#aaa') : theme.text,
                      fontSize: '12px',
                      opacity: elementDisabled ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!elementDisabled) {
                        e.currentTarget.style.backgroundColor = hoverBg;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {element.displayName}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
