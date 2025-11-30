// app/proselenos/proselenosHeader.tsx

// Header menu bar Component

'use client';

import { useRouter } from 'next/navigation';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface ProselenosHeaderProps {
  session: any;
  theme: ThemeConfig;
  isDarkMode: boolean;
  currentProvider: string;
  currentModel: string;
  hasConfiguredProvider: boolean;
  hasApiKey: boolean;
  isStorageOperationPending: boolean;
  toolExecuting: boolean;
  currentProject?: string | null;
  currentProjectId?: string | null;
  isSystemInitializing: boolean;
  onThemeToggle: () => void;
  onAboutClick: () => void;
}

export default function ProselenosHeader({
  session,
  theme,
  isDarkMode,
  currentProvider,
  currentModel,
  hasConfiguredProvider,
  hasApiKey: _hasApiKey,
  isStorageOperationPending: _isStorageOperationPending,
  toolExecuting: _toolExecuting,
  currentProject: _currentProject,
  currentProjectId: _currentProjectId,
  isSystemInitializing: _isSystemInitializing,
  onThemeToggle,
  onAboutClick
}: ProselenosHeaderProps) {

  const router = useRouter();

  const handleExitClick = () => {
    // FIX: Robust check for the opener tab.
    // 1. window.opener must exist (we were opened by another tab)
    // 2. window.opener.closed must be FALSE (the original tab is still open)
    if (window.opener && !window.opener.closed) {
      window.close(); // Safe to close: The user will see the Library tab behind this one.
    } else {
      // If the user closed the Library tab, we navigate there instead of closing the app.
      router.push('/library'); 
    }
  };

  return (
    <>
      <div style={{
        backgroundColor: theme.headerBg,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.border}`
      }}>
        {/* Left - Dark/Light Mode Toggle */}
        <button 
          onClick={onThemeToggle}
          title={isDarkMode ? 'go Light' : 'go Dark'}
          style={{
            background: 'none',
            border: 'none',
            color: '#4285F4',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>

        {/* Center - Logo, Title, Model Info, Date */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          flex: 1,
          marginLeft: '20px'
        }}>
          <img 
            src="icon.png" 
            alt="Proselenos Logo"
            title="Polish your manuscript with Proselenos"
            style={{
              width: '32px',
              height: '32px'
            }}
          />
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: theme.text 
          }}>
            Proselenos
          </div>
          {session && (
            <div 
              style={{ 
                fontSize: '10px', 
                color: '#4285F4',
                fontFamily: 'monospace',
                marginLeft: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {hasConfiguredProvider ? (
                <span title={`Provider: ${currentProvider}, Model: ${currentModel}`}>
                  {currentProvider}:{currentModel}
                </span>
              ) : (
                <span style={{ color: '#dc3545' }}>No AI provider</span>
              )}
            </div>
          )}
        </div>

        {/* Right - Control Buttons */}
        {session && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <StyledSmallButton onClick={onAboutClick} theme={theme}>About</StyledSmallButton>
            <StyledSmallButton onClick={handleExitClick} theme={theme}>Exit</StyledSmallButton>
          </div>
        )}
      </div>
    </>
  );
}
