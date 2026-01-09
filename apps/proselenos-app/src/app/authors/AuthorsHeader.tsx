// app/authors/AuthorsHeader.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PiKey, PiCpu, PiChatCircle, PiFolderOpen, PiNotePencil, PiDatabase, PiInfo, PiFileHtml, PiImage, PiArrowRight } from 'react-icons/pi';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface AuthorsHeaderProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  onThemeToggle: () => void;
  onAboutClick: () => void;
  onStorageClick: () => void;
  onFilesClick: () => void;
  onKeyClick: () => void;
  onModelsClick: () => void;
  onEditorClick: () => void;
  onChatClick: () => void;
  onNewClick: () => void;
  onOpenClick: () => void;
  onOpenDocxClick: () => void;
  onLoadFromLibraryClick: () => void;
  onSaveClick: () => void;
  hasApiKey: boolean;
  currentModel: string;
  currentProvider: string;
  toolExecuting?: boolean; // When true, disable all buttons except Exit
  onSearchClose?: () => void;
  onCoverClick?: () => void;
  onHtmlExportClick?: () => void;
}

export default function AuthorsHeader({
  theme,
  isDarkMode,
  onThemeToggle,
  onAboutClick,
  onStorageClick,
  onFilesClick,
  onKeyClick,
  onModelsClick,
  onEditorClick,
  onChatClick,
  onNewClick,
  onOpenClick,
  onOpenDocxClick,
  onLoadFromLibraryClick,
  onSaveClick,
  hasApiKey,
  currentModel,
  currentProvider,
  toolExecuting = false,
  onSearchClose,
  onCoverClick,
  onHtmlExportClick,
}: AuthorsHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdownOpen, setOpenDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const openDropdownRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    if (!menuOpen && !openDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (openDropdownOpen && openDropdownRef.current && !openDropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, openDropdownOpen]);

  const handleExitClick = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      router.push('/library');
    }
  };

  // Track Library window that Authors opens (so we can focus it later)
  const libraryWindowRef = useRef<Window | null>(null);

  const handleLibraryClick = () => {
    // If we have a reference to an open Library tab, focus it
    if (libraryWindowRef.current && !libraryWindowRef.current.closed) {
      libraryWindowRef.current.focus();
    } else {
      // Open new Library tab and save reference (Authors can control tabs it opens)
      libraryWindowRef.current = window.open('/library', '_blank');
    }
  };

  return (
    <header
      style={{
        backgroundColor: theme.headerBg,
        borderBottom: `1px solid ${theme.border}`,
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      {/* Left section: Theme toggle, Logo, Title, About, Exit, New/Open/Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          disabled={toolExecuting}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: toolExecuting ? 'not-allowed' : 'pointer',
            padding: '4px',
            opacity: toolExecuting ? 0.5 : 1,
          }}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>

        {/* Logo */}
        <img
          src="/icon.png"
          alt="EverythingEbooks"
          title="EverythingEbooks"
          style={{
            width: '32px',
            height: '32px',
            cursor: 'pointer',
          }}
        />

        {/* Exit */}
        <StyledSmallButton onClick={handleExitClick} theme={theme} title="Quit authors, return to library (aborts running AI tool)">Exit</StyledSmallButton>

        {/* Open dropdown + send Ebook → Library */}
        <div style={{ display: 'flex', gap: '0px', alignItems: 'center' }}>
          {/* Open dropdown */}
          <div ref={openDropdownRef} style={{ position: 'relative' }}>
            <StyledSmallButton
              theme={theme}
              onClick={() => {
                onSearchClose?.();
                setOpenDropdownOpen(!openDropdownOpen);
              }}
              disabled={toolExecuting}
              title="Open to work on ebook"
            >
              Open ▾
            </StyledSmallButton>
            {openDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: theme.bg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  zIndex: 1000,
                  minWidth: '160px',
                }}
              >
                <button
                  onClick={() => { onNewClick(); setOpenDropdownOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: theme.text,
                    fontSize: '13px',
                  }}
                >
                  New
                </button>
                <button
                  onClick={() => { onOpenClick(); setOpenDropdownOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: theme.text,
                    fontSize: '13px',
                  }}
                >
                  Load EPUB
                </button>
                <button
                  onClick={() => { onLoadFromLibraryClick(); setOpenDropdownOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: theme.text,
                    fontSize: '13px',
                  }}
                >
                  Load from Library
                </button>
                <button
                  onClick={() => { onOpenDocxClick(); setOpenDropdownOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: theme.text,
                    fontSize: '13px',
                  }}
                >
                  Load DOCX <PiArrowRight style={{ display: 'inline', verticalAlign: 'middle' }} /> EPUB
                </button>
              </div>
            )}
          </div>
          <StyledSmallButton theme={theme} onClick={onSaveClick} disabled={toolExecuting} styleOverrides={{ marginRight: 0 }} title="Put current ebook into Library">send Ebook</StyledSmallButton>
          <span style={{ color: isDarkMode ? '#86efac' : '#16a34a', fontSize: '16px' }}>⇨</span>
          <StyledSmallButton onClick={handleLibraryClick} theme={theme} title="Go read ebooks">Library</StyledSmallButton>
        </div>
      </div>

      {/* Right section: Status message + Hamburger menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
        {/* Provider:Model status message (from prod AIToolsSection.tsx) */}
        <div style={{
          fontSize: '10px',
          color: (hasApiKey && currentModel) ? '#4285F4' : '#dc3545',
          fontFamily: 'monospace',
        }}>
          {!hasApiKey ? (
            <span>No AI API key</span>
          ) : !currentModel ? (
            <span>Your Key is valid, now click Models</span>
          ) : (
            <span title={`Provider: ${currentProvider}, Model: ${currentModel}`}>
              {currentProvider}:{currentModel}
            </span>
          )}
        </div>

        {/* Hamburger menu container (for click-outside detection) */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          {/* Hamburger menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={toolExecuting}
            title="Menu"
            style={{
              background: 'none',
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              fontSize: '18px',
              cursor: toolExecuting ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              color: theme.text,
              opacity: toolExecuting ? 0.5 : 1,
            }}
          >
            ☰
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                backgroundColor: theme.bg,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                zIndex: 1000,
                minWidth: '100px',
              }}
            >
            <button
              onClick={() => { onKeyClick(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
              }}
            >
              <PiKey size={16} />
              Key
            </button>
            <button
              onClick={() => { onModelsClick(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
              }}
            >
              <PiCpu size={16} />
              Models
            </button>
            <button
              id="chat-button"
              onClick={() => { onChatClick(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
              }}
            >
              <PiChatCircle size={16} />
              Chat
            </button>
            <button
              onClick={() => { onFilesClick(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(59, 130, 246, 0.2)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
              }}
            >
              <PiFolderOpen size={16} />
              Files
            </button>
            <button
              onClick={() => { onEditorClick(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(168, 85, 247, 0.2)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
              }}
            >
              <PiNotePencil size={16} />
              Editor
            </button>
            <button
              onClick={() => { onCoverClick?.(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(236, 72, 153, 0.2)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
              }}
            >
              <PiImage size={16} />
              Cover
            </button>
            <button
              onClick={() => { onHtmlExportClick?.(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(184, 134, 11, 0.15)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#b8860b',
                fontSize: '13px',
              }}
            >
              <PiFileHtml size={16} />
              HTML
            </button>
            <button
              onClick={() => { onStorageClick(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(100, 116, 139, 0.2)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
              }}
            >
              <PiDatabase size={16} />
              Storage
            </button>
            <button
              onClick={() => { onAboutClick(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(148, 163, 184, 0.2)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: theme.text,
                fontSize: '13px',
              }}
            >
              <PiInfo size={16} />
              About
            </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
