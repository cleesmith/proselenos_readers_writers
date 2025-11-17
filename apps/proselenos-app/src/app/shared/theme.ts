// app/shared/theme.ts

// Shared theme configuration

export interface ThemeConfig {
  bg: string;
  headerBg: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  modalBg: string;
  inputBg: string;
  statusBg: string;
  // Optional success styling used in some components
  successBg?: string;
  successBorder?: string;
  successText?: string;
}

export const getTheme = (isDarkMode: boolean): ThemeConfig => ({
  bg: isDarkMode ? '#2a2a2a' : '#f5f5f5',
  headerBg: isDarkMode ? '#3a3a3a' : '#e0e0e0',
  text: isDarkMode ? '#fff' : '#333',
  textSecondary: isDarkMode ? '#ccc' : '#666',
  textMuted: isDarkMode ? '#888' : '#999',
  border: isDarkMode ? '#4a4a4a' : '#ddd',
  modalBg: isDarkMode ? '#1a1a1a' : '#fff',
  inputBg: isDarkMode ? '#3a3a3a' : '#fff',
  statusBg: isDarkMode ? '#1a1a1a' : '#f0f0f0'
});
