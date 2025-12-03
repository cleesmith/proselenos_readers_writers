// components/ChatButton.tsx

"use client";

import React, { useState } from 'react';
import { showAlert } from '@/app/shared/alerts';
import SimpleChatModal from './SimpleChatModal';
import StyledSmallButton from '@/components/StyledSmallButton';
import { getTheme } from '@/app/shared/theme';

// Complete interface definition
interface ChatButtonProps {
  className?: string;
  isDarkMode?: boolean;
  currentProject?: string | null;
  currentProjectId?: string | null;
  isSystemInitializing?: boolean;
  hasApiKey?: boolean;
  styleOverrides?: React.CSSProperties;
}

export default function ChatButton({
  className = '',
  isDarkMode = false,
  currentProject,
  currentProjectId,
  isSystemInitializing = false,
  hasApiKey = false,
  styleOverrides
}: ChatButtonProps): React.JSX.Element {
  
  // Explicit state typing
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const theme = getTheme(isDarkMode);

  // Event handler with explicit typing
  const handleClick = (): void => {
    if (!currentProject || !currentProjectId) {
      showAlert('Please select a project first', 'warning', undefined, isDarkMode);
      return;
    }
    setIsModalOpen(true);
  };

  const handleModalClose = (): void => {
    setIsModalOpen(false);
  };

  return (
    <>
      <StyledSmallButton
        className={className}
        onClick={handleClick}
        disabled={!currentProject || !currentProjectId || isSystemInitializing || !hasApiKey}
        theme={theme}
        styleOverrides={styleOverrides}
      >
        Chat
      </StyledSmallButton>

      <SimpleChatModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        isDarkMode={isDarkMode}
        currentProject={currentProject}
      />
    </>
  );
}
