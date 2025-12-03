// app/projects/ProjectSection.tsx

'use client';

import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface ProjectSectionProps {
  currentProject: string | null;
  uploadStatus: string;
  isLoadingConfig: boolean;
  isStorageOperationPending: boolean;
  toolExecuting: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  isSystemInitializing: boolean;
  isDocxConverting: boolean; // DOCX -> TXT conversion pending
  isDocxDialogOpen?: boolean; // DOCX selector or filename dialog open
  isTxtConverting: boolean; // TXT -> DOCX conversion pending
  isTxtDialogOpen?: boolean; // TXT selector or filename dialog open
  onSelectProject: () => void;
  onProjectSettings: () => void;
  onFilesClick: () => void;
  onDocxImport: () => void | Promise<void>;
  onTxtExport: () => void | Promise<void>;
  onEditorClick: () => void;
}

export default function ProjectSection({
  currentProject,
  uploadStatus,
  isLoadingConfig: _isLoadingConfig,
  isStorageOperationPending,
  toolExecuting,
  theme,
  isDarkMode,
  isSystemInitializing,
  isDocxConverting,
  isDocxDialogOpen = false,
  isTxtConverting,
  isTxtDialogOpen = false,
  onSelectProject,
  onProjectSettings,
  onFilesClick,
  onDocxImport,
  onTxtExport,
  onEditorClick
}: ProjectSectionProps) {
  const importDisabled =
    isSystemInitializing ||
    isStorageOperationPending ||
    toolExecuting ||
    !currentProject ||
    isDocxConverting ||
    isDocxDialogOpen;

  const exportDisabled =
    isSystemInitializing ||
    isStorageOperationPending ||
    toolExecuting ||
    !currentProject ||
    isTxtConverting ||
    isTxtDialogOpen;

  const uploadDisabled =
    isSystemInitializing ||
    isStorageOperationPending ||
    toolExecuting ||
    !currentProject;

  const settingsDisabled =
    isSystemInitializing ||
    isStorageOperationPending ||
    toolExecuting ||
    !currentProject;

  return (
    <div style={{
      position: 'relative',
      marginTop: '16px',
      marginBottom: '24px',
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
      borderRadius: '8px',
      padding: '12px'
    }}>
      <h2 style={{
        position: 'absolute',
        top: '-10px',
        left: '12px',
        fontSize: '16px',
        fontWeight: 'bold',
        fontStyle: 'italic',
        color: theme.text,
        backgroundColor: theme.bg,
        paddingLeft: '6px',
        paddingRight: '6px',
        margin: 0
      }}>
        Project:
      </h2>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '16px',
        marginBottom: '8px',
        marginTop: '8px'
      }}>
        
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'flex-start'
        }}>
          <StyledSmallButton
            onClick={onSelectProject}
            disabled={false}
            theme={theme}
          >
            Select
          </StyledSmallButton>

          <StyledSmallButton
            onClick={onEditorClick}
            disabled={isSystemInitializing || isStorageOperationPending || toolExecuting || !currentProject}
            theme={theme}
            styleOverrides={{ marginLeft: '4px' }}
          >
            Editor
          </StyledSmallButton>

          <StyledSmallButton
            onClick={onFilesClick}
            disabled={uploadDisabled}
            theme={theme}
          >
            Files
          </StyledSmallButton>
          
          {/* Word import/export buttons group - orange box style */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 6px',
            border: `1px solid ${isDarkMode ? '#888' : '#666'}`,
            borderRadius: '4px',
            backgroundColor: isDarkMode ? 'rgba(136, 136, 136, 0.1)' : 'rgba(102, 102, 102, 0.08)'
          }}>
            <span style={{ fontSize: '9px', fontStyle: 'italic', color: theme.textSecondary, marginRight: '2px', alignSelf: 'center' }}>Word:</span>
            <StyledSmallButton
              onClick={onDocxImport}
              disabled={importDisabled}
              title={importDisabled ? 'Please wait…' : 'Import a DOCX file'}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
              aria-busy={isDocxConverting}
            >
              {isDocxConverting ? 'Converting…' : 'Import'}
            </StyledSmallButton>
            <StyledSmallButton
              onClick={onTxtExport}
              disabled={exportDisabled}
              title={exportDisabled ? 'Please wait…' : 'Export a TXT to DOCX'}
              theme={theme}
              styleOverrides={{ fontSize: '10px', padding: '2px 8px', height: '20px', lineHeight: 1 }}
              aria-busy={isTxtConverting}
            >
              {isTxtConverting ? 'Exporting…' : 'Export'}
            </StyledSmallButton>
          </div>
        </div>
      </div>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '20px',
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: '10px'
      }}>
        {currentProject && (
          <button
            onClick={onProjectSettings}
            disabled={settingsDisabled}
            title="Settings"
            style={{
              background: 'none',
              border: `1.5px solid ${isDarkMode ? '#888' : '#666'}`,
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: settingsDisabled ? 'not-allowed' : 'pointer',
              opacity: settingsDisabled ? 0.5 : 1,
              color: isDarkMode ? '#aaa' : '#555',
              fontSize: '12px',
              fontWeight: 'bold',
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              padding: 0,
              lineHeight: 1
            }}
          >
            i
          </button>
        )}
        {currentProject || 'No Project Selected'}
      </div>

      {uploadStatus && (
        <div style={{
          marginTop: '8px',
          padding: '4px 8px',
          backgroundColor: theme.statusBg,
          border: `1px solid ${theme.border}`,
          borderRadius: '3px',
          fontSize: '10px',
          color: uploadStatus.includes('✅') ? '#0f0' : uploadStatus.includes('❌') ? '#f00' : theme.text
        }}>
          {uploadStatus}
        </div>
      )}
    </div>
  );
}
