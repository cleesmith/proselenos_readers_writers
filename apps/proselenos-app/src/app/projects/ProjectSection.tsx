// app/projects/ProjectSection.tsx

'use client';

import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface ProjectSectionProps {
  uploadStatus: string;
  toolExecuting: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  isSystemInitializing: boolean;
  isTxtConverting: boolean;
  onProjectSettings: () => void;
  onFilesClick: () => void;
  onDocxImport: () => void | Promise<void>;
  onTxtExport: () => void | Promise<void>;
  onEditorClick: () => void;
}

export default function ProjectSection({
  uploadStatus,
  toolExecuting,
  theme,
  isDarkMode,
  isSystemInitializing,
  isTxtConverting,
  onProjectSettings,
  onFilesClick,
  onDocxImport,
  onTxtExport,
  onEditorClick
}: ProjectSectionProps) {
  const importDisabled = isSystemInitializing || toolExecuting;
  const exportDisabled = isSystemInitializing || toolExecuting || isTxtConverting;
  const uploadDisabled = isSystemInitializing || toolExecuting;
  const settingsDisabled = isSystemInitializing || toolExecuting;

  return (
    <div style={{
      position: 'relative',
      marginTop: '8px',
      marginBottom: '12px',
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
        Manuscript:
      </h2>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '8px',
        marginBottom: '8px',
        marginTop: '8px'
      }}>

        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-start'
        }}>
          <StyledSmallButton
            onClick={onProjectSettings}
            disabled={settingsDisabled}
            theme={theme}
          >
            Settings
          </StyledSmallButton>

          <StyledSmallButton
            onClick={onEditorClick}
            disabled={isSystemInitializing || toolExecuting}
            theme={theme}
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
          
          <StyledSmallButton
            onClick={onDocxImport}
            disabled={importDisabled}
            title={importDisabled ? 'Please wait…' : 'Import a DOCX file'}
            theme={theme}
          >
            Import
          </StyledSmallButton>
          <StyledSmallButton
            onClick={onTxtExport}
            disabled={exportDisabled}
            title={exportDisabled ? 'Please wait…' : 'Export a TXT to DOCX'}
            theme={theme}
            aria-busy={isTxtConverting}
          >
            {isTxtConverting ? 'Exporting…' : 'Export'}
          </StyledSmallButton>
        </div>
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
