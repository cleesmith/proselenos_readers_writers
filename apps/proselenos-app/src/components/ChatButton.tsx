// components/ChatButton.tsx

"use client";

import React, { useState } from 'react';
import SimpleChatModal from './SimpleChatModal';
import StyledSmallButton from '@/components/StyledSmallButton';
import { getTheme } from '@/app/shared/theme';

// Complete interface definition
interface ChatButtonProps {
  className?: string;
  isDarkMode?: boolean;
  isSystemInitializing?: boolean;
  hasApiKey?: boolean;
  toolExecuting?: boolean;
  styleOverrides?: React.CSSProperties;
}

export default function ChatButton({
  className = '',
  isDarkMode = false,
  isSystemInitializing = false,
  hasApiKey = false,
  toolExecuting = false,
  styleOverrides
}: ChatButtonProps): React.JSX.Element {
  
  // Explicit state typing
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const theme = getTheme(isDarkMode);

  // Event handler with explicit typing
  const handleClick = (): void => {
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
        disabled={isSystemInitializing || !hasApiKey || toolExecuting}
        theme={theme}
        styleOverrides={styleOverrides}
      >
        Chat
      </StyledSmallButton>

      <SimpleChatModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        isDarkMode={isDarkMode}
      />
    </>
  );
}
