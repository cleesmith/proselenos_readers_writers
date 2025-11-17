// app/projects/ExportModal.tsx

// TXT Export Modal Component (TXT to DOCX conversion)
// Extracted from app/page.tsx lines 2178-2404 (TXT file selector + filename dialog)

'use client';

import { ThemeConfig } from '../shared/theme';
import StyledSmallButton from '@/components/StyledSmallButton';

interface ExportModalProps {
  // Visibility states
  showTxtSelector: boolean;
  showTxtFilenameDialog: boolean;
  
  // Data
  txtFiles: any[];
  selectedTxtFile: any | null;
  txtOutputFileName: string;
  isConvertingTxt: boolean;
  
  // Theme
  theme: ThemeConfig;
  isDarkMode: boolean;
  
  // Callbacks
  onSelectFile: (file: any) => void;
  onCancelFileSelector: () => void;
  onFilenameChange: (filename: string) => void;
  onCancelFilename: () => void;
  onConfirmConversion: () => void;
}

export default function ExportModal({
  showTxtSelector,
  showTxtFilenameDialog,
  txtFiles,
  selectedTxtFile: _selectedTxtFile,
  txtOutputFileName,
  isConvertingTxt,
  theme,
  isDarkMode,
  onSelectFile,
  onCancelFileSelector,
  onFilenameChange,
  onCancelFilename,
  onConfirmConversion
}: ExportModalProps) {
  
  if (!showTxtSelector && !showTxtFilenameDialog) return null;
  
  return (
    <>
      {/* TXT File Selector Modal */}
      {showTxtSelector && (
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
            maxWidth: '500px',
            width: '90%',
            maxHeight: '60vh',
            overflowY: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '20px' 
            }}>
              <div style={{ 
                color: theme.text, 
                fontSize: '16px', 
                fontWeight: 'bold' 
              }}>
                Select TXT File to Convert
              </div>
              <StyledSmallButton onClick={onCancelFileSelector} theme={theme}>
                Cancel
              </StyledSmallButton>
            </div>

            <div style={{ 
              fontSize: '12px', 
              color: theme.textSecondary, 
              marginBottom: '12px' 
            }}>
              Choose a TXT file from your project to convert to DOCX:
            </div>

            {txtFiles.length === 0 ? (
              <p style={{ color: theme.textMuted, textAlign: 'center' }}>No TXT files found in project</p>
            ) : (
              <div style={{
                backgroundColor: isDarkMode ? '#222' : '#f8f9fa',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                {txtFiles.map((file: any) => {
                  return (
                    <div
                      key={file.id}
                      onClick={() => onSelectFile(file)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#f0f0f0';
                      }}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{
                        flex: '1',
                        color: '#34A853',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span>📄</span>
                        {file.name}
                      </div>
                      <StyledSmallButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFile(file);
                        }}
                        theme={theme}
                      >
                        Convert
                      </StyledSmallButton>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TXT Filename Input Dialog */}
      {showTxtFilenameDialog && (
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
            width: '400px',
            maxWidth: '90%'
          }}>
            <div style={{ 
              color: theme.text, 
              fontSize: '16px', 
              fontWeight: 'bold',
              marginBottom: '15px'
            }}>
              Output Filename
            </div>
            
            <div style={{ 
              fontSize: '12px', 
              color: theme.textSecondary, 
              marginBottom: '15px' 
            }}>
              Enter name for the output DOCX file:
            </div>
            
            <input
              type="text"
              value={txtOutputFileName}
              onChange={(e) => onFilenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onConfirmConversion();
                }
              }}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: theme.inputBg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                marginBottom: '20px',
                boxSizing: 'border-box'
              }}
              placeholder="Enter filename..."
              autoFocus
            />
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <StyledSmallButton onClick={onCancelFilename} disabled={isConvertingTxt} theme={theme}>
                Cancel
              </StyledSmallButton>
              
              <StyledSmallButton
                onClick={onConfirmConversion}
                disabled={!txtOutputFileName.trim() || isConvertingTxt}
                theme={theme}
              >
                {isConvertingTxt ? 'Converting...' : 'Convert'}
              </StyledSmallButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
