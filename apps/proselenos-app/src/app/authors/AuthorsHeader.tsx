// app/authors/AuthorsHeader.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PiFolderOpen, PiNotePencil, PiDatabase, PiInfo, PiFileDoc, /* PiFileText, */ PiImage, PiArrowRight } from 'react-icons/pi';
import { GiBoxUnpacking } from 'react-icons/gi';
import { ThemeConfig } from '../shared/theme';
import { showConfirm } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import TrafficLightIcon from '@/components/TrafficLightIcon';

interface AuthorsHeaderProps {
  theme: ThemeConfig;
  isDarkMode: boolean;
  onThemeToggle: () => void;
  onAboutClick: () => void;
  onStorageClick: () => void;
  onFilesClick: () => void;
  onEditorClick: () => void;
  onNewClick: () => void;
  onOpenClick: () => void;
  onOpenDocxClick: () => void;
  onOpenPdfClick: () => void;
  onOpenFountainClick: () => void;
  onLoadFromLibraryClick: () => void;
  onSaveClick: () => void;
  onSearchClose?: () => void;
  onCoverClick?: () => void;
  onDocxExportClick?: () => void;
  onFountainExportClick?: () => void;
  onXrayClick?: () => void;
  hasUnsavedChanges?: boolean;
  trafficLightStatus: 'green' | 'yellow' | 'red';
  trafficTooltip: string;
}

export default function AuthorsHeader({
  theme,
  isDarkMode,
  onThemeToggle,
  onAboutClick,
  onStorageClick,
  onFilesClick,
  onEditorClick,
  onNewClick,
  onOpenClick,
  onOpenDocxClick,
  onOpenPdfClick,
  onOpenFountainClick: _onOpenFountainClick,
  onLoadFromLibraryClick,
  onSaveClick,
  onSearchClose,
  onCoverClick,
  onDocxExportClick,
  onFountainExportClick: _onFountainExportClick,
  onXrayClick,
  hasUnsavedChanges = false,
  trafficLightStatus,
  trafficTooltip,
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

  const handleExitClick = async () => {
    if (hasUnsavedChanges) {
      const confirmed = await showConfirm(
        'You have unsaved changes that will be lost. Continue?',
        isDarkMode,
        'Unsaved Changes',
        'Exit anyway',
        'Cancel'
      );
      if (!confirmed) return;
    }
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
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>

        <TrafficLightIcon
          status={trafficLightStatus}
          isDarkMode={isDarkMode}
          onClick={onStorageClick}
          tooltip={trafficTooltip}
        />
        <div style={{ width: '8px' }} />

        {/* Exit */}
        <StyledSmallButton onClick={handleExitClick} theme={theme} title="Quit authors, return to library">Exit</StyledSmallButton>

        {/* Open dropdown + Publish → Library */}
        <div style={{ display: 'flex', gap: '0px', alignItems: 'center' }}>
          {/* Open dropdown */}
          <div ref={openDropdownRef} style={{ position: 'relative' }}>
            <StyledSmallButton
              theme={theme}
              onClick={async () => {
                if (hasUnsavedChanges) {
                  const confirmed = await showConfirm(
                    'You have unsaved changes that will be lost. Continue?',
                    isDarkMode,
                    'Unsaved Changes',
                    'Continue',
                    'Cancel'
                  );
                  if (!confirmed) return;
                }
                onSearchClose?.();
                setOpenDropdownOpen(!openDropdownOpen);
              }}
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
                  minWidth: '220px',
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
                <button
                  onClick={() => { onOpenPdfClick(); setOpenDropdownOpen(false); }}
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
                  Load PDF <PiArrowRight style={{ display: 'inline', verticalAlign: 'middle' }} /> EPUB
                </button>
                {/* <button
                  onClick={() => { onOpenFountainClick(); setOpenDropdownOpen(false); }}
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
                  Load Fountain Screenplay
                </button> */}
              </div>
            )}
          </div>
          <StyledSmallButton theme={theme} onClick={onSaveClick} styleOverrides={{ marginRight: 0 }} title="Publish to Library">Publish</StyledSmallButton>
          <span style={{ color: isDarkMode ? '#86efac' : '#16a34a', fontSize: '16px' }}>⇨</span>
          <StyledSmallButton onClick={handleLibraryClick} theme={theme} title="Go read ebooks">Library</StyledSmallButton>
        </div>
      </div>

      {/* Right section: Hamburger menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
        {/* Hamburger menu container (for click-outside detection) */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          {/* Hamburger menu button */}
          <button
            onClick={() => { setMenuOpen(!menuOpen); }}
            title="Menu"
            style={{
              background: 'none',
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              color: theme.text,
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
              onClick={() => { onDocxExportClick?.(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#3b82f6',
                fontSize: '13px',
              }}
            >
              <PiFileDoc size={16} />
              DOCX
            </button>
            {/* <button
              onClick={() => { onFountainExportClick?.(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(34, 197, 94, 0.15)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#22c55e',
                fontSize: '13px',
              }}
            >
              <PiFileText size={16} />
              Fountain
            </button> */}
            <button
              onClick={() => { onXrayClick?.(); setMenuOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(147, 51, 234, 0.15)',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#9333ea',
                fontSize: '13px',
              }}
            >
              <GiBoxUnpacking size={16} />
              X-Ray
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
