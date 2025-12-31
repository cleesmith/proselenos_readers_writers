// app/shared/alerts.ts

// Shared alert utilities

import Swal from 'sweetalert2';

export const showAlert = (
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  customTitle?: string,
  isDarkMode: boolean = true
) => {
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

  const titles = {
    success: 'Success!',
    error: 'Error',
    warning: 'Warning',
    info: 'Information'
  };

  const hasNewlines = message.includes('\n');
  const alertOptions: any = {
    title: customTitle || titles[type],
    icon: type,
    background: isDarkMode ? '#222' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    confirmButtonColor: '#3085d6',
    confirmButtonText: 'OK',
    // Ensure alert appears above modals (which use z-index 2000-3000)
    customClass: {
      container: 'swal-above-modal'
    }
  };

  if (hasNewlines) {
    alertOptions.html = message.replace(/\n/g, '<br>');
  } else {
    alertOptions.text = message;
  }

  // Add style for high z-index if not already present
  if (!document.getElementById('swal-high-z-style')) {
    const style = document.createElement('style');
    style.id = 'swal-high-z-style';
    style.textContent = '.swal-above-modal { z-index: 10000 !important; }';
    document.head.appendChild(style);
  }

  Swal.fire(alertOptions);
};

export const showInputAlert = async (
  message: string,
  defaultValue: string = '',
  placeholder: string = '',
  isDarkMode: boolean = true
): Promise<string | null> => {
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  
  const result = await Swal.fire({
    title: 'Enter filename',
    text: message,
    input: 'text',
    inputValue: defaultValue,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Save',
    cancelButtonText: 'Cancel',
    background: isDarkMode ? '#222' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    confirmButtonColor: '#28a745',
    cancelButtonColor: '#6c757d',
    inputValidator: (value) => {
      if (!value || !value.trim()) {
        return 'Please enter a filename';
      }
      return null;
    }
  });

  return result.isConfirmed ? result.value : null;
};

export const showUrlInput = async (
  title: string = 'Enter URL',
  defaultValue: string = 'https://',
  isDarkMode: boolean = true
): Promise<string | null> => {
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

  // Add style for high z-index if not already present
  if (!document.getElementById('swal-high-z-style')) {
    const style = document.createElement('style');
    style.id = 'swal-high-z-style';
    style.textContent = '.swal-above-modal { z-index: 10000 !important; }';
    document.head.appendChild(style);
  }

  const result = await Swal.fire({
    title,
    input: 'url',
    inputValue: defaultValue,
    inputPlaceholder: 'https://example.com',
    showCancelButton: true,
    confirmButtonText: 'Add Link',
    cancelButtonText: 'Cancel',
    background: isDarkMode ? '#222' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#6c757d',
    customClass: {
      container: 'swal-above-modal'
    },
    inputValidator: (value) => {
      if (!value || !value.trim()) {
        return 'Please enter a URL';
      }
      // Basic URL validation
      try {
        new URL(value);
        return null;
      } catch {
        return 'Please enter a valid URL (e.g., https://example.com)';
      }
    }
  });

  return result.isConfirmed ? result.value : null;
};

export const showConfirm = async (
  message: string,
  isDarkMode: boolean = true,
  title: string = 'Confirm',
  confirmText: string = 'Yes',
  cancelText: string = 'Cancel'
): Promise<boolean> => {
  const result = await Swal.fire({
    title,
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    background: isDarkMode ? '#222' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    // Ensure dialog appears above high z-index modals (like One-by-one at z-index 4000)
    didOpen: () => {
      const container = document.querySelector('.swal2-container') as HTMLElement;
      if (container) container.style.zIndex = '5000';
    }
  });

  return result.isConfirmed === true;
};

// Sticky error alert that can only be dismissed via Signout
export const showStickyErrorWithLogout = (
  title: string,
  message: string,
  isDarkMode: boolean = true
) => {
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

  const hasNewlines = message.includes('\n');
  
  // Detect if this is a long message (like the detailed permission explanation)
  const isLongMessage = message.length > 400 || message.split('\n').length > 10;
  
  const alertOptions: any = {
    title,
    icon: 'error',
    background: isDarkMode ? '#222' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    confirmButtonColor: '#dc3545',
    confirmButtonText: 'Sign out',
    showCancelButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    // Make the dialog wider for long messages
    width: isLongMessage ? '700px' : '400px',
    customClass: {
      popup: 'swal2-long-message',
      htmlContainer: 'swal2-left-align'
    }
  };

  if (hasNewlines) {
    // For long messages, create better formatted HTML with left alignment
    if (isLongMessage) {
      alertOptions.html = `
        <div style="
          text-align: left; 
          line-height: 1.6; 
          font-size: 14px;
          max-width: 100%;
        ">
          ${message.replace(/\n\n/g, '</p><p style="margin: 16px 0;">').replace(/\n/g, '<br>')}
        </div>
      `;
    } else {
      alertOptions.html = message.replace(/\n/g, '<br>');
    }
  } else {
    alertOptions.text = message;
  }

  // Add custom CSS for better formatting
  const style = document.createElement('style');
  style.textContent = `
    .swal2-long-message {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .swal2-long-message .swal2-title {
      font-size: 20px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 20px;
    }
    .swal2-left-align {
      text-align: left !important;
    }
    .swal2-long-message .swal2-html-container {
      max-height: 400px;
      overflow-y: auto;
      padding-right: 10px;
    }
    .swal2-long-message .swal2-html-container::-webkit-scrollbar {
      width: 6px;
    }
    .swal2-long-message .swal2-html-container::-webkit-scrollbar-track {
      background: ${isDarkMode ? '#333' : '#f1f1f1'};
      border-radius: 3px;
    }
    .swal2-long-message .swal2-html-container::-webkit-scrollbar-thumb {
      background: ${isDarkMode ? '#666' : '#888'};
      border-radius: 3px;
    }
    .swal2-long-message .swal2-html-container::-webkit-scrollbar-thumb:hover {
      background: ${isDarkMode ? '#777' : '#555'};
    }
  `;
  document.head.appendChild(style);

  Swal.fire(alertOptions).then(() => {
    // Clean up the style element
    document.head.removeChild(style);
    // Force logout route navigation
    // window.location.href = '/api/auth/signout?callbackUrl=/';
    window.location.href = '/';
  });
};

// Timeout modal for AI tool execution (5-minute server limit)
export function showTimeoutModal(isDarkMode: boolean, timeoutMs: number): void {
  document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

  // Compute timeout display from server value
  const timeoutSecs = Math.floor(timeoutMs / 1000);
  const mins = Math.floor(timeoutSecs / 60);
  const secs = timeoutSecs % 60;
  const timeoutDisplay = `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;

  // Add style for high z-index if not already present
  if (!document.getElementById('swal-high-z-style')) {
    const style = document.createElement('style');
    style.id = 'swal-high-z-style';
    style.textContent = '.swal-above-modal { z-index: 10000 !important; }';
    document.head.appendChild(style);
  }

  Swal.fire({
    icon: 'warning',
    title: 'Tool Execution Stopped',
    html: `
      <div style="text-align: left; font-size: 14px; line-height: 1.6;">
        <p><strong>What happened:</strong></p>
        <p>The AI tool was stopped after <strong>${timeoutDisplay}</strong> due to
        a server limit. Stopping early avoids confusing errors.</p>

        <p style="margin-top: 12px;"><strong>Important — You may be charged:</strong></p>
        <p>Depending on your AI model's provider, you may or may not be charged for this request.
        Providers like Anthropic and OpenAI stop billing when aborted. Others (Google, Mistral, etc.)
        may continue processing and charge for the full response.</p>

        <p style="margin-top: 12px;"><strong>Suggestions for next time:</strong></p>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li>Use a shorter manuscript section</li>
          <li>Try a faster AI model</li>
          <li>Split your manuscript into smaller chapters</li>
        </ul>
      </div>
    `,
    confirmButtonText: 'Got it',
    confirmButtonColor: '#e85d04',
    background: isDarkMode ? '#222' : '#fff',
    color: isDarkMode ? '#fff' : '#333',
    customClass: {
      container: 'swal-above-modal'
    },
    width: '520px'
  });
}