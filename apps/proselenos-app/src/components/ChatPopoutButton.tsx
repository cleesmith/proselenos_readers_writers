// components/ChatPopoutButton.tsx

'use client';

import React from 'react';
import { createRoot } from 'react-dom/client';
import TabChatModal from './TabChatModal';
import StyledSmallButton from '@/components/StyledSmallButton';
import { getTheme } from '@/app/shared/theme';

interface ChatPopoutButtonProps {
  className?: string;
  isDarkMode?: boolean;
  currentProject?: string | null;
  currentProjectId?: string | null;
  styleOverrides?: React.CSSProperties;
}

/**
 * A button that opens the TabChatModal in a separate browser window.
 * The pop‑out window listens for the main window unloading and closes itself
 * to avoid leaving a non‑functional chat open after the parent is gone.
 */
export default function ChatPopoutButton({
  className = '',
  isDarkMode = false,
  currentProject,
  currentProjectId,
  styleOverrides
}: ChatPopoutButtonProps): React.JSX.Element {
  const theme = getTheme(isDarkMode);

  const openChatWindow = () => {
    if (!currentProject || !currentProjectId) {
      // No alert - user can see the button is disabled
      return;
    }
    const chatWindow = window.open('', '_blank');

    if (!chatWindow) return;

    chatWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>TabChat</title>
            <style>
              html, body { height: 100%; margin: 0; }
              #chat-root { height: 100%; display: flex; flex-direction: column; }
            </style>
          </head>
          <body>
            <div id="chat-root"></div>
          </body>
        </html>
    `);

    const container = chatWindow.document.getElementById('chat-root');
    if (!container) return;

    const root = createRoot(container);

    // When the main window is closed or refreshed, close the chat window.
    const closeChildOnParentUnload = () => {
      if (!chatWindow.closed) {
        chatWindow.close();
      }
    };

    window.addEventListener('beforeunload', closeChildOnParentUnload);
    // Remove the unload listener once the chat window itself is closed.
    chatWindow.addEventListener('beforeunload', () => {
      window.removeEventListener('beforeunload', closeChildOnParentUnload);
    });

    // Provide a handler so the chat window can close itself when the user clicks "Close".
    const handleClose = () => {
      chatWindow.close();
    };

    root.render(
      <TabChatModal
        isOpen={true}
        onClose={handleClose}
        isDarkMode={isDarkMode}
        currentProject={currentProject}
      />
    );
  };

  return (
    <StyledSmallButton
      className={className}
      onClick={openChatWindow}
      disabled={!currentProject || !currentProjectId}
      theme={theme}
      styleOverrides={styleOverrides}
    >
      TabChat
    </StyledSmallButton>
  );
}
