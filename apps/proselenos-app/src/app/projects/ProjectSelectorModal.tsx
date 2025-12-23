// app/projects/ProjectSelectorModal.tsx

'use client';

import { ThemeConfig } from '../shared/theme';
import { readFileAction } from '@/lib/project-actions';
import StyledSmallButton from '@/components/StyledSmallButton';

interface ProjectSelectorModalProps {
  session: any;
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  currentProject: string | null;

  // Modal state
  modalFiles: any[];
  breadcrumbs: any[];
  newProjectName: string;
  isProjectFilesBrowser: boolean;
  isStorageOperationPending: boolean;
  toolExecuting: boolean;
  
  // Callbacks
  onClose: () => void;
  onSelectProject: (folder: any) => void;
  onNavigateToFolder: (folderId: string) => void;
  onCreateNewProject: () => void;
  onNewProjectNameChange: (name: string) => void;
  onLoadFileIntoEditor: (content: string, fileName: string, fileId?: string) => void;
  onUploadStatusUpdate: (status: string) => void;
}

export default function ProjectSelectorModal({
  session: _session,
  isOpen,
  theme,
  isDarkMode,
  currentProject,
  modalFiles,
  breadcrumbs,
  newProjectName,
  isProjectFilesBrowser,
  isStorageOperationPending,
  toolExecuting,
  onClose,
  onSelectProject,
  onNavigateToFolder,
  onCreateNewProject,
  onNewProjectNameChange,
  onLoadFileIntoEditor,
  onUploadStatusUpdate
}: ProjectSelectorModalProps) {
  
  const handleFileClick = async (file: any) => {
    const isFolder = file.mimeType === 'folder';

    if (isFolder) {
      onNavigateToFolder(file.id);
    } else if (isProjectFilesBrowser) {
      // Load file content into editor
      try {
        onUploadStatusUpdate('Loading file...');
        const result = await readFileAction(currentProject!, file.path || `${currentProject}/${file.name}`);
        if (result.success) {
          onLoadFileIntoEditor(result.data?.content, file.name, file.path || file.id);
          onClose();
          onUploadStatusUpdate(`✅ File loaded: ${file.name}`);
        } else {
          onUploadStatusUpdate(`❌ Load failed: ${result.error}`);
        }
      } catch (error) {
        onUploadStatusUpdate(`❌ Load error: ${error}`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 3000
    }}>
      <div style={{
        backgroundColor: theme.modalBg,
        border: `2px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '70vh',
        overflowY: 'auto'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ 
              color: theme.text, 
              fontSize: '16px', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {isProjectFilesBrowser ? `Files in Project: ${currentProject}` : 'Select Writing Project'}
              {!isProjectFilesBrowser && breadcrumbs.map((crumb, index) => (
                <div key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => onNavigateToFolder(crumb.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: index === breadcrumbs.length - 1 ? theme.text : '#4285F4',
                      cursor: index === breadcrumbs.length - 1 ? 'default' : 'pointer',
                      fontSize: '14px',
                      fontWeight: index === breadcrumbs.length - 1 ? 'bold' : 'normal',
                      textDecoration: index === breadcrumbs.length - 1 ? 'none' : 'underline',
                      padding: '2px'
                    }}
                  >
                    {index === 0 ? '' : crumb.name}
                  </button>
                  {index < breadcrumbs.length - 1 && <span style={{ color: '#666' }}>›</span>}
                </div>
              ))}
            </div>
            <StyledSmallButton onClick={onClose} theme={theme}>
              Close
            </StyledSmallButton>
          </div>
        </div>

        {isProjectFilesBrowser ? (
          // Show all files and folders in the project
          modalFiles.length === 0 ? (
            <p style={{ color: theme.textMuted, textAlign: 'center' }}>No files found in project</p>
          ) : (
            <div style={{
              backgroundColor: isDarkMode ? '#222' : '#f8f9fa',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              {modalFiles.map((file: any) => {
                const isFolder = file.mimeType === 'folder';

                return (
                  <div
                    key={file.id}
                    onClick={() => handleFileClick(file)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                      cursor: (isFolder || isProjectFilesBrowser) ? 'pointer' : 'default',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                      if (isFolder) {
                        e.currentTarget.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#f0f0f0';
                      }
                    }}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{
                      flex: '1',
                      color: theme.text,
                      fontWeight: isFolder ? 'bold' : 'normal',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {isFolder ? <span>📁</span> : <span>📄</span>}
                      {file.name}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: theme.textMuted
                    }}>
                      {isFolder ? 'Folder' : 'File'}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // Show only folders for project selection
          modalFiles.filter(file => file.mimeType === 'folder' && file.name !== 'tool-prompts').length === 0 ? (
            <p style={{ color: theme.textMuted, textAlign: 'center' }}>No writing projects found</p>
          ) : (
            <div style={{
              backgroundColor: isDarkMode ? '#222' : '#f8f9fa',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              {modalFiles
                .filter(file => file.mimeType === 'folder' && file.name !== 'tool-prompts')
                .map((folder: any) => (
                  <div
                    key={folder.id}
                    onClick={() => onSelectProject(folder)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#f0f0f0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ 
                      flex: '1',
                      color: theme.text,
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>📁</span>
                      {folder.name}
                    </div>
                    <StyledSmallButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(folder);
                      }}
                      theme={theme}
                    >
                      Select
                    </StyledSmallButton>
                  </div>
                ))}
            </div>
          )
        )}

        {/* Create New Project Section - only show in project selection mode */}
        {!isProjectFilesBrowser && (
          <div style={{ 
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: `1px solid ${theme.border}`
          }}>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: 'bold', 
              color: theme.text,
              marginBottom: '12px',
              margin: '0 0 12px 0'
            }}>
              Create New Project:
            </h3>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => onNewProjectNameChange(e.target.value)}
                placeholder="Enter project name..."
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    onCreateNewProject();
                  }
                }}
              />
              <StyledSmallButton
                onClick={onCreateNewProject}
                disabled={!newProjectName.trim() || isStorageOperationPending || toolExecuting}
                theme={theme}
              >
                Create
              </StyledSmallButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
