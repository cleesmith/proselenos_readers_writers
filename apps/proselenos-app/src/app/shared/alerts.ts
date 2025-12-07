// app/shared/alerts.ts

// Shared alert utilities

import Swal from 'sweetalert2';
import { signOut } from 'next-auth/react';

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
    cancelButtonColor: '#6c757d'
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
    signOut({ callbackUrl: '/', redirect: true });
  });
};