// app/projects/ProjectSection.tsx

'use client';

import { useState } from 'react';
import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';
import DownloadFileModal from '../non-ai-tools/DownloadFileModal';

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
  isUploading?: boolean; // File upload in progress
  onSelectProject: () => void;
  onProjectSettings: () => void;
  onFileUpload: () => void;
  onDocxImport: () => void | Promise<void>;
  onTxtExport: () => void | Promise<void>;
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
  isUploading = false,
  onSelectProject,
  onProjectSettings,
  onFileUpload,
  onDocxImport,
  onTxtExport
}: ProjectSectionProps) {
  const [showDownloadModal, setShowDownloadModal] = useState(false);

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
      marginBottom: '12px',
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
      borderRadius: '8px',
      padding: '12px'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <h2 style={{ 
          fontSize: '16px', 
          fontWeight: 'bold', 
          color: theme.text,
          margin: '0'
        }}>
          Writing Project:
        </h2>
        
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginLeft: '20px',
          flex: '1',
          justifyContent: 'space-evenly'
        }}>
          <StyledSmallButton 
            onClick={onSelectProject}
            disabled={false}
            theme={theme}
          >
            Select Project
          </StyledSmallButton>
          
          <StyledSmallButton 
            onClick={onProjectSettings}
            disabled={settingsDisabled}
            theme={theme}
          >
            Project Settings
          </StyledSmallButton>
          
          <StyledSmallButton
            onClick={onFileUpload}
            disabled={uploadDisabled || isUploading}
            theme={theme}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </StyledSmallButton>

          <StyledSmallButton
            onClick={() => setShowDownloadModal(true)}
            disabled={uploadDisabled}
            theme={theme}
          >
            Download
          </StyledSmallButton>
          
          <StyledSmallButton 
            onClick={onDocxImport}
            disabled={importDisabled}
            title={importDisabled ? 'Please wait…' : 'Import a DOCX file'}
            theme={theme}
            styleOverrides={{ padding: '3px 6px' }}
            aria-busy={isDocxConverting}
          >
            {isDocxConverting ? 'Converting…' : 'IMPORT .docx'}
          </StyledSmallButton>
          
          <StyledSmallButton 
            onClick={onTxtExport}
            disabled={exportDisabled}
            title={exportDisabled ? 'Please wait…' : 'Export a TXT to DOCX'}
            theme={theme}
            styleOverrides={{ padding: '3px 6px' }}
            aria-busy={isTxtConverting}
          >
            {isTxtConverting ? 'Exporting…' : 'EXPORT .docx'}
          </StyledSmallButton>
        </div>
      </div>
      
      <div style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: '10px'
      }}>
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

      {/* Download File Modal */}
      {showDownloadModal && (
        <DownloadFileModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          currentProject={currentProject}
          theme={theme}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
